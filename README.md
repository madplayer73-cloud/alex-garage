# Osud rozhodol

Malá aplikácia v slovenčine na každodenné dilemy. Pridaj 2 až 5 možností a roztoč tri valce. Predvolená **Čistá náhoda** dáva každej možnosti rovnakú výslednú šancu: prvé dva pokusy žrebujú každý valec nezávisle, prirodzená trojica ukončí hru skôr. Tretí pokus rovnomerne vyžrebuje jednu možnosť a zobrazí ju trikrát. Voliteľná **Hra s podržaním** umožňuje podržať rovnaké možnosti a tretí pokus ich dokončí; podržanie teda ovplyvňuje šance. Najviac tri pokusy na dilemu, bez peňazí a stávok.

## Vývoj

Node.js >= 22.12.0 a npm.

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 3000
```

## Zostavenie

```sh
npm run build
npm run preview -- --port 3000
```

Aplikácia nepotrebuje backend, účet ani kľúče. Možnosti, aktuálnu hru vrátane pokusov a podržaných valcov, posledných päť výsledkov a nastavenie zvuku ukladá iba do localStorage daného prehliadača. Zvuky generuje Web Audio API až po interakcii používateľa; možno ich vypnúť. Jednotlivé náhodné výbery používajú rovnomerné žrebovanie cez Web Crypto. Podržanie zvýhodňuje zvolenú možnosť; hra nepredstiera rovnaké konečné pravdepodobnosti po zásahu hráča. Animácia rešpektuje systémové nastavenie obmedzeného pohybu.

Historický projekt Alex Garage bol odstránený na žiadosť používateľa; Git história zostala zachovaná.

## Automatické ikonky

Text možnosti môže mať najviac 40 znakov; počítadlo je pri každom políčku. Ikonky sa priraďujú priebežne z lokálneho slovníka slovenských/českých jedál, nápojov a aktivít, aj bez diakritiky. Konkrétne jedlá majú prednosť pred všeobecnými ingredienciami. Nerozpoznaný text dostane neutrálny symbol: ✨ v Hravom vzhľade alebo kocku v realistických vzhľadoch. Emoji napísané priamo v texte má prednosť. Kliknutím na ikonku možno otvoriť výber, ručne ju zmeniť alebo obnoviť automatický režim. Ručný výber zostáva pri úpravách textu aj obnovení stránky. Žiadny text sa neposiela na server ani do AI služby.

Testy slovníka: `npm test`.

## Hra na najviac tri pokusy

- V režime Hra s podržaním možno podržať iba valce s rovnakou možnosťou; porovnáva sa index možnosti, nie samotná ikonka. Dve jedlá s rovnakým emoji teda netvoria dvojicu.
- Podržanie sa dá medzi pokusmi uvoľniť. Nezlučiteľné podržania sú zakázané, aby tretí pokus mohol zachovať všetky podržané valce a zároveň priniesť trojicu.
- Vlastné možnosti sa počas roztočenej hry zamknú; tlačidlo Upraviť možnosti alebo výber inej predvoľby začnú novú dilemu. Po verdikte sa možnosti dajú opäť upravovať. Pokus sa uloží pred animáciou; obnovenie stránky nedá ďalší pokus ani druhý záznam do histórie.
- Po verdikte sa páka zamkne a hlavné tlačidlo sa zmení na Nová dilema. Otvorí tri prázdne možnosti pre ďalšiu otázku a presunie na ne zobrazenie aj fokus. Predvoľby zostávajú použiteľné; výber inej témy, úprava názvu či pridanie/odstránenie možnosti začnú novú dilemu. Zmena samotnej ikonky neobnoví pokusy.
- Bežné výherné automaty trojicu negarantujú. Garantovaný tretí pokus je zámerná úprava pre rozhodovaciu hru.
- `npm test` overuje slovník ikoniek aj logiku pokusov, podržania, obnovy a konečného verdiktu.

## CasaOS / Docker

Postup nasadenia je v [deploy/CASAOS.md](deploy/CASAOS.md). Na CasaOS stačí stiahnuť repozitár z GitHubu a spustiť `docker compose up -d --build`; predvolený port je 8099. Hotová aplikácia je verzovaná v `deploy/site`, takže CasaOS nepotrebuje Node.js ani npm. Pri vývoji spusti `npm test` a `npm run build`; build zároveň obnoví `deploy/site`. Pri odosielaní zdrojových zmien na GitHub vždy odošli aj tieto aktualizované výstupy. Pre pripravený balík bez Node.js spusti `python3 scripts/package-casaos.py` (Python 3 je potrebný iba na zabalenie, nie na beh aplikácie). Voliteľne použi `--output /cesta/osud-casaos.zip`. Skript najprv spustí testy a build a potom zabalí statické súbory, Docker/Compose konfiguráciu, návod a kontrolné súčty.

## Kontrola pokračovania po verdikte

Voliteľné prehliadačové regresné testy: pri spustenej aplikácii a dostupnom Python Playwright/Chromium spusti `python3 tests/browser_navigation.py`. Adresu možno zmeniť cez `OSUD_TEST_URL`, cestu k prehliadaču cez `CHROMIUM_PATH`. Testy pokrývajú obnovený výsledok vína, veľké tlačidlo Nová dilema, všetky predvoľby, úpravu/pridanie/odstránenie možností, zmenu ikonky bez nového pokusu, podržanie a mobilný prechod na nové vstupy.

## Vzhľad aplikácie

Hamburger menu ponúka štyri vzhľady: **Studio** (predvolený grafit/meď), **Retro** (chróm/smalt), **Minimal** a **Hravý** (pôvodné emoji). Nezávisle sa prepína Dark/Light. Prvé tri vzhľady zdieľajú lokálne sady realistických predmetov v `src/assets/*.png`, ktoré pokrývajú všetkých 63 ikoniek slovníka, vygenerovanú pre tento projekt. Slovník vyberá význam a `src/symbols.ts` mapuje podporované ikonky na obrázky; nerozpoznané výrazy dostanú neutrálnu kocku. Obrázky sa načítajú z lokálnych atlasov bez externých služieb.

Menu obsahuje tiež zvuk, pravidlá a výber herného režimu. Režim možno vybrať kedykoľvek mimo animácie. Pri rozbehnutej alebo hotovej dileme sa uloží výber pre ďalšiu hru a menu ponúkne výslovné tlačidlo na novú dilemu so zachovanými možnosťami; samotný výber neobnovuje pokusy ani nemení výsledok. Zmena grafiky ani Dark/Light nemení žrebovanie, podržanie, počet pokusov alebo históriu. Staršie uložené hry bez označenia režimu sa obnovia ako Hra s podržaním, aby sa nestratili ich pravidlá; nové inštalácie začínajú Čistou náhodou. Po otvorení Novej dilemy možno prepnúť režim.

Valce majú viditeľné susedné položky, postupné zastavenie, zvuk dosadnutia a pákové ovládanie. Enter presúva medzi možnosťami a na konci pridá ďalšiu (do limitu päť). Na mobile je mašina nad editorom možností. Zvuk a obmedzený pohyb sú rešpektované. Vzhľad a hra sa ukladajú lokálne; rozdielne adresy LAN/Tailscale a rôzne prehliadače nemajú spoločné úložisko.

Podkladová štúdia a matematika šancí sú v [docs/machine-study.md](docs/machine-study.md). Pôvodné koncepty sú v [docs/design-v2.md](docs/design-v2.md).

`npm test` zahŕňa úplný výpočet symetrie výsledkov pre 2–5 možností, migráciu starých hier, odmietnutie skresľujúceho zvyšku generátora a oba režimy. Prehliadačové testy overujú všetky štyri vzhľady × oba farebné režimy × štyri šírky, zamknutie pravidiel, tretí pokus, držanie, uloženie počas animácie, klávesnicu, zvuk a pokračovanie po výsledku.

Všetky prehliadačové kontroly: `python3 -m unittest discover -s tests -p 'browser_*.py' -v` (vyžaduje bežiacu aplikáciu a Python Playwright/Chromium).

## Vlastné možnosti a predvoľby

Doplnené rozpoznávanie PS5/PS4/PS3, Nintendo, Steam a výrazu codovať. Pracovať aj kódovať používajú obrázok notebooku, PS5 obrázok ovládača. Každá ponúkaná ikonka má realistický obrázok aj v ručnom výbere. Pri možnosti je viditeľné Auto alebo Ručná; kliknutím na Ručná sa obnoví automatický výber podľa textu. Ponuka obsahuje 12 hotových dilem vrátane hier, práce, pohybu, nápojov, raňajok, oddychu, sladkostí a domácnosti.

## Moje dilemy a vlastná otázka

Nad mašinou je nepovinná otázka do 80 znakov. Ukladá sa s aktuálnou hrou. Počas rozbehnutej dilemy sa otázka zamkne rovnako ako možnosti. Nová dilema ju vymaže; úprava existujúcej hry ju ponechá.

Tlačidlo **Uložiť dilemu** uloží otázku/názov a 2–5 možností vrátane ručných ikoniek do samostatného localStorage `osud-dilemmas-v1` (najviac 30 záznamov). Zoznam **Moje dilemy** ponúka otvorenie, úpravu a odstránenie. Pri úprave načítanej dilemy možno **Uložiť zmeny** alebo **Uložiť ako novú**. Hotové predvoľby sa nemenia: používateľ ich načíta, upraví a uloží svoju verziu. Otvorenie rovnakého záznamu neobnovuje rozbehnuté pokusy; tlačidlo Upraviť výslovne začína novú hru. Neúspešný zápis do úložiska zobrazí chybu a nepredstiera uloženie.

## Pridanie na plochu a offline

Hamburger menu → **Pridať na plochu** otvorí postup pre daný prehliadač. Pri podporovanej inštalácii sa ponúkne natívne tlačidlo. Súčasťou buildu je manifest, PNG ikonky vrátane Apple ikony a verzovaný service worker. Na HTTPS alebo localhost sa po úspešnom prvom načítaní uloží celý statický obsah pre offline použitie. Aktualizácia čakajúceho service workera sa ponúkne v hamburger menu, používateľ ju spustí sám. Aktuálna hra aj dilemy ostávajú v localStorage.

**Na súčasných HTTP adresách `192.168.1.140:8099` a `100.107.191.11:8099` nie je dostupný service worker ani zaručená plná PWA inštalácia.** Prehliadač môže vytvoriť odkaz na plochu; aplikácia potom vyžaduje pripojenie k serveru (mimo domova aj Tailscale). Plná PWA a offline vyžadujú HTTPS na serveri, ktoré táto zmena automaticky nekonfiguruje. Ukladanie je viazané na prehliadač a adresu, presun na inú adresu/HTTPS automaticky neprenesie už uložené dáta.

Build generuje `dist/sw.js` cez `scripts/prepare-pwa.mjs` a potom celý výstup kopíruje do `deploy/site`. Nginx podáva manifest so správnym MIME typom a service worker bez cache. Prehliadačové testy overujú uloženie/úpravu/kópiu/vymazanie, chybné úložisko, mobil, zachovanie pokusov, manifest/ikonky, inštalačný dialóg a skutočné offline načítanie po registrácii service workera na localhost.

## Vlastné fotografie bez plateného API

Pri nerozpoznanej možnosti sa zobrazí upozornenie a tlačidlo **Pripraviť prompt a pridať obrázky**. Rovnaký import otvoríš v hamburger menu cez **Import vlastných obrázkov**. Prompt obsahuje jednotlivé chýbajúce výrazy a žiada samostatné obrázky. Používateľ ho vloží do svojej AI, stiahne výsledky a ku každému výrazu nahrá jeden súbor. Možno použiť aj orezanú snímku obrazovky. Aplikácia nevolá AI API a nepotrebuje API kľúč; dostupnosť generovania závisí od služby používateľa.

Import podporuje PNG, JPEG a WebP do 6 MB, najviac 200 výrazov. Pri automatickom výbere má obrázok prednosť pred zabudovanou ikonou vo všetkých vzhľadoch. Ručný výber ikonky má prednosť do ďalšej zmeny textu. Rovnaký výraz sa rozpozná bez diakritiky a veľkých písmen; odlišnú formuláciu treba pridať osobitne. Existujúci obrázok možno nahradiť opätovným importom. Zmena textu možnosti vždy obnoví automatické priradenie, aj keď bola predtým ikonka vybraná ručne.

Compose spúšťa okrem webu aj službu `photos` (Node.js v kontajneri, bez inštalácie na hostiteľa). Fotografie a `photos.json` uchováva v **`/DATA/AppData/osud-photos`**, mimo Git checkoutu. Zálohuj celý tento priečinok. Cestu možno nastaviť premennou `OSUD_PHOTO_DIR`; pri zmene cesty treba preniesť aj existujúce dáta. Aktualizácia ani znovuvytvorenie kontajnerov obrázky nemaže. Fotografie sú spoločné pre PC/mobil a LAN/Tailscale adresy smerujúce na rovnaký server. Samotné hry a uložené dilemy zostávajú v úložisku jednotlivých prehliadačov.

Úložisko nemá používateľské účty: kto má prístup k tejto súkromnej aplikácii na LAN/Tailscale, môže obrázky čítať a importovať. Backend nemá samostatný verejný port; web ho sprístupňuje cez `/api/photos`. Pri nedostupnom úložisku hra funguje so zabudovanými ikonami, import oznámi chybu. Vlastné fotografie vyžadujú spojenie so serverom, nie sú súčasťou offline PWA balíka.

Vývoj importu: `PHOTO_DATA_DIR=/tmp/osud-dev-photos PORT=8080 node server/photos.mjs`; pri samotnom Vite prehliadači treba `/api/` smerovať na tento server. Úplné prostredie poskytne `docker compose up -d --build`. Jednotkové testy úložiska spúšťa `npm test`. Prehliadačové testy importu spúšťaj iba proti izolovanému testovaciemu Compose s prázdnym `OSUD_PHOTO_DIR`: `OSUD_PHOTO_INTEGRATION=1 OSUD_TEST_URL=http://127.0.0.1:18104 python3 -m unittest discover -s tests -p 'browser_photos.py' -v`. Testy nahrávajú a nahrádzajú testovacie obrázky.

## Veľký automat

Po zadaní možností stlač **Možnosti sú pripravené →**, prípadne **Zväčšiť automat** nad mašinou. Editor, úvod a história ustúpia a automat využije hlavný priestor obrazovky. Otvorenie overí vyplnené a rozdielne možnosti, ale nespotrebuje pokus. Otázka, oba herné režimy, štyri vzhľady, Dark/Light, zvuk a importované obrázky zostávajú dostupné. Na mobile sa bočná páka skryje, aby mali valce viac miesta; točí sa veľkým tlačidlom.

**Späť k možnostiam** alebo Escape vráti pôvodné rozhranie bez zmeny hry. Počas animácie je prepnutie zablokované; Escape najprv zatvára otvorené menu alebo dialóg. **Nová dilema** otvorí editor prázdnych možností. Zväčšenie sa pamätá počas otvorenej karty aj po obnovení stránky, ak prehliadač umožňuje sessionStorage. Ide o rozloženie stránky, takže funguje aj na HTTP adresách CasaOS bez oprávnenia na fullscreen. Na nízkych obrazovkách sa dá posunúť k výsledku.
