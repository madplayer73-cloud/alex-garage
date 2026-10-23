import {restoreDilemmas,validateChoices,MAX_DILEMMAS,type Dilemma,type SavedChoice} from './dilemmas';
const KEY='osud-dilemmas-v1';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function setupLibrary(options:{snapshot:()=>{question:string;choices:SavedChoice[]};load:(d:Dilemma,edit:boolean)=>boolean;busy:()=>boolean}) {
  let entries:Dilemma[]=[];
  let selected:string|null=null;
  try{entries=restoreDilemmas(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch{/* Empty library when storage is unavailable. */}
  const list=document.querySelector<HTMLElement>('#my-dilemmas')!;
  const status=document.querySelector<HTMLElement>('#library-status')!;
  const dialog=document.querySelector<HTMLDialogElement>('#save-dialog')!;
  const name=document.querySelector<HTMLInputElement>('#save-name')!;
  const update=document.querySelector<HTMLButtonElement>('#update-dilemma')!;
  const error=document.querySelector<HTMLElement>('#save-error')!;
  function render(){
    list.innerHTML=entries.length?entries.map(d=>`<article class="saved-dilemma"><button data-load="${escape(d.id)}"><strong>${escape(d.question)}</strong><span>${d.choices.map(c=>escape(c.label)).join(' · ')}</span></button><div><button data-edit="${escape(d.id)}" aria-label="Upraviť ${escape(d.question)}">Upraviť</button><button data-delete="${escape(d.id)}" aria-label="Odstrániť ${escape(d.question)}">Odstrániť</button></div></article>`).join(''):'<p class="library-empty">Svoje obľúbené možnosti si ulož tlačidlom Uložiť dilemu.</p>';
  }
  function write(next:Dilemma[]){
    try{localStorage.setItem(KEY,JSON.stringify(next));entries=next;render();return true;}
    catch{error.textContent='Uloženie sa nepodarilo. Prehliadač nemá dostupné miesto alebo nepovoľuje ukladanie.';status.textContent=error.textContent;return false;}
  }
  document.querySelector('#save-dilemma')!.addEventListener('click',()=>{
    if(options.busy())return;
    const snapshot=options.snapshot();
    if(!validateChoices(snapshot.choices)){status.textContent='Najprv vyplň 2 až 5 rôznych možností, každú do 40 znakov.';return;}
    name.value=snapshot.question||'Moja dilema';error.textContent='';
    update.hidden=!entries.some(d=>d.id===selected);
    dialog.showModal();name.focus();name.select();
  });
  function save(overwrite:boolean){
    const snapshot=options.snapshot();const question=name.value.trim();
    if(!question){error.textContent='Daj dileme krátky názov alebo otázku.';name.focus();return;}
    if(!validateChoices(snapshot.choices)){error.textContent='Možnosti už nie sú platné. Zavri okno a skontroluj ich.';return;}
    if(!overwrite && entries.length>=MAX_DILEMMAS){error.textContent=`Môžeš mať najviac ${MAX_DILEMMAS} dilem. Niektorú odstráň alebo aktualizuj.`;return;}
    const id=overwrite&&selected?selected:`d-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    const dilemma={id,question,choices:structuredClone(snapshot.choices)};
    const next=overwrite?entries.map(d=>d.id===id?dilemma:d):[...entries,dilemma];
    if(write(next)){selected=id;dialog.close();status.textContent=overwrite?'Zmeny dilemy sú uložené.':'Dilema je uložená v tomto prehliadači.';}
  }
  document.querySelector('#save-form')!.addEventListener('submit',e=>{e.preventDefault();save(false);});
  update.addEventListener('click',()=>save(true));
  document.querySelector('#close-save')!.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  list.addEventListener('click',e=>{
    const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||options.busy())return;
    const id=button.dataset.load??button.dataset.edit??button.dataset.delete;const dilemma=entries.find(d=>d.id===id);if(!dilemma)return;
    if(button.dataset.delete){if(write(entries.filter(d=>d.id!==id))){if(selected===id)selected=null;status.textContent='Dilema bola odstránená zo zoznamu.';}return;}
    if(!options.load(structuredClone(dilemma),button.dataset.edit!==undefined))return;selected=dilemma.id;
    status.textContent=button.dataset.edit?'Uprav možnosti alebo otázku a cez Uložiť dilemu ulož zmeny či novú verziu.':'Dilema je pripravená.';
  });
  render();
  return {detach:()=>{selected=null;}};
}
