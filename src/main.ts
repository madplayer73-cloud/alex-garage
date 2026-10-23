import './style.css';
import './skins.css';
import './features.css';
import { setupLibrary } from './library';
import { setupInstall } from './install';
import { symbol } from './symbols';
import { setupAppearance } from './appearance';
import { emojiOptions, suggestEmoji } from './emoji';
import { newRound, restoreRound, spinRound, toggleHold, canHold, winningChoice } from './round';

type Choice = { label: string; emoji: string; manualEmoji?: boolean };
type Verdict = Choice & { time: string; attempts?: number };
const presets: Record<string, Choice[]> = {
  evening: [{label:'Dať si víno',emoji:'🍷'},{label:'Ísť si zacvičiť',emoji:'🏋️'},{label:'Pozrieť si film',emoji:'🍿'}],
  cooking: [{label:'Špagety',emoji:'🍝'},{label:'Kuracie kari',emoji:'🍛'},{label:'Palacinky',emoji:'🥞'}],
  food: [{label:'Pizza',emoji:'🍕'},{label:'Sushi',emoji:'🍣'},{label:'Uvariť si doma',emoji:'🍳'}],
  weekend: [{label:'Výlet do prírody',emoji:'🌲'},{label:'Káva v meste',emoji:'☕'},{label:'Zostať doma',emoji:'🛋️'}],
  gaming: [{label:'Zahrať si PS5',emoji:'🎮'},{label:'Čítať knihu',emoji:'📚'},{label:'Pozrieť si seriál',emoji:'🍿'}],
  productivity: [{label:'Pracovať',emoji:'💻'},{label:'Kódovať',emoji:'💻'},{label:'Učiť sa',emoji:'📖'}],
  movement: [{label:'Ísť behať',emoji:'🏃'},{label:'Ísť na bicykel',emoji:'🚲'},{label:'Zacvičiť si jogu',emoji:'🧘'}],
  drinks: [{label:'Káva',emoji:'☕'},{label:'Čaj',emoji:'🍵'},{label:'Limonáda',emoji:'🥤'}],
  breakfast: [{label:'Vajíčka',emoji:'🍳'},{label:'Palacinky',emoji:'🥞'},{label:'Sendvič',emoji:'🥪'}],
  relax: [{label:'Počúvať hudbu',emoji:'🎵'},{label:'Čítať knihu',emoji:'📚'},{label:'Oddychovať',emoji:'🛋️'}],
  sweets: [{label:'Zmrzlina',emoji:'🍦'},{label:'Koláč',emoji:'🍰'},{label:'Čokoláda',emoji:'🍫'}],
  chores: [{label:'Upratovať',emoji:'🧹'},{label:'Nakupovať',emoji:'🛍️'},{label:'Variť',emoji:'🍳'}],
};
const icons = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 6 6m0-6-6 6"/></svg>',
};
function readStore(): { choices?: Choice[]; history?: Verdict[]; sound?: boolean; question?: string; nextMode?: 'chance' | 'hold'; round?: unknown; roundChoices?: string } {
  try { return JSON.parse(localStorage.getItem('osud-v1') || '{}') || {}; } catch { return {}; }
}
const saved = readStore();
let choices = Array.isArray(saved.choices) && saved.choices.length >= 2 && saved.choices.length <= 5 && saved.choices.every(c => typeof c?.label === 'string' && typeof c?.emoji === 'string') ? saved.choices.map(c=>({label:c.label.slice(0,40),emoji:c.manualEmoji && (emojiOptions.includes(c.emoji) || suggestEmoji(c.emoji)===c.emoji) ? c.emoji : suggestEmoji(c.label),manualEmoji:c.manualEmoji===true})) : structuredClone(presets.evening);
let history: Verdict[] = Array.isArray(saved.history) ? saved.history.filter(v=>typeof v?.label==='string' && typeof v?.emoji==='string' && typeof v?.time==='string').slice(0,5).map(v=>({...v,attempts:typeof v.attempts==='number' && Number.isInteger(v.attempts) && v.attempts>=1 && v.attempts<=3 ? v.attempts : undefined})) : [];
let sound = saved.sound !== false;
let question = typeof saved.question==='string'?saved.question.slice(0,80):'';
function choiceSignature() { return JSON.stringify(choices.map(({label,emoji})=>({label,emoji}))); }
let round = saved.roundChoices === choiceSignature() ? restoreRound(saved.round, choices.length) : newRound();
let nextMode = saved.nextMode === 'chance' || saved.nextMode === 'hold' ? saved.nextMode : round.mode;
let spinning = false;
let audio: AudioContext | undefined;
function persist() { try { localStorage.setItem('osud-v1',JSON.stringify({choices,history,sound,question,nextMode,round,roundChoices:choiceSignature()})); } catch { /* Private browsing may disable storage. */ } }
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="header"><a class="brand" href="./" aria-label="Osud — úvod"><span class="brand-symbol">✳</span> osud<span class="brand-dot">.</span></a><span class="header-note">PRE VŠETKY TVOJE „ALEBO“.</span><div class="header-actions"><button id="help" class="text-button">Ako to funguje <span class="diagonal-arrow" aria-hidden="true"></span></button><span class="header-divider"></span><button id="sound" class="sound-button" aria-label="Vypnúť zvuk"></button><div class="appearance-control"><button id="appearance-toggle" class="menu-toggle" aria-label="Otvoriť menu" aria-expanded="false" aria-controls="appearance-menu" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/></svg></button><section id="appearance-menu" class="appearance-menu" role="dialog" aria-label="Nastavenia vzhľadu" hidden><div class="appearance-heading"><span>PO TVOJOM</span><h2>Vzhľad aplikácie</h2></div><fieldset class="theme-picker"><legend>Farebný režim</legend><label class="theme-option"><input type="radio" name="theme" value="dark"><span class="theme-preview preview-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/></svg><span></span></span><span class="theme-name">Dark <small>Tmavý</small></span><span class="theme-check" aria-hidden="true">✓</span></label><label class="theme-option"><input type="radio" name="theme" value="light"><span class="theme-preview preview-light"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><span></span></span><span class="theme-name">Light <small>Svetlý</small></span><span class="theme-check" aria-hidden="true">✓</span></label></fieldset><fieldset class="skin-picker"><legend>Vzhľad mašiny</legend>${[['studio','Studio','Grafit a meď'],['retro','Retro','Chróm a smalt'],['minimal','Minimal','Pokoj a priestor'],['playful','Hravý','Farebné emoji']].map(([id,title,desc])=>`<label class="skin-option"><input type="radio" name="skin" value="${id}"><span class="skin-swatch swatch-${id}" aria-hidden="true">▥</span><span>${title}<small>${desc}</small></span></label>`).join('')}</fieldset><fieldset class="mode-picker"><legend>Pravidlá novej dilemy</legend><label><input type="radio" name="game-mode" value="chance"> Čistá náhoda</label><label><input type="radio" name="game-mode" value="hold"> Hra s podržaním</label><p id="mode-note" role="status"></p><button id="apply-game-mode" class="apply-game-mode" hidden>Začať novú dilemu v tomto režime</button></fieldset><button id="install-app" class="appearance-help">Pridať na plochu ↗</button><button id="pwa-update" class="appearance-help" hidden>Aktualizovať aplikáciu</button><button id="menu-sound" class="appearance-help"></button><p class="appearance-note">Vzhľad môžeš meniť aj počas hry.</p><button id="appearance-help" class="appearance-help">Ako funguje osud <span class="diagonal-arrow" aria-hidden="true"></span></button></section></div></div></header>
  <main>
    <section class="intro"><div class="eyebrow"><span class="live-dot"></span> MENEJ PREMÝŠĽANIA. VIAC ŽIVOTA.</div><h1>Ťažké rozhodnutie? <br>Nechaj to na <em>osud.</em><span class="title-spark">✳</span></h1><p>Víno alebo fitko? Pizza alebo sushi? Pridaj svoje možnosti.<br class="desktop-break"> Najviac tri pokusy. Jedno rozhodnutie. Tvoj ďalší krok.</p></section>
    <section class="playground" aria-label="Automat na rozhodovanie">
      <aside class="choices-panel"><div class="section-number">01 <span>TVOJE MOŽNOSTI</span></div><h2>Medzi čím váhaš?</h2><p class="panel-description">Daj na stôl všetky možnosti.</p><p class="input-hint">✦ Stačí písať. Ikonku vyberieme za teba.</p><div id="choices"></div><button id="add" class="add-button"><span>＋</span> Pridať možnosť <small>max. 5</small></button><div id="form-error" role="alert"></div><p id="round-lock-note" class="round-lock-note"></p><button id="edit-dilemma" class="edit-dilemma" hidden>Upraviť možnosti pre novú dilemu</button><div class="preset-area"><span class="tiny-label">ALEBO SKÚS HOTOVÚ DILEMU</span><div class="presets">${Object.entries({evening:'Sobotný večer',cooking:'Čo uvariť?',food:'Čo si dať?',weekend:'Voľný deň',gaming:'PS5 alebo…?',productivity:'Práca a tvorba',movement:'Ako sa hýbať?',drinks:'Čo piť?',breakfast:'Raňajky',relax:'Ako vypnúť?',sweets:'Niečo sladké',chores:'Čo vybaviť?'}).map(([id,title])=>`<button data-preset="${id}" class="preset">${title}</button>`).join('')}</div></div><div class="fair-note" id="fair-note"></div><button id="save-dilemma" class="save-dilemma">＋ Uložiť dilemu</button><p id="library-status" role="status"></p></aside>
      <div class="machine-area"><div class="machine-caption"><span class="section-number">02</span><span>NECHAJ PREHOVORIŤ NÁHODU</span><span class="caption-stars">✦ ✦ ✦</span></div><div class="question-box"><label for="question">TVOJA OTÁZKA <span>nepovinné · max. 80 znakov</span></label><input id="question" maxlength="80" placeholder="Čomu venujem dnešný večer?" value="${escape(question)}"></div><div class="game-mode"><span id="mode-label"></span><span>MAX. 3 POKUSY</span></div><div id="round-progress" class="round-progress" aria-label="Počet zatočení"></div><div class="machine-and-lever"><div class="machine"><div class="machine-top"><i class="screw"></i><span>AUTOMAT NA MALÉ DILEMY</span><i class="screw"></i></div><div class="machine-title">DOBRÉ <span>✳</span> MOŽNOSTI</div><div class="reels-frame"><span class="pointer left-pointer">▸</span><div class="reels" id="reels"></div><span class="pointer right-pointer">◂</span><div class="payline"></div></div><div id="hold-controls" class="hold-controls" aria-label="Podržanie valcov"></div><div class="machine-bottom"><span id="machine-state"><i></i> PRIPRAVENÝ NA TVOJ ŤAH</span><span class="machine-edition">Č. 001 / NEKONEČNO MOŽNOSTÍ</span></div></div><button class="lever" id="lever" aria-label="Zatiahnuť páku a roztočiť"><span class="lever-knob"></span><span class="lever-stem"></span><span class="lever-base"></span></button></div><div class="machine-shadow"></div><div class="spin-controls"><button class="spin-button" id="spin"><span class="spin-star">✳</span><span id="spin-label">Nech rozhodne osud</span>${icons.arrow}</button><span class="spin-hint">alebo potiahni páku <span class="diagonal-arrow" aria-hidden="true"></span></span><p id="hold-hint" class="hold-hint"></p></div><div id="result" class="result" role="status" aria-live="polite"><span class="result-icon">✧</span><div><strong>Vesmír čaká na tvoj ťah.</strong><p>Tvoje ďalšie dobrodružstvo je jedno zatočenie ďaleko.</p></div></div></div>
    </section>
    <section class="library-section"><h2>Moje dilemy</h2><p>Ulož si vlastné možnosti alebo si uprav hotovú predvoľbu. Ukladajú sa v tomto prehliadači.</p><div id="my-dilemmas"></div></section><section class="history-section"><div class="history-heading"><h2><span>↶</span> Posledné verdikty</h2><button id="clear-history" class="text-button">Vymazať históriu</button></div><div id="history"></div></section>
  </main><footer><a class="footer-brand" href="./">osud.</a><span>Trochu náhody. Celé rozhodnutie je stále na tebe.</span><span class="footer-right">VYROBENÉ PRE NEROZHODNÝCH <span>✳</span></span></footer>
  <dialog id="save-dialog" aria-labelledby="save-title"><button id="close-save" class="dialog-close" aria-label="Zavrieť ukladanie">×</button><h2 id="save-title">Uložiť dilemu</h2><form id="save-form"><label for="save-name">Názov alebo otázka</label><input id="save-name" maxlength="80" required autocomplete="off"><p id="save-error" role="alert"></p><button type="submit" class="save-dilemma">Uložiť ako novú</button><button type="button" id="update-dilemma" class="save-dilemma" hidden>Uložiť zmeny</button></form><p>V menu Moje dilemy ju otvoríš jedným kliknutím. Pôvodné predvoľby zostávajú dostupné.</p></dialog><dialog id="install-dialog" aria-labelledby="install-title"><button id="close-install" class="dialog-close" aria-label="Zavrieť pridanie na plochu">×</button><h2 id="install-title">Osud na ploche</h2><div id="install-instructions"></div><button id="native-install" class="save-dilemma" hidden>Nainštalovať Osud</button><p id="install-status" role="status"></p></dialog><dialog id="help-dialog"><button id="close-help" class="dialog-close" aria-label="Zavrieť">×</button><span class="dialog-symbol">✳</span><h2>Malý ťah. Veľké jasno.</h2><p>1. Napíš 2 až 5 možností, každú do 40 znakov. Ikonku priradíme automaticky podľa textu, aj bez diakritiky. Ak slovo nepoznáme, dostane neutrálny symbol. Označenie Auto znamená automatický výber podľa textu. Pri ručnej ikonke ho znovu zapneš tlačidlom Ručná. Kliknutím na ikonku si vyberieš inú.</p><p>2. Čistá náhoda: každá možnosť má rovnakú šancu. Prvé dva pokusy žrebujú tri valce samostatne. Trojica ukončí hru skôr. Ak nepadne, tretí pokus vyžrebuje jednu možnosť a zobrazí ju trikrát. Je to označené finálové žrebovanie.</p><p>3. Hra s podržaním: v menu si zvoľ tento režim. Ak už hráš, tlačidlo v menu otvorí novú dilemu so zachovanými možnosťami. Medzi pokusmi môžeš podržať jeden alebo dva rovnaké symboly. Podržaním ovplyvňuješ šance; tretí pokus dokončí podržanú možnosť. Bez podržania žrebuje rovnomerne.</p><p>4. Výsledok vyberá generátor náhody prehliadača pri zatočení. Animácia ho zobrazí. Každá dilema má najviac tri pokusy a rovnaký výsledok môže padnúť aj opakovane. Grafika nemení šance.</p><p>Verdikt aj roztočená dilema zostávajú uložené po obnovení stránky. Po verdikte veľké tlačidlo Nová dilema otvorí prázdne možnosti. Inú otázku môžeš začať aj výberom predvoľby, úpravou názvu alebo pridaním či odstránením možnosti. Počas roztočenej hry sú vlastné možnosti zamknuté; tlačidlo Upraviť možnosti začne novú dilemu.</p><p class="dialog-note">Je to hra s náhodou, nie rada. Ak ťa výsledok sklamal, možno už vieš, čo naozaj chceš.</p></dialog><dialog id="emoji-dialog" aria-labelledby="emoji-title"><button id="close-emoji" class="dialog-close" aria-label="Zavrieť výber ikonky">×</button><h2 id="emoji-title">Aká ikonka sa hodí?</h2><p>Vyber si vlastnú alebo to nechaj na nás.</p><button id="auto-emoji" class="auto-emoji">✦ Vyberať automaticky podľa textu</button><div class="emoji-grid">${emojiOptions.map(emoji=>`<button class="emoji-option" data-icon="${emoji}" aria-label="Vybrať ${emoji}">${symbol(emoji)}</button>`).join('')}</div></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
