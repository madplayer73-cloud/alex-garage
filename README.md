# Osud rozhodol

Malá aplikácia v slovenčine na každodenné dilemy. Pridaj 2 až 5 možností, roztoč tri valce a nechaj náhodu vybrať. Hra má najviac tri zatočenia. Prvé dva pokusy žrebujú každý nepodržaný valec samostatne a môžu skončiť bez trojice. Podržanie jednej alebo dvoch rovnakých možností ovplyvní ďalšie pokusy. Tretie zatočenie garantuje verdikt: doplní podržanú možnosť do trojice, alebo bez podržania rovnomerne vyberie jednu z možností. Pri prirodzenej trojici sa hra končí aj skôr. Nie je to hazardná hra a nepracuje s peniazmi.

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

Text možnosti môže mať najviac 40 znakov; počítadlo je pri každom políčku. Ikonky sa priraďujú priebežne z lokálneho slovníka slovenských/českých jedál, nápojov a aktivít, aj bez diakritiky. Konkrétne jedlá majú prednosť pred všeobecnými ingredienciami. Nerozpoznaný text dostane ✨. Emoji napísané priamo v texte má prednosť. Kliknutím na ikonku možno otvoriť výber, ručne ju zmeniť alebo obnoviť automatický režim. Ručný výber zostáva pri úpravách textu aj obnovení stránky. Žiadny text sa neposiela na server ani do AI služby.

Testy slovníka: `npm test`.

## Hra na najviac tri pokusy

- Podržať možno iba valce s rovnakou možnosťou; porovnáva sa index možnosti, nie samotná ikonka. Dve jedlá s rovnakým emoji teda netvoria dvojicu.
- Podržanie sa dá medzi pokusmi uvoľniť. Nezlučiteľné podržania sú zakázané, aby tretí pokus mohol zachovať všetky podržané valce a zároveň priniesť trojicu.
- Možnosti sa po prvom pokuse zamknú. Pokus sa uloží pred animáciou; obnovenie stránky nedá ďalší pokus ani druhý záznam do histórie.
- Po verdikte sa spin aj páka zamknú. Tlačidlo Nová dilema otvorí tri prázdne možnosti pre ďalšiu otázku.
- Bežné výherné automaty trojicu negarantujú. Garantovaný tretí pokus je zámerná úprava pre rozhodovaciu hru.
- `npm test` overuje slovník ikoniek aj logiku pokusov, podržania, obnovy a konečného verdiktu.

## CasaOS / Docker

Postup nasadenia je v [deploy/CASAOS.md](deploy/CASAOS.md). Na CasaOS stačí stiahnuť repozitár z GitHubu a spustiť `docker compose up -d --build`; predvolený port je 8099. Hotová aplikácia je verzovaná v `deploy/site`, takže CasaOS nepotrebuje Node.js ani npm. Pri vývoji spusti `npm test` a `npm run build`; build zároveň obnoví `deploy/site`. Pri odosielaní zdrojových zmien na GitHub vždy odošli aj tieto aktualizované výstupy. Pre pripravený balík bez Node.js spusti `python3 scripts/package-casaos.py` (Python 3 je potrebný iba na zabalenie, nie na beh aplikácie). Voliteľne použi `--output /cesta/osud-casaos.zip`. Skript najprv spustí testy a build a potom zabalí statické súbory, Docker/Compose konfiguráciu, návod a kontrolné súčty.
