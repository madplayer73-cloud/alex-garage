"""Dedicated Osud gateway. Reuses the Folio gateway pattern, not its service.

Only two fixed Osud containers are controllable. No Docker access in the app.
All public requests must pass the dedicated oauth2-proxy authorization check.
"""
import http.client
import json
import os
import subprocess
import threading
import time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

CONTAINERS = ('osud-photos-1', 'osud-osud-1')  # startup order
HOP = {'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
       'te', 'trailer', 'transfer-encoding', 'upgrade'}


def validated_origin(value):
    url = urlsplit(value)
    if (url.scheme != 'https' or not url.hostname or not url.hostname.endswith('.ts.net')
            or url.username or url.password or url.path or url.query or url.fragment
            or url.port != 8459):
        raise ValueError('OSUD_POWER_ORIGIN must be https://<private-host>.ts.net:8459')
    return value


def inspect_containers():
    states = []
    for name in CONTAINERS:
        result = subprocess.run(['/usr/bin/docker', '--host=unix:///var/run/docker.sock', 'inspect', '--format', '{{json .State}}', name],
                                capture_output=True, check=True, timeout=10)
        state = json.loads(result.stdout)
        states.append({'running': state.get('Running') is True,
                       'healthy': state.get('Health', {}).get('Status') == 'healthy'})
    return {'running': all(s['running'] for s in states),
            'anyRunning': any(s['running'] for s in states),
            'healthy': all(s['healthy'] for s in states)}


def control(action):
    if action not in ('start', 'stop'):
        raise ValueError('Unsupported action')
    for name in (CONTAINERS if action == 'start' else reversed(CONTAINERS)):
        args = ['/usr/bin/docker', '--host=unix:///var/run/docker.sock', action]
        if action == 'stop':
            args += ['--time', '60']
        subprocess.run(args + [name], capture_output=True, check=True, timeout=75)


class Sleeping(RuntimeError):
    pass


class PowerManager:
    def __init__(self, inspect=inspect_containers, docker=control, clock=time.monotonic, idle=900):
        self.inspect, self.docker, self.clock = inspect, docker, clock
        self.idle, self.last_activity = idle, clock()
        self.lock = threading.RLock()
        self.active = 0

    def wake(self):
        # One lock coalesces simultaneous wake requests and excludes a concurrent stop.
        with self.lock:
            state = self.inspect()
            if not state['running']:
                self.docker('start')
            deadline = time.monotonic() + 90
            while not self.inspect()['healthy']:
                if time.monotonic() >= deadline:
                    raise RuntimeError('Wake timed out')
                time.sleep(.5)
            self.last_activity = self.clock()

    def touch(self):
        with self.lock:
            if not self.inspect()['running']:
                raise Sleeping()
            self.last_activity = self.clock()

    def status(self):
        with self.lock:
            return dict(self.inspect(), idleSeconds=round(self.clock()-self.last_activity, 1),
                        idleLimit=self.idle, activeRequests=self.active)

    @contextmanager
    def request(self):
        with self.lock:
            if not self.inspect()['running']:
                raise Sleeping()
            self.active += 1
        try:
            yield
        finally:
            with self.lock:
                self.active -= 1

    def sleep_if_idle(self):
        with self.lock:
            if self.clock()-self.last_activity < self.idle or self.active:
                return False
            state = self.inspect()
            if not state['anyRunning']:
                return True
            # No new proxy request can enter until stopping finishes. The photo API
            # replies only after the atomic file/database writes and queue complete.
            self.docker('stop')
            return True


