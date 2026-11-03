/** Optional dedicated gateway. Standalone CasaOS builds still work without it. */
export function setupPower(){
 let enabled=false,lastSent=-Infinity,pending=false;
 const headers={'X-Osud-Interaction':'1'};
 const status=document.createElement('p');status.id='power-status';status.setAttribute('role','status');
 document.querySelector('.stage-toolbar')?.append(status);
 async function call(action:string){
  return fetch('/_osud_power/'+action,{method:'POST',headers,cache:'no-store',signal:AbortSignal.timeout(100000)});
 }
 async function wake(){
  if(pending)return;pending=true;
  try{
   status.textContent='Prebúdzam Osud…';const response=await call('wake');
   if(response.status===401){location.assign('/oauth2/sign_in?rd=%2F');return;}
   if(!response.ok)throw Error();status.textContent='';return true;
  }catch{status.textContent='Server sa nepodarilo prebudiť. Obnov stránku a skús znova.';}
  finally{pending=false;}
 }
 // One capability check per page load, never a heartbeat or status polling loop.
 void fetch('/_osud_power/status',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{
  if(response.status===401&&location.protocol==='https:'){location.assign('/oauth2/sign_in?rd=%2F');return;}
  if(!response.ok)return;
  const value=await response.json();enabled=value.idleLimit===900;
  if(enabled&&!document.hidden)await wake();
 }).catch(()=>{});
 async function activity(event:Event){
  if(!enabled||!event.isTrusted||document.hidden||!document.hasFocus()||pending)return;
  const now=performance.now();if(now-lastSent<5000)return;lastSent=now;
  try{const response=await call('activity');
   if(response.status===409){if(await wake())status.textContent='Osud je prebudený. Pokračuj vo svojej akcii.';}
   else if(response.status===401)location.assign('/oauth2/sign_in?rd=%2F');
  }catch{/* Next genuine interaction or navigation can retry. Never replay writes. */}
 }
 for(const event of ['pointerdown','keydown','wheel','touchstart'])document.addEventListener(event,activity,{passive:true,capture:true});
 document.addEventListener('visibilitychange',()=>{if(enabled&&!document.hidden)void wake();});
}