function escape(value: string) { return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
function renderChoices() {
  $('#choices').innerHTML = choices.map((c,i)=>`<div class="choice-row"><button class="emoji-button" data-emoji="${i}" aria-label="Zmeniť ikonu možnosti ${i+1}" title="${c.manualEmoji ? 'Ručne vybraná ikonka' : 'Automatická ikonka'} — klikni pre výber">${symbol(c.emoji)}</button><input maxlength="40" aria-label="Možnosť ${i+1}" data-choice="${i}" value="${escape(c.label)}" placeholder="Napr. špagety…" aria-describedby="count-${i}"><button class="auto-icon-toggle" data-auto="${i}" aria-label="Automatická ikonka možnosti ${i+1}" title="${c.manualEmoji?'Zapnúť automatický výber podľa textu':'Ikonka sa vyberá automaticky podľa textu'}" aria-pressed="${!c.manualEmoji}">${c.manualEmoji?'Ručná':'Auto'}</button><span class="char-count" id="count-${i}">${c.label.length}/40</span><button class="remove-button" data-remove="${i}" aria-label="Odstrániť možnosť ${i+1}" ${choices.length<=2?'disabled':''}>×</button></div>`).join('');
  $('#add').hidden=choices.length>=5;
}
function item(c: Choice) { return `<div class="reel-item"><span class="reel-emoji">${symbol(c.emoji)}</span><span class="reel-label">${escape(c.label)}</span></div>`; }
function reelView(index: number) {
  return item(choices[(index+choices.length-1)%choices.length])+item(choices[index])+item(choices[(index+1)%choices.length]);
}
function idleReels() {
  $('#reels').innerHTML=Array.from({length:3},(_,i)=>`<div class="reel-window" aria-label="Valec ${i+1}"><div class="reel-strip">${reelView(round.attempts>0?round.reels[i]:i%choices.length)}</div></div>`).join('');
}
function renderRoundControls() {
  const pure = round.mode === 'chance';
  $('#mode-label').textContent=pure?'ČISTÁ NÁHODA':'HRA S PODRŽANÍM';
  $('#fair-note').textContent=pure?'Každá možnosť má rovnakú šancu. Najviac tri pokusy, jeden verdikt.':'Podržaním ovplyvňuješ výsledok. Tretí pokus dokončí podržanú možnosť.';
  $('#hold-controls').hidden=pure;
  document.querySelectorAll<HTMLInputElement>('[name="game-mode"]').forEach(input=>{
    input.checked=input.value===nextMode;
    input.disabled=spinning;
  });
  const pending = nextMode !== round.mode;
  $('#mode-note').textContent=round.attempts>0 ? (pending?'Vybraný režim je pripravený. Začni novú dilemu tlačidlom nižšie; tvoje možnosti zostanú.':'Táto dilema už začala. Pravidlá zmeníš pre novú dilemu; možnosti zostanú zachované.') : 'Čistá náhoda dáva každej možnosti rovnakú šancu. Podržaním ovplyvňuješ výsledok.';
  $('#apply-game-mode').hidden=round.attempts===0 || !pending;
  $<HTMLButtonElement>('#apply-game-mode').disabled=spinning;
  $<HTMLInputElement>('#question').disabled=spinning || (round.attempts>0 && !round.done);
  document.querySelectorAll<HTMLButtonElement>('#my-dilemmas button').forEach(button=>button.disabled=spinning);
  const locked=spinning || (round.attempts>0 && !round.done);
  document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('.choices-panel button,.choices-panel input').forEach(el=>el.disabled=locked);
  document.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(el=>el.disabled=locked || choices.length<=2);
  $<HTMLButtonElement>('#save-dilemma').disabled=spinning;
  $<HTMLButtonElement>('#spin').disabled=spinning;
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(el=>el.disabled=spinning);
  $('#edit-dilemma').hidden=round.attempts===0 || round.done;
  $<HTMLButtonElement>('#edit-dilemma').disabled=spinning;
  $<HTMLButtonElement>('#lever').disabled=spinning || round.done;
  $('#spin-label').textContent=spinning?'Osud to má v rukách…':round.done?'Nová dilema':round.attempts===0?'Nech rozhodne osud':round.attempts===1?'Druhý pokus':(pure?'Finálové žrebovanie':'Posledný pokus');
  $('#machine-state').innerHTML=`<i></i> ${spinning?'OSUD PRACUJE':round.done?'VERDIKT JE KONEČNÝ':'PRIPRAVENÝ NA TVOJ ŤAH'}`;
  $('#round-lock-note').textContent=round.done?'Chceš skúsiť niečo iné? Vyber predvoľbu alebo prepíš možnosti.':round.attempts>0?'Táto dilema má najviac 3 pokusy. Inú otázku môžeš začať predvoľbou alebo úpravou možností.':'';
  $('#round-progress').innerHTML=`<span class="attempt-label">ZATOČENIA <strong>${round.attempts} / 3</strong></span><div class="attempt-dots">${[1,2,3].map(i=>`<span class="attempt-dot ${i<=round.attempts?'used':''} ${i===round.attempts?'current':''}">${i}</span>`).join('')}</div><span class="round-status">${round.done?'ROZHODNUTÉ':round.attempts===2?'POSLEDNÁ ŠANCA':'TRI POKUSY. JEDEN VERDIKT.'}</span>`;
  $('#hold-controls').innerHTML=[0,1,2].map(i=>`<button data-hold="${i}" class="hold-button ${round.held[i]?'held':''}" aria-label="${round.held[i]?'Uvoľniť':'Podržať'} valec ${i+1}" aria-pressed="${round.held[i]}" ${spinning||!canHold(round,i)?'disabled':''} title="${round.attempts===0?'Dostupné po prvom zatočení':round.done?'Dilema je rozhodnutá':!canHold(round,i)?'Najprv uvoľni valce s inou možnosťou':round.held[i]?'Tento valec sa pri ďalšom pokuse netočí. Klikni pre uvoľnenie.':'Podrž tento výsledok pri ďalšom pokuse'}"><span>${round.held[i]?'◆':'◇'}</span> ${round.held[i]?'PODRŽANÉ':'PODRŽAŤ'}</button>`).join('');
  document.querySelectorAll('.reel-window').forEach((el,i)=>el.classList.toggle('is-held',round.held[i]));
  const anyHeld=round.held.some(Boolean);
  $('#hold-hint').textContent=pure && !round.done ? (round.attempts===2?'Finálové žrebovanie — teraz padne rozhodnutie.':'Všetky možnosti majú rovnakú šancu. Valce sa žrebujú nezávisle.') : round.done?'Tento verdikt je hotový. Tlačidlo Nová dilema otvorí ďalšiu otázku.':round.attempts===0?'Po prvom zatočení môžeš podržať symboly.':anyHeld?(round.attempts===2?'Posledný pokus dokončí tvoju podržanú možnosť.':'Podržané valce zostanú. Podržať môžeš len rovnaké možnosti.'):round.attempts===2?'Posledné zatočenie už vytvorí trojicu aj bez podržania.':'Podrž symboly, ktoré sa ti páčia, alebo roztoč všetky.';
}
function renderRoundResult() {
  const winnerIndex=winningChoice(round);
  app.classList.toggle('has-winner',round.done);
  if(round.done && winnerIndex!==null) {
    const winner=choices[winnerIndex];
    $('#result').innerHTML=`<span class="result-icon">${symbol(winner.emoji)}</span><div><span class="winner-kicker">OSUD ROZHODOL! · ${round.attempts}. POKUS</span><strong>${escape(winner.label)}</strong><p>Pre túto dilemu platí verdikt. Inú otázku vyber predvoľbou alebo cez Nová dilema.</p></div><span class="winner-spark">✳</span>`;
  } else if(round.attempts>0) {
    const pair=new Set(round.reels).size===2;
    $('#result').innerHTML=`<span class="result-icon">${pair?'✦':'✧'}</span><div><strong>${pair?(round.mode==='hold'?'Dva sa zhodli. Podržíš ich?':'Dva sa zhodli. Ešte jeden pokus?'):'Osud ešte váha…'}</strong><p>${round.attempts===2?'Zostáva posledné zatočenie. Teraz už padne verdikt.':(round.mode==='hold'?'Trojica zatiaľ nepadla. Vyber, čo podržíš, a skús to znova.':'Trojica zatiaľ nepadla. Ďalší pokus znova žrebuje všetky valce.')}</p></div>`;
  } else {
    $('#result').innerHTML='<span class="result-icon">✧</span><div><strong>Vesmír čaká na tvoj ťah.</strong><p>Najviac tri zatočenia. Jedna dilema menej.</p></div>';
  }
}

function renderHistory() {
  $('#clear-history').hidden=history.length===0;
  $('#history').innerHTML=history.length ? `<div class="history-cards">${history.map(v=>`<div class="history-card"><span class="history-emoji">${symbol(v.emoji)}</span><div><strong>${escape(v.label)}</strong><span>${escape(v.time)}${v.attempts ? ` · ${v.attempts}. pokus` : ''}</span></div><span class="history-check">↗</span></div>`).join('')}</div>` : '<div class="history-empty"><span>✧</span> Zatiaľ žiadne veľké verdikty. Ten prvý je na tebe.</div>';
}
function renderSound() { $('#menu-sound').textContent=sound?'Zvuk: zapnutý':'Zvuk: vypnutý'; $('#menu-sound').setAttribute('aria-pressed',String(sound)); $('#sound').innerHTML=sound?icons.sound:icons.mute; $('#sound').setAttribute('aria-label',sound?'Vypnúť zvuk':'Zapnúť zvuk'); $('#sound').setAttribute('aria-pressed',String(sound)); }
function tone(frequency: number, duration=.08, delay=0, type: OscillatorType='sine', volume=.06) {
  if(!sound || !audio) return;
  const oscillator=audio.createOscillator(), gain=audio.createGain();
  oscillator.type=type; oscillator.frequency.value=frequency;
  const t=audio.currentTime+delay;
  gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(volume,t+.008); gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(t); oscillator.stop(t+duration);
}
async function spin() {
  if(spinning || round.done) return;
  choices=choices.map(c=>({...c,label:c.label.trim()}));
  if(choices.some(c=>!c.label)) {
    $('#form-error').textContent='Doplň každú možnosť, nech má osud z čoho vybrať.';
    document.querySelectorAll<HTMLInputElement>('[data-choice]')[choices.findIndex(c=>!c.label)]?.focus(); return;
  }
  if(new Set(choices.map(c=>c.label.toLocaleLowerCase('sk'))).size!==choices.length) {
    $('#form-error').textContent='Každá možnosť musí byť iná.'; return;
  }
  $('#form-error').textContent='';
  if(sound) { try { audio??=new AudioContext(); void audio.resume().catch(()=>{}); } catch { /* Visual play also works without audio. */ } }
  const previous=round;
  round=spinRound(round,choices.length);
  // Save the consumed attempt and verdict before animation, so refresh is no reroll.
  if(round.done) {
    const winner=choices[winningChoice(round)!];
    history.unshift({...winner,attempts:round.attempts,time:new Intl.DateTimeFormat('sk-SK',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'numeric'}).format(new Date())});
    history=history.slice(0,5);
  }
  persist(); spinning=true;
  app.classList.remove('has-winner'); app.classList.add('is-spinning'); renderRoundControls();
  $('#result').innerHTML='<span class="result-icon thinking">✳</span><div><strong>Chvíľku, radím sa s vesmírom…</strong><p>O chvíľu uvidíš, čo padlo na valcoch.</p></div>';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  tone(170,.2,0,'triangle'); tone(260,.2,.08,'triangle');
  let tick=0;
  const timer=window.setInterval(()=>{ tone(260+(tick++%5)*45,.035,0,'triangle',.025); },110);
  try {
    await Promise.all([0,1,2].map(async i=>{
      if(previous.held[i]) return;
      const windowEl=$('#reels').children[i] as HTMLElement;
      const strip=windowEl.firstElementChild as HTMLElement;
      windowEl.classList.remove('landed');
      const count=22+i*4;
      const starting=choices[previous.attempts>0?previous.reels[i]:i%choices.length];
      const target=choices[round.reels[i]];
      strip.innerHTML=item(choices[(previous.reels[i]>=0?previous.reels[i]+choices.length-1:(i+choices.length-1))%choices.length])+Array.from({length:count},(_,j)=>item(j===0?starting:choices[(j+i)%choices.length])).join('')+item(target)+item(choices[(round.reels[i]+1)%choices.length]);
      const height=strip.querySelector<HTMLElement>('.reel-item')!.getBoundingClientRect().height;
      const animation=strip.animate([{transform:'translateY(calc(var(--reel-peek) - var(--reel-height)))'},{transform:`translateY(calc(var(--reel-peek) - ${(count+1)*height}px))` }],{duration:reduced?250+i*100:2300+i*450,easing:'cubic-bezier(.12,.65,.16,1)',fill:'forwards'});
      await animation.finished;
      strip.innerHTML=reelView(round.reels[i]); animation.cancel(); windowEl.classList.add('landed'); tone(380+i*130,.16,0,'triangle',.08);
    }));
    if(round.done) [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.4,i*.09,'sine',.09));
    else { tone(330,.18,0,'triangle',.04); tone(260,.2,.13,'triangle',.04); }
  } catch {
    // A cancelled animation must still display the saved outcome.
    idleReels();
  } finally {
    clearInterval(timer); spinning=false; app.classList.remove('is-spinning');
    renderRoundControls(); renderRoundResult(); renderHistory();
  }
}
$('#hold-controls').addEventListener('click',e=>{
  if(spinning) return;
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-hold]');
  if(!button || button.disabled) return;
  round=toggleHold(round,Number(button.dataset.hold)); persist(); renderRoundControls();
  tone(round.held[Number(button.dataset.hold)]?640:320,.07,0,'triangle',.04);
});
function startNewDilemma(clearChoices=true) {
  if(spinning) return;
  if(clearChoices) { question=''; $<HTMLInputElement>('#question').value=''; library.detach(); }
  if(clearChoices) choices=Array.from({length:3},()=>({label:'',emoji:'✨'}));
  round=newRound(nextMode);
  renderChoices(); idleReels(); renderRoundControls(); renderRoundResult(); persist();
  $('#form-error').textContent='';
  syncPresets();
  const input=$<HTMLInputElement>('[data-choice="0"]');
  input.focus({preventScroll:true});
  $('#choices').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function refreshChoicesState() {
  idleReels(); renderRoundControls(); renderRoundResult(); persist(); syncPresets();
}
function syncPresets() {
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>{
    const preset=presets[button.dataset.preset!];
    button.classList.toggle('active',choices.length===preset.length && choices.every((choice,i)=>choice.label===preset[i].label && choice.emoji===preset[i].emoji));
  });
}
$('#edit-dilemma').addEventListener('click',()=>startNewDilemma(false));
$('#choices').addEventListener('input',e=>{
  const input=e.target as HTMLInputElement;
  if(input.dataset.choice===undefined || spinning || (round.attempts>0 && !round.done)) return;
  const i=Number(input.dataset.choice), choice=choices[i];
  if(round.done && input.value!==choice.label) round=newRound(nextMode);
  choice.label=input.value;
  if(!choice.manualEmoji) {
    choice.emoji=suggestEmoji(input.value);
    $(`[data-emoji="${i}"]`).innerHTML=symbol(choice.emoji);
  }
  $(`#count-${i}`).textContent=`${input.value.length}/40`;
  refreshChoicesState();
  $('#form-error').textContent='';
});
let editingEmoji: number | null = null;
function chooseIcon(emoji?: string) {
  if(editingEmoji===null || spinning || (round.attempts>0 && !round.done)) return;
  const i=editingEmoji, choice=choices[i];
  choice.manualEmoji=emoji!==undefined;
  choice.emoji=emoji ?? suggestEmoji(choice.label);
  renderChoices(); refreshChoicesState();
  $<HTMLDialogElement>('#emoji-dialog').close();
  $<HTMLInputElement>(`[data-choice="${i}"]`).focus();
}
$('#emoji-dialog').addEventListener('click', e=>{
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-icon]');
  if(button) chooseIcon(button.dataset.icon);
  else if(e.target===e.currentTarget) $<HTMLDialogElement>('#emoji-dialog').close();
});
$('#auto-emoji').addEventListener('click',()=>chooseIcon());
$('#close-emoji').addEventListener('click',()=>$<HTMLDialogElement>('#emoji-dialog').close());
$('#choices').addEventListener('click',e=>{
  if(spinning || (round.attempts>0 && !round.done))return; const target=(e.target as HTMLElement).closest<HTMLButtonElement>('button'); if(!target)return;
  if(target.dataset.auto!==undefined) {
    const i=Number(target.dataset.auto); choices[i].manualEmoji=false; choices[i].emoji=suggestEmoji(choices[i].label);
    renderChoices(); refreshChoicesState(); $<HTMLInputElement>(`[data-choice="${i}"]`).focus();
  }
  if(target.dataset.remove!==undefined && choices.length>2) { round=newRound(nextMode); choices.splice(Number(target.dataset.remove),1); renderChoices(); refreshChoicesState(); }
  if(target.dataset.emoji!==undefined) { editingEmoji=Number(target.dataset.emoji); $<HTMLDialogElement>('#emoji-dialog').showModal(); }
  persist();
});
$('#add').addEventListener('click',()=>{ if(spinning||(round.attempts>0&&!round.done)||choices.length>=5)return; round=newRound(nextMode); choices.push({label:'',emoji:'✨'}); renderChoices(); refreshChoicesState(); $<HTMLInputElement>(`[data-choice="${choices.length-1}"]`).focus(); });
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  if(spinning) return;
  const next=structuredClone(presets[button.dataset.preset!]);
  const same=choices.length===next.length && choices.every((choice,i)=>choice.label===next[i].label);
  if(same && round.attempts>0) {
    $('#form-error').textContent=round.done?'Táto dilema už má verdikt. Vyber inú tému alebo stlač Nová dilema.':'Táto téma je už roztočená. Pokračuj ďalším pokusom alebo vyber inú tému.';
    return;
  }
  question=button.textContent?.trim()||''; $<HTMLInputElement>('#question').value=question; library.detach();
  choices=next; round=newRound(nextMode); renderChoices(); refreshChoicesState(); $('#form-error').textContent='';
}));
$('#spin').addEventListener('click',()=>{if(round.done)startNewDilemma();else void spin();}); $('#lever').addEventListener('click',()=>void spin());
$('#menu-sound').addEventListener('click',()=>{sound=!sound; renderSound(); persist();});
$('#sound').addEventListener('click',()=>{sound=!sound; renderSound(); persist();});
$('#clear-history').addEventListener('click',()=>{history=[]; renderHistory(); persist();});
$('#help').addEventListener('click',()=>$<HTMLDialogElement>('#help-dialog').showModal());
$('#close-help').addEventListener('click',()=>$<HTMLDialogElement>('#help-dialog').close());
$('#help-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget)$<HTMLDialogElement>('#help-dialog').close();});
let leverStart: number | null = null;
const lever = $('#lever');
lever.addEventListener('pointerdown', event=>{
  if(spinning || round.done) return;
  leverStart=event.clientY;
  lever.setPointerCapture(event.pointerId);
});
lever.addEventListener('pointermove', event=>{
  if(leverStart===null || spinning) return;
  const distance=Math.min(65,Math.max(0,event.clientY-leverStart));
  lever.style.transform=`translateY(${distance*.4}px) rotateX(-${distance*.5}deg)`;
});
lever.addEventListener('pointerup', event=>{
  const distance=leverStart===null?0:event.clientY-leverStart;
  leverStart=null; lever.style.transform='';
  if(distance>18) void spin();
});
lever.addEventListener('pointercancel',()=>{leverStart=null;lever.style.transform='';});
renderChoices(); idleReels(); renderHistory(); renderSound(); renderRoundControls(); renderRoundResult();
syncPresets();

document.querySelectorAll<HTMLInputElement>('[name="game-mode"]').forEach(input=>input.addEventListener('change',()=>{
  if(spinning) { renderRoundControls(); return; }
  nextMode=input.value==='hold'?'hold':'chance';
  if(round.attempts===0) round=newRound(nextMode);
  persist(); renderRoundControls(); renderRoundResult();
}));
$('#apply-game-mode').addEventListener('click',()=>{
  if(spinning) return;
  $('#appearance-toggle').click();
  startNewDilemma(false);
});
$('#choices').addEventListener('keydown',event=>{
  if((event as KeyboardEvent).key==='Enter' && (event.target as HTMLElement).matches('input')) {
    event.preventDefault();
    const next=(event.target as HTMLInputElement).dataset.choice;
    const nextInput=document.querySelector<HTMLInputElement>(`[data-choice="${Number(next)+1}"]`);
    if(nextInput) nextInput.focus(); else if(choices.length<5) $('#add').click(); else $('#spin').focus();
  }
});
const library=setupLibrary({
  snapshot:()=>({question,choices:structuredClone(choices)}),
  busy:()=>spinning,
  load:(d,edit)=>{
    const same=question===d.question && choices.length===d.choices.length && choices.every((c,i)=>c.label===d.choices[i].label && c.emoji===d.choices[i].emoji);
    if(same && round.attempts>0 && !edit){$('#library-status').textContent='Táto dilema už začala. Cez Upraviť môžeš začať novú.';return false;}
    question=d.question;choices=d.choices;$<HTMLInputElement>('#question').value=question;
    round=newRound(nextMode);renderChoices();refreshChoicesState();
    if(edit)$<HTMLInputElement>('[data-choice="0"]').focus();
    (edit?$('#choices'):$('.machine-area')).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    return true;
  }
});
$('#question').addEventListener('input',()=>{
  if(spinning || (round.attempts>0 && !round.done))return;
  const value=$<HTMLInputElement>('#question').value;
  if(round.done && value!==question)round=newRound(nextMode);
  question=value;persist();renderRoundControls();renderRoundResult();
});
setupAppearance();
setupInstall();
