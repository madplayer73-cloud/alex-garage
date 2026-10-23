import http from 'node:http';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const MAX_IMAGE_BYTES=6*1024*1024;
export function photoKey(label){return label.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('sk').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
function fault(status,message){return Object.assign(new Error(message),{status});}
function decodeImage(data){
 if(typeof data!=='string')throw fault(400,'Vyber obrázok PNG, JPEG alebo WebP.');
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match)throw fault(400,'Podporované sú PNG, JPEG a WebP.');
 const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>MAX_IMAGE_BYTES)throw fault(413,'Obrázok môže mať najviac 6 MB.');
 const kind=match[1];
 const valid=kind==='png'?bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):kind==='jpeg'?bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.length>=16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid)throw fault(400,'Súbor nie je platný obrázok v uvedenom formáte.');
 return {bytes,kind};
}
export async function createPhotoServer({directory}){
 await mkdir(directory,{recursive:true});
 const db=join(directory,'photos.json');let entries={};
 try{entries=JSON.parse(await readFile(db,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!entries||Array.isArray(entries)||typeof entries!=='object'||Object.entries(entries).some(([key,e])=>!e||typeof e.label!=='string'||photoKey(e.label)!==key||!/^([a-f0-9]{64})\.(png|jpeg|webp)$/.test(e.file)))throw new Error('Poškodená databáza fotografií; pôvodné súbory zostali zachované.');
 let queue=Promise.resolve();
 const serialize=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
 const publicEntry=([key,e])=>({key,label:e.label,url:'/api/photos/file/'+e.file});
 const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 return http.createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(req.method==='GET'&&path==='/api/photos/health'){send(res,200,{ok:true});return;}
   if(req.method==='GET'&&path==='/api/photos'){send(res,200,{photos:Object.entries(entries).map(publicEntry)});return;}
   if(req.method==='GET'&&path.startsWith('/api/photos/file/')){
    const file=path.slice('/api/photos/file/'.length);
    if(!/^[a-f0-9]{64}\.(png|jpeg|webp)$/.test(file)||!Object.values(entries).some(e=>e.file===file))throw fault(404,'Obrázok sa nenašiel.');
    let bytes;try{bytes=await readFile(join(directory,file));}catch{throw fault(404,'Obrázok sa nenašiel.');}
    res.writeHead(200,{'Content-Type':'image/'+file.split('.').at(-1),'Content-Length':bytes.length,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});res.end(bytes);return;
   }
   if(req.method!=='POST'||path!=='/api/photos')throw fault(404,'Neznáma požiadavka.');
   if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw fault(403,'Neplatný pôvod požiadavky.');}if(!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host)throw fault(403,'Import otvor priamo v aplikácii Osud.');}
   if(!(req.headers['content-type']||'').startsWith('application/json'))throw fault(415,'Očakáva sa JSON.');
   const chunks=[];let size=0;const maxBody=MAX_IMAGE_BYTES*4/3+4096;
   for await(const chunk of req){size+=chunk.length;if(size>maxBody)throw fault(413,'Obrázok môže mať najviac 6 MB.');chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fault(400,'Neplatný import.');}
   if(typeof body?.label!=='string'||!body.label.trim()||body.label.length>40)throw fault(400,'Výraz musí mať 1 až 40 znakov.');
   const label=body.label.trim(),key=photoKey(label);if(!key)throw fault(400,'Výraz musí obsahovať písmeno alebo číslo.');
   const {bytes,kind}=decodeImage(body.image),file=createHash('sha256').update(bytes).digest('hex')+'.'+kind;
   const photo=await serialize(async()=>{
    if(!Object.hasOwn(entries,key)&&Object.keys(entries).length>=200)throw fault(409,'Databáza má limit 200 výrazov. Existujúcemu výrazu môžeš obrázok nahradiť.');
    const temp=join(directory,randomUUID()+'.tmp');await writeFile(temp,bytes);await rename(temp,join(directory,file));
    const next={...entries,[key]:{label,file}},old=entries[key]?.file;
    const dbtemp=join(directory,randomUUID()+'.json.tmp');await writeFile(dbtemp,JSON.stringify(next,null,2));await rename(dbtemp,db);entries=next;
    if(old&&old!==file&&!Object.values(entries).some(e=>e.file===old))await unlink(join(directory,old)).catch(()=>{});
    return publicEntry([key,entries[key]]);
   });send(res,201,{photo});
  }catch(error){if(!res.headersSent)send(res,error.status||500,{error:error.status?error.message:'Import sa nepodarilo uložiť na server. Skontroluj úložisko.'});else res.end();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=await createPhotoServer({directory:process.env.PHOTO_DATA_DIR||'/data'});
 server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Osud photo storage ready'));
}
