import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPhotoServer,photoKey,MAX_IMAGE_BYTES} from '../server/photos.mjs';
import {photoKey as clientKey,photoPrompt,setPhotos,findPhoto} from '../src/photo-catalog.ts';
const png=await readFile(new URL('../public/icons/icon-192.png',import.meta.url));
const image='data:image/png;base64,'+png.toString('base64');
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'osud-photos-'));let server;
 async function start(){server=await createPhotoServer({directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
 async function stop(){await new Promise(r=>server.close(r));}
 let url=await start();t.after(async()=>{await stop();await rm(directory,{recursive:true,force:true});});
 return {directory,get url(){return url;},restart:async()=>{await stop();url=await start();},post:(body,headers={})=>fetch(url+'/api/photos',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})};
}
test('photo keys preserve meaning, ignore accents/case, and prompt requests separate images',()=>{
 for(const text of [' UMYŤ sa ','zostať špinavý','umyť len zuby','PS5','constructor'])assert.equal(photoKey(text),clientKey(text));
 assert.equal(photoKey(' UMYŤ   sa '),'umyt sa');assert.notEqual(photoKey('umyť sa'),photoKey('neumyť sa'));
 const prompt=photoPrompt(['umyť sa','zostať špinavý','umyť len zuby']);assert.match(prompt,/nie ako koláž/);assert.match(prompt,/3\. "umyť len zuby"/);
 setPhotos([{key:'umyt sa',label:'Umyť sa',url:'javascript:alert(1)'}]);assert.equal(findPhoto('umyt sa'),undefined);
});
test('upload, retrieve, restart, replace and share photos across normalized labels',async t=>{
 const f=await fixture(t);const response=await f.post({label:'Umyť sa',image});assert.equal(response.status,201);
 const {photo}=await response.json();const file=await fetch(f.url+photo.url);assert.equal(file.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await file.arrayBuffer()),png);
 await f.restart();let data=await (await fetch(f.url+'/api/photos')).json();assert.equal(data.photos.length,1);setPhotos(data.photos);assert.equal(findPhoto('UMYT SA').url,photo.url);
 const replacement=await readFile(new URL('../public/icons/icon-512.png',import.meta.url));
 assert.equal((await f.post({label:'umyt sa',image:'data:image/png;base64,'+replacement.toString('base64')})).status,201);
 data=await (await fetch(f.url+'/api/photos')).json();assert.equal(data.photos.length,1);assert.notEqual(data.photos[0].url,photo.url);
 assert.equal((await fetch(f.url+photo.url)).status,404);
});
test('concurrent imports preserve both labels and reject unsafe or invalid requests',async t=>{
 const f=await fixture(t);await Promise.all(['prvy','druhy'].map(async label=>assert.equal((await f.post({label,image})).status,201)));
 assert.equal((await (await fetch(f.url+'/api/photos')).json()).photos.length,2);
 assert.equal((await f.post({label:'x',image},{Origin:'https://foreign.example'})).status,403);
 assert.equal((await f.post({label:'x',image:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
 assert.equal((await f.post({label:'x',image:'data:image/png;base64,aGVsbG8='})).status,400);
 assert.equal((await f.post({label:'x'.repeat(41),image})).status,400);
 assert.equal((await f.post({label:'!!!',image})).status,400);
 assert.equal((await fetch(f.url+'/api/photos/file/photos.json')).status,404);
 const bytes=Buffer.alloc(MAX_IMAGE_BYTES+1);png.copy(bytes,0,0,24);
 assert.equal((await f.post({label:'large',image:'data:image/png;base64,'+bytes.toString('base64')})).status,413);
});
test('damaged database fails safely without overwriting it',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'osud-broken-'));try{await writeFile(join(directory,'photos.json'),'broken');await assert.rejects(createPhotoServer({directory}));assert.equal(await readFile(join(directory,'photos.json'),'utf8'),'broken');}finally{await rm(directory,{recursive:true,force:true});}
});
