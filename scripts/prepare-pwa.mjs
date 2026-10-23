import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url);
async function files(dir,prefix=''){
 const result=[];
 for(const file of await readdir(dir,{withFileTypes:true})){
  if(file.isDirectory())result.push(...await files(new URL(file.name+'/',dir),prefix+file.name+'/'));
  else if(file.name!=='sw.js')result.push(prefix+file.name);
 }
 return result;
}
const names=(await files(root)).sort();
const hash=createHash('sha256');
for(const name of names)hash.update(name).update(await readFile(new URL(name,root)));
const cache='osud-pwa-'+hash.digest('hex').slice(0,16);
await writeFile(new URL('sw.js',root),`
const CACHE=${JSON.stringify(cache)};
const FILES=${JSON.stringify(names.map(n=>'/'+n))};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('osud-pwa-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate')event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));
 else if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request,{ignoreVary:true}))||fetch(request)));
});
`);
console.log('PWA prepared:',cache);
