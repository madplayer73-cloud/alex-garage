
const CACHE="osud-pwa-0868f2df645872f3";
const FILES=["/assets/activities-B2Hs7RRA.png","/assets/food-a-Dgfo6kP8.png","/assets/food-b-CzLiPeJZ.png","/assets/index-CZXzc0ui.css","/assets/index-Z_EuQo7R.js","/assets/objects-eYLyte99.png","/icons/icon-180.png","/icons/icon-192.png","/icons/icon-512.png","/icons/icon.svg","/index.html","/manifest.webmanifest"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('osud-pwa-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate')event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));
 else if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request,{ignoreVary:true}))||fetch(request)));
});
