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

Hamburger menu ponúka štyri vzhľady: **Studio** (predvolený grafit/meď), **Retro** (chróm/smalt), **Minimal** a **Hravý** (pôvodné emoji). Nezávisle sa prepína Dark/Light. Prvé tri vzhľady zdieľajú lokálnu sadu 16 realistických predmetov v `src/assets/objects.png`, vygenerovanú pre tento projekt. Slovník vyberá význam a `src/symbols.ts` mapuje podporované ikonky na obrázky; ostatné dostanú neutrálnu kocku. Celá sada sa načíta ako jeden lokálny súbor bez externých služieb.

Menu obsahuje tiež zvuk, pravidlá a výber herného režimu. Pravidlá možno meniť iba pred prvým pokusom novej dilemy. Zmena grafiky ani Dark/Light nemení žrebovanie, podržanie, počet pokusov alebo históriu. Staršie uložené hry bez označenia režimu sa obnovia ako Hra s podržaním, aby sa nestratili ich pravidlá; nové inštalácie začínajú Čistou náhodou. Po otvorení Novej dilemy možno prepnúť režim.

Valce majú viditeľné susedné položky, postupné zastavenie, zvuk dosadnutia a pákové ovládanie. Enter presúva medzi možnosťami a na konci pridá ďalšiu (do limitu päť). Na mobile je mašina nad editorom možností. Zvuk a obmedzený pohyb sú rešpektované. Vzhľad a hra sa ukladajú lokálne; rozdielne adresy LAN/Tailscale a rôzne prehliadače nemajú spoločné úložisko.

Podkladová štúdia a matematika šancí sú v [docs/machine-study.md](docs/machine-study.md). Pôvodné koncepty sú v [docs/design-v2.md](docs/design-v2.md).

`npm test` zahŕňa úplný výpočet symetrie výsledkov pre 2–5 možností, migráciu starých hier, odmietnutie skresľujúceho zvyšku generátora a oba režimy. Prehliadačové testy overujú všetky štyri vzhľady × oba farebné režimy × štyri šírky, zamknutie pravidiel, tretí pokus, držanie, uloženie počas animácie, klávesnicu, zvuk a pokračovanie po výsledku.

Všetky prehliadačové kontroly: `python3 -m unittest discover -s tests -p 'browser_*.py' -v` (vyžaduje bežiacu aplikáciu a Python Playwright/Chromium).