def handler(manager, origin, auth_port=4198, backend_port=8099, authenticate=None):
    host = urlsplit(origin).netloc
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'
        def log_message(self, *_args):
            pass  # Never log cookies, query strings or OAuth codes.

        def reply(self, status, body=b'{}', kind='application/json; charset=utf-8', extra=()):
            self.send_response(status)
            for key, value in [('Content-Type', kind), ('Content-Length', str(len(body))),
                               ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'),
                               ('Referrer-Policy', 'no-referrer'), ('X-Frame-Options', 'DENY'), *extra]:
                self.send_header(key, value)
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)

        def authorized(self):
            if authenticate is not None:
                return authenticate(self.headers)
            connection = http.client.HTTPConnection('127.0.0.1', auth_port, timeout=8)
            try:
                connection.request('GET', '/oauth2/auth', headers={'Host': host,
                    'Cookie': self.headers.get('Cookie', ''), 'X-Forwarded-Proto': 'https',
                    'X-Forwarded-Host': host, 'X-Forwarded-Uri': self.path})
                response = connection.getresponse()
                response.read(16384)
                return response.status == 202
            finally:
                connection.close()

        def route(self):
            self.connection.settimeout(30)
            try:
                if self.client_address[0] not in ('127.0.0.1', '::1') or self.headers.get('Host') != host:
                    self.reply(403); return
                if not self.path.startswith('/') or self.path.startswith('//') or '\\' in self.path:
                    self.reply(400); return
                if self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length', [])) > 1:
                    self.close_connection = True; self.reply(400); return
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 <= length <= 9*1024*1024:
                    self.close_connection = True; self.reply(413); return
                path = urlsplit(self.path).path
                if path.startswith('/oauth2/'):
                    self.proxy(length, auth_port); return
                if not self.authorized():
                    self.close_connection = True
                    if self.command == 'GET' and (path == '/' or self.headers.get('Sec-Fetch-Mode') == 'navigate'):
                        self.reply(302, extra=[('Location', '/oauth2/sign_in?rd=%2F')])
                    else:
                        self.reply(401)
                    return
                if path == '/_osud_power/status' and self.command == 'GET':
                    self.reply(200, json.dumps(manager.status()).encode()); return
                if path.startswith('/_osud_power/'):
                    self.close_connection = True
                    if (self.command != 'POST' or self.headers.get('Origin') != origin
                            or self.headers.get('X-Osud-Interaction') != '1'):
                        self.reply(403); return
                    if length > 1024:
                        self.reply(413); return
                    if length and len(self.rfile.read(length)) != length:
                        self.reply(400); return
                    if path == '/_osud_power/wake':
                        manager.wake()
                    elif path == '/_osud_power/activity':
                        try:
                            manager.touch()
                        except Sleeping:
                            self.reply(409); return
                    else:
                        self.reply(404); return
                    self.reply(200); return
                # Navigation is an intentional visit, unlike health checks or polls.
                if (self.command == 'GET' and self.headers.get('Sec-Fetch-Mode') == 'navigate'
                        and self.headers.get('Sec-Fetch-Dest') == 'document'):
                    manager.wake()
                try:
                    with manager.request():
                        self.proxy(length, backend_port)
                except Sleeping:
                    self.close_connection = True
                    self.reply(503, b'{"error":"Osud spi. Otvor aplikaciu znova."}',
                               extra=[('X-Osud-Power-State', 'sleeping')])
            except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, http.client.HTTPException):
                self.close_connection = True
                try:
                    self.reply(503)
                except OSError:
                    pass

        def proxy(self, length, port):
            body = self.rfile.read(length) if length else None
            if body is not None and len(body) != length:
                raise ValueError('Incomplete body')
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in HOP and not k.lower().startswith(
                           ('x-forwarded-', 'x-auth-request-', 'x-osud-'))}
            headers.update({'Host': host, 'X-Forwarded-Proto': 'https',
                            'X-Forwarded-Host': host, 'Connection': 'close'})
            connection = http.client.HTTPConnection('127.0.0.1', port, timeout=180)
            try:
                connection.request(self.command, self.path, body, headers)
                response = connection.getresponse()
                data = response.read(64*1024*1024+1)
                if len(data) > 64*1024*1024:
                    raise ValueError('Response too large')
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in HOP | {'content-length', 'cache-control'}:
                        self.send_header(key, value)
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                if self.command != 'HEAD':
                    self.wfile.write(data)
            finally:
                connection.close()
        do_GET = do_HEAD = do_POST = do_DELETE = do_PUT = do_PATCH = route
    return Handler


def main():
    origin = validated_origin(os.environ['OSUD_POWER_ORIGIN'])
    manager = PowerManager()
    server = ThreadingHTTPServer(('127.0.0.1', 4199), handler(manager, origin))
    # Server restart starts a fresh 15 minute grace period. No forced startup stop.
    def monitor():
        while True:
            time.sleep(5)
            try:
                manager.sleep_if_idle()
            except Exception:
                print('Osud sleep check failed; no additional containers will be stopped.', flush=True)
    threading.Thread(target=monitor, daemon=True).start()
    server.serve_forever()


if __name__ == '__main__':
    main()
