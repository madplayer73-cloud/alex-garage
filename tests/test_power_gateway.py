"""Clock-controlled manager and real HTTP authorization/proxy tests; no host Docker."""
import importlib.util
import json
import threading
import unittest
import http.client
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('gateway',Path(__file__).resolve().parents[1]/'power/gateway.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
ORIGIN='https://casaos.example.ts.net:8459'

@contextmanager
def running(handler):
 server=ThreadingHTTPServer(('127.0.0.1',0),handler)
 thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 try:yield server.server_address[1]
 finally:server.shutdown();server.server_close();thread.join()

class ManagerTests(unittest.TestCase):
 def setUp(self):
  self.now=0;self.running=True;self.actions=[]
  def inspect():return {'running':self.running,'anyRunning':self.running,'healthy':self.running}
  def docker(action):self.actions.append(action);self.running=action=='start'
  self.manager=g.PowerManager(inspect=inspect,docker=docker,clock=lambda:self.now)
 def test_exact_fifteen_minutes_and_polling_not_activity(self):
  self.now=899.99;self.assertFalse(self.manager.sleep_if_idle())
  for _ in range(5):self.manager.status()
  self.now=900;self.assertTrue(self.manager.sleep_if_idle());self.assertEqual(self.actions,['stop'])
 def test_any_active_user_postpones_sleep(self):
  self.now=800;self.manager.touch();self.now=1000;self.assertFalse(self.manager.sleep_if_idle())
  self.now=1699;self.assertFalse(self.manager.sleep_if_idle());self.now=1700;self.assertTrue(self.manager.sleep_if_idle())
 def test_inflight_write_prevents_stop_until_complete(self):
  self.now=901
  with self.manager.request():
   self.assertFalse(self.manager.sleep_if_idle());self.assertEqual(self.actions,[])
  self.assertTrue(self.manager.sleep_if_idle())
  with self.assertRaises(g.Sleeping):
   with self.manager.request():pass
 def test_concurrent_wake_starts_once_and_new_grace_prevents_flapping(self):
  self.now=900;self.manager.sleep_if_idle()
  threads=[threading.Thread(target=self.manager.wake) for _ in range(5)]
  for thread in threads:thread.start()
  for thread in threads:thread.join()
  self.assertEqual(self.actions,['stop','start']);self.assertFalse(self.manager.sleep_if_idle())
 def test_restart_gets_grace_and_docker_failures_do_not_guess(self):
  self.now=8000;new=g.PowerManager(inspect=self.manager.inspect,docker=self.manager.docker,clock=lambda:self.now)
  self.assertFalse(new.sleep_if_idle())
  self.manager.inspect=lambda:(_ for _ in ()).throw(RuntimeError('unknown'))
  with self.assertRaises(RuntimeError):self.manager.sleep_if_idle()
  self.assertEqual(self.actions,[])
 def test_docker_control_only_targets_exact_pair_in_order(self):
  with patch.object(g.subprocess,'run') as run:
   g.control('stop');self.assertEqual([c.args[0][-1] for c in run.call_args_list],['osud-osud-1','osud-photos-1'])
   run.reset_mock();g.control('start');self.assertEqual([c.args[0][-1] for c in run.call_args_list],['osud-photos-1','osud-osud-1'])
   with self.assertRaises(ValueError):g.control('rm')
 def test_private_origin_only(self):
  self.assertEqual(g.validated_origin(ORIGIN),ORIGIN)
  for value in ['http://x.ts.net:8459','https://x.example:8459','https://x.ts.net:8443','https://user:pass@x.ts.net:8459','https://x.ts.net:8459/path']:
   with self.assertRaises(ValueError):g.validated_origin(value)

class HttpTests(unittest.TestCase):
 setUp=ManagerTests.setUp
 def test_authentication_csrf_polling_and_automatic_navigation_wake(self):
  manager=self.manager
  class OAuth(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_GET(self):
    self.send_response(202 if self.headers.get('Cookie')=='session=valid' else 401);self.end_headers()
  class Backend(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'app or photos')
  with running(OAuth) as auth, running(Backend) as backend:
   with running(g.handler(manager,ORIGIN,auth_port=auth,backend_port=backend)) as port:
    def request(path='/',method='GET',extra=None,authenticated=True):
     connection=http.client.HTTPConnection('127.0.0.1',port,timeout=5)
     headers={'Host':'casaos.example.ts.net:8459'}
     if authenticated:headers['Cookie']='session=valid'
     headers.update(extra or {});connection.request(method,path,headers=headers)
     response=connection.getresponse();body=response.read();status=response.status;connection.close();return status,body
    self.now=900;manager.sleep_if_idle()
    self.assertEqual(request('/_osud_power/wake','POST',authenticated=False)[0],401)
    self.assertEqual(request('/_osud_power/wake','POST',{'Origin':'https://evil.test','X-Osud-Interaction':'1'})[0],403)
    self.assertEqual(request('/_osud_power/wake','POST',{'Origin':ORIGIN})[0],403)
    self.assertEqual(request('/_osud_power/status')[0],200)
    self.assertEqual(request('/api/photos/health')[0],503);self.assertEqual(self.actions,['stop'])
    self.assertEqual(request('/')[0],503)
    self.assertEqual(request('/',extra={'Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'})[0],200)
    self.assertEqual(self.actions,['stop','start'])
    self.now=1000;self.assertEqual(request('/api/photos/health')[0],200);self.assertEqual(manager.last_activity,900)
    self.assertEqual(request('/_osud_power/activity','POST',{'Origin':ORIGIN,'X-Osud-Interaction':'1'})[0],200)
    self.assertEqual(manager.last_activity,1000)
    self.assertEqual(request('/_osud_power/sleep','POST',{'Origin':ORIGIN,'X-Osud-Interaction':'1'})[0],404)
    self.assertEqual(request('/',extra={'Host':'evil.test'})[0],403)
    self.assertEqual(request(authenticated=False)[0],302)

if __name__=='__main__':unittest.main()
