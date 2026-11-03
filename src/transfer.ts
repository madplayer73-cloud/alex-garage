/** Browser data only; image storage stays on CasaOS and is never exported here. */
export function setupTransfer(){
 const keys=['osud-v1','osud-dilemmas-v1','osud-theme','osud-skin'];
 const menu=document.querySelector('#appearance-menu')!;
 const download=document.createElement('button'),upload=document.createElement('button');
 download.className=upload.className='appearance-help';
 download.textContent='Export dilem a histórie';upload.textContent='Import dilem a histórie';
 const input=document.createElement('input');input.type='file';input.accept='application/json';input.hidden=true;
 const message=document.createElement('p');message.setAttribute('role','status');message.className='appearance-note';
 menu.append(download,upload,input,message);
 download.onclick=()=>{
  try{
   const values=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
   const blob=new Blob([JSON.stringify({format:'osud-browser-backup-v1',values},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='osud-dilemy-historia.json';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);message.textContent='Export obsahuje tvoje dilemy a históriu. Uchovaj ho súkromne.';
  }catch{message.textContent='Export sa nepodaril. Skontroluj dostupnosť úložiska prehliadača.';}
 };
 upload.onclick=()=>input.click();
 input.onchange=async()=>{
  const file=input.files?.[0];if(!file)return;
  try{
   if(file.size>1024*1024)throw Error();
   const data=JSON.parse(await file.text());if(data.format!=='osud-browser-backup-v1'||!data.values||typeof data.values!=='object')throw Error();
   for(const key of keys){const value=data.values[key];if(value!==null&&typeof value!=='string')throw Error();
    if(value!==null&&['osud-v1','osud-dilemmas-v1'].includes(key))JSON.parse(value);
   }
   if(!confirm('Import nahradí dilemy, históriu a vzhľad v tomto prehliadači. Máš ich exportované?'))return;
   const previous=keys.map(key=>[key,localStorage.getItem(key)] as const);
   try{for(const key of keys){const value=data.values[key];if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}}
   catch(error){for(const [key,value] of previous){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}throw error;}
   location.reload();
  }catch{message.textContent='Import sa nepodaril. Použi platný export Osudu do 1 MB a dostupné úložisko.';}
  finally{input.value='';}
 };
}
