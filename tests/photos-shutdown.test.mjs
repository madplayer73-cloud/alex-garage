import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import http from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('SIGTERM finishes an accepted partial upload and preserves database', {timeout:15000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'osud-shutdown-'));
 const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const child=spawn(process.execPath,['server/photos.mjs'],{env:{...process.env,PORT:String(port),PHOTO_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 const exited=once(child,'exit');
 try{
  await Promise.race([once(child.stdout,'data'),exited.then(()=>{throw Error('server exited before ready');})]);
  const image=await readFile(new URL('../public/icons/icon-192.png',import.meta.url));
  const body=JSON.stringify({label:'shutdown persistence',image:'data:image/png;base64,'+image.toString('base64')});
  let request;
  const result=new Promise((resolve,reject)=>{
   request=http.request({hostname:'127.0.0.1',port,path:'/api/photos',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())}));
   });request.on('error',reject);
  });
  request.write(body.slice(0,body.length/2));
  await new Promise(resolve=>setTimeout(resolve,150));
  child.kill('SIGTERM');
  await new Promise(resolve=>setTimeout(resolve,150));
  request.end(body.slice(body.length/2));
  const response=await result;assert.equal(response.status,201);
  const [code,signal]=await exited;assert.equal(code,0);assert.equal(signal,null);
  const db=JSON.parse(await readFile(join(directory,'photos.json'),'utf8'));
  assert.equal(db['shutdown persistence'].label,'shutdown persistence');
  assert.deepEqual(await readFile(join(directory,db['shutdown persistence'].file)),image);
 }finally{
  if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}
  await rm(directory,{recursive:true,force:true});
 }
});
