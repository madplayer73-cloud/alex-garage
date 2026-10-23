import {findPhoto,getPhotos,setPhotos,photoKey,photoPrompt} from './photo-catalog';
import {suggestEmoji} from './emoji';
import {symbolLocation} from './symbols';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function setupPhotoImport(options:{labels:()=>string[];changed:()=>void;busy:()=>boolean}){
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
 const dialog=$<HTMLDialogElement>('#photo-dialog'),label=$<HTMLInputElement>('#photo-label'),file=$<HTMLInputElement>('#photo-file');
 const prompt=$<HTMLTextAreaElement>('#photo-prompt'),status=$('#photo-status'),submit=$<HTMLButtonElement>('#photo-upload');
 let data='',uploading=false,loadSequence=0,serverReady=false;
 function missing(){return [...new Map(options.labels().map(text=>[photoKey(text),text.trim()])).values()].filter(text=>text&&photoKey(text)&&!findPhoto(text)&&(suggestEmoji(text)==='✨'||!symbolLocation(suggestEmoji(text)).known));}
 function refresh(){
  const words=missing();
  $('#missing-photos').hidden=!words.length;
  $('#missing-photo-note').textContent=words.length?`V databáze chýba obrázok: ${words.join(' · ')}`:'';
  $('#photo-missing-list').innerHTML=words.length?words.map(text=>`<button type="button" data-photo-word="${escape(text)}">${escape(text)}</button>`).join(''):'<p>Aktuálne možnosti už majú obrázok. Vlastnú fotografiu môžeš pridať aj k inému výrazu.</p>';
  prompt.value=photoPrompt(words.length?words:[label.value.trim()||'SEM NAPÍŠ VÝRAZ']);
  $('#photo-catalog').innerHTML=getPhotos().map(photo=>`<button type="button" data-photo-word="${escape(photo.label)}"><img src="${photo.url}" alt=""><span>${escape(photo.label)}</span></button>`).join('')||'<p>Zatiaľ tu nie sú vlastné obrázky.</p>';
  $('#photo-replace-note').textContent=findPhoto(label.value)?'Tento výraz už má vlastný obrázok. Nahratím ho nahradíš pre všetky zariadenia.':'';
  submit.disabled=uploading||!serverReady||!data||!photoKey(label.value);
 }
 async function sync(){
  try{const response=await fetch('/api/photos',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const payload=await response.json();if(!Array.isArray(payload.photos))throw Error();setPhotos(payload.photos);serverReady=true;options.changed();}
  catch{serverReady=false;status.textContent='Úložisko obrázkov nie je dostupné. Skontroluj spojenie so serverom alebo aktualizáciu CasaOS.';}
  refresh();
 }
 function open(){
  if(options.busy())return;
  if($('#appearance-menu').hidden===false)$('#appearance-toggle').click();
  loadSequence++;const words=missing();label.value=words[0]||options.labels().find(Boolean)||'';status.textContent='';data='';file.value='';$('#photo-preview').hidden=true;
  refresh();dialog.showModal();void sync();
 }
 $('#photo-menu').addEventListener('click',open);$('#open-photo-import').addEventListener('click',open);
 $('#photo-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog&&!uploading)dialog.close();});
 for(const target of ['#photo-missing-list','#photo-catalog'])$(target).addEventListener('click',e=>{
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-photo-word]');if(!button||uploading)return;
  loadSequence++;label.value=button.dataset.photoWord!;data='';file.value='';$('#photo-preview').hidden=true;refresh();
 });
 label.addEventListener('input',refresh);
 $('#photo-copy').addEventListener('click',async()=>{
  try{if(!navigator.clipboard)throw Error();await navigator.clipboard.writeText(prompt.value);status.textContent='Prompt je skopírovaný. Vlož ho do AI, ktorú používaš.';}
  catch{prompt.focus();prompt.select();const copied=document.execCommand('copy');status.textContent=copied?'Prompt je skopírovaný.':'Text je označený. Skopíruj ho cez Ctrl+C alebo podržaním na mobile.';}
 });
 file.addEventListener('change',async()=>{
  const sequence=++loadSequence,selected=file.files?.[0];data='';$('#photo-preview').hidden=true;status.textContent='';refresh();if(!selected)return;
  if(!['image/png','image/jpeg','image/webp'].includes(selected.type)){status.textContent='Použi PNG, JPEG alebo WebP. Snímka obrazovky vo formáte PNG je vhodná.';return;}
  if(selected.size>6*1024*1024){status.textContent='Obrázok môže mať najviac 6 MB.';return;}
  try{
   const result=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(selected);});
   const image=new Image();image.src=result;await image.decode();if(image.width*image.height>40000000)throw Error();if(sequence!==loadSequence)return;
   data=result;$<HTMLImageElement>('#photo-preview').src=result;$('#photo-preview').hidden=false;
  }catch{status.textContent='Obrázok sa nedá načítať alebo je príliš veľký. Vyber iný súbor.';}
  refresh();
 });
 $('#photo-form').addEventListener('submit',async e=>{
  e.preventDefault();if(uploading||!data||!serverReady||!photoKey(label.value))return;
  uploading=true;refresh();label.disabled=true;file.disabled=true;$('#photo-close').setAttribute('disabled','');status.textContent='Ukladám obrázok na server…';
  try{
   const response=await fetch('/api/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:label.value.trim(),image:data}),signal:AbortSignal.timeout(30000)});
   const payload=await response.json();if(!response.ok)throw Error(payload.error||'Import sa nepodaril.');
   setPhotos([...getPhotos().filter(p=>p.key!==payload.photo.key),payload.photo]);options.changed();
   data='';file.value='';$('#photo-preview').hidden=true;status.textContent='Obrázok je uložený na CasaOS. K tomuto výrazu sa teraz priradí automaticky na všetkých zariadeniach.';
  }catch(error){status.textContent=error instanceof Error?error.message:'Import sa nepodaril. Skús to znovu.';}
  finally{uploading=false;label.disabled=false;file.disabled=false;$('#photo-close').removeAttribute('disabled');refresh();}
 });
 dialog.addEventListener('cancel',e=>{if(uploading)e.preventDefault();});
 void sync();
 return {refresh};
}
