import sys,json,subprocess,time,base64,urllib.request
import os
from pathlib import Path
if os.environ.get('OSUD_DOCKER_POWER_TEST') != '1':
 raise SystemExit('Use only the disposable osud-power-check Compose project; see power/README.md')
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'power'))
from gateway import PowerManager
names=('osud-power-check-photos-1','osud-power-check-osud-1')
def docker(*args):return subprocess.check_output(['docker','--host=unix:///var/run/docker.sock',*args])
def state():
 values=[json.loads(docker('inspect','--format','{{json .State}}',name)) for name in names]
 return {'running':all(v['Running'] for v in values),'anyRunning':any(v['Running'] for v in values),'healthy':all(v.get('Health',{}).get('Status')=='healthy' for v in values)}
def control(action):
 for name in (names if action=='start' else reversed(names)):docker(action,*(['--time','60'] if action=='stop' else []),name)
now=[0];manager=PowerManager(inspect=state,docker=control,clock=lambda:now[0])
request=urllib.request.Request('http://127.0.0.1:18099/api/photos',data=json.dumps({'label':'test power preservation','image':'data:image/png;base64,'+base64.b64encode(open('public/icons/icon-192.png','rb').read()).decode()}).encode(),headers={'Content-Type':'application/json'})
photo=json.load(urllib.request.urlopen(request))['photo']
with manager.request():
 now[0]=901;assert manager.sleep_if_idle() is False
assert manager.sleep_if_idle();assert not state()['anyRunning']
manager.wake();assert state()['healthy']
assert urllib.request.urlopen('http://127.0.0.1:18099'+photo['url']).status==200
assert not manager.sleep_if_idle()
print('Actual Docker stop/wake, active-request barrier, health readiness and photo preservation passed')
