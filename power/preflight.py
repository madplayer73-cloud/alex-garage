"""Read-only CasaOS diagnostics. Prints no env vars, cookies or credentials."""
import json
import re
import shutil
import subprocess


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=20)
    if result.returncode:
        print('CHECK FAILED:', ' '.join(args[:3]), '(exit', result.returncode, ')')
        return None
    return result.stdout


def main():
    docker = shutil.which('docker')
    if not docker:
        raise SystemExit('Docker CLI is missing')
    base = [docker, '--host=unix:///var/run/docker.sock']
    for name in ['osud-osud-1', 'osud-photos-1', 'tailscale']:
        value = run(base + ['inspect', '--format',
            '{{.Name}} | running={{.State.Running}} | network={{.HostConfig.NetworkMode}} | ports={{json .NetworkSettings.Ports}}', name])
        if value:
            print(value.strip())
    value = run(base + ['exec', 'tailscale', 'tailscale', 'status', '--json'])
    if value:
        dns = json.loads(value).get('Self', {}).get('DNSName', '').rstrip('.')
        print('Host DNS:', dns or 'UNKNOWN')
        if dns.endswith('.ts.net'):
            print('Proposed Osud origin: https://' + dns + ':8459')
            print('Google callback: https://' + dns + ':8459/oauth2/callback')
    print('Existing Serve routes (read only):')
    value = run(base + ['exec', 'tailscale', 'tailscale', 'serve', 'status'])
    if value:
        print(value.strip())
    ss = shutil.which('ss')
    if ss:
        value = run([ss, '-ltn'])
        if value is not None:
            found = [line for line in value.splitlines() if re.search(r':(?:4198|4199|8459)\s', line)]
            print('Proposed ports already listening:', '\n'.join(found) if found else 'none')
    else:
        print('Port check unavailable: ss missing')
    print('No containers, routes, settings or files were modified.')


if __name__ == '__main__':
    main()
