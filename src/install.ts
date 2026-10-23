type InstallPrompt = Event & {prompt:()=>Promise<void>; userChoice:Promise<{outcome:string}>};
export function setupInstall(){
  const dialog=document.querySelector<HTMLDialogElement>('#install-dialog')!;
  const instructions=document.querySelector<HTMLElement>('#install-instructions')!;
  const status=document.querySelector<HTMLElement>('#install-status')!;
  const install=document.querySelector<HTMLButtonElement>('#native-install')!;
  const update=document.querySelector<HTMLButtonElement>('#pwa-update')!;
  let prompt:InstallPrompt|null=null;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?:boolean}).standalone===true;
  function render(){
    install.hidden=!prompt||standalone();
    if(standalone()){instructions.innerHTML='<p>Osud už máš otvorený ako aplikáciu z plochy.</p>';return;}
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    if(prompt)instructions.innerHTML='<p>Stlač Nainštalovať Osud. Na ploche pribudne vlastná ikona a aplikácia sa otvorí v samostatnom okne.</p>';
    else if(ios)instructions.innerHTML='<p>Otvor Osud v Safari. Stlač Zdieľať → Pridať na plochu → Pridať. Ak prehliadač ponúkne Otvárať ako webovú aplikáciu, zapni túto voľbu.</p>';
    else instructions.innerHTML='<p>Na mobile otvor menu prehliadača ⋮ → Pridať na plochu alebo Nainštalovať aplikáciu. Na počítači otvor menu Chrome/Edge → Prenášať, uložiť a zdieľať → Vytvoriť odkaz alebo Nainštalovať túto stránku ako aplikáciu. Názov položky závisí od prehliadača.</p>';
    if(!window.isSecureContext)instructions.innerHTML+='<p>Na tejto HTTP adrese môže prehliadač vytvoriť iba odkaz. Plná inštalácia a offline režim vyžadujú HTTPS. Odkaz otvorí Osud, keď máš spojenie so serverom; mimo domu aj zapnutý Tailscale.</p>';
    else if(!prompt)instructions.innerHTML+='<p>Ak sa inštalácia neponúka, použi pridanie odkazu v menu prehliadača. Po prvom načítaní sa pripravuje aj používanie offline.</p>';
    instructions.innerHTML+='<p>Uložené dilemy zostávajú v tomto prehliadači a na tejto adrese. Domáca IP a Tailscale IP majú samostatné úložisko.</p>';
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event as InstallPrompt;render();});
  window.addEventListener('appinstalled',()=>{prompt=null;render();status.textContent='Osud bol pridaný medzi aplikácie.';});
  document.querySelector('#install-app')!.addEventListener('click',()=>{
    document.querySelector<HTMLButtonElement>('#appearance-toggle')!.click();render();dialog.showModal();
  });
  document.querySelector('#close-install')!.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  install.addEventListener('click',async()=>{
    const current=prompt;if(!current)return;install.disabled=true;
    try{await current.prompt();const choice=await current.userChoice;status.textContent=choice.outcome==='accepted'?'Inštalácia bola potvrdená.':'Inštaláciu môžeš skúsiť neskôr cez menu prehliadača.';}
    catch{status.textContent='Použi pridanie na plochu v menu prehliadača.';}
    finally{prompt=null;install.disabled=false;render();}
  });
  if('serviceWorker' in navigator && window.isSecureContext){
    let reloading=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
    void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>{
      const offer=()=>{if(registration.waiting && navigator.serviceWorker.controller)update.hidden=false;};
      offer();registration.addEventListener('updatefound',()=>{registration.installing?.addEventListener('statechange',offer);});
      update.addEventListener('click',()=>{if(registration.waiting){reloading=true;registration.waiting.postMessage('SKIP_WAITING');}});
    }).catch(()=>{status.textContent='Offline režim sa zatiaľ nepodarilo pripraviť. Osud môžeš používať online.';});
  }
}
