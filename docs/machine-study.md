# Osud — mechanika a vzhľady mašiny

Dátum štúdie: 23. 10. 2026. Štúdia slúžila ako podklad implementácie: oba režimy a všetky štyri vzhľady sú teraz pripravené v aplikácii. Nasadenie na CasaOS vykoná používateľ aktualizačným príkazom. Používateľ vybral smer Studio a žiada 3–4 prepínateľné grafiky, čo najnáhodnejší výber a najviac tri zatočenia.

## Čo bolo overené

- Súčasný `src/round.ts`: `crypto.getRandomValues`, rejection sampling bez modulo skreslenia, nezávislé nepodržané valce v prvých dvoch pokusoch. Tretí pokus doplní podržanú možnosť; bez podržania rovnomerne vyžrebuje jednu možnosť a zobrazí ju trikrát.
- [MDN, zdroj dokumentácie getRandomValues](https://github.com/mdn/content/blob/main/files/en-us/web/api/crypto/getrandomvalues/index.md): kryptograficky silný pseudonáhodný generátor prehliadača so systémovou entropiou, dostupný aj cez HTTP. Algoritmus závisí od prehliadača. Nejde o fyzický generátor ani certifikáciu herného automatu.
- [HTML5 Slot Machine](https://github.com/johakr/html5-slot-machine): prečítané README, `src/js/Reel.js` a `src/js/Slot.js` cez raw GitHub. Príklad oddeľuje výber výsledku od animácie, používa pás symbolov, rozdielne trvanie valcov, rozmazanie počas pohybu a Web Animations API. Je to webový prototyp s piatimi valcami, nie dokumentácia mechanického automatu. Jeho kód ani obrázky nepreberáme. Živé demo nebolo prezreté.
- Priame stránky Gambling Commission RTS 7, MDN a Wikipedia boli pri tomto prieskume blokované proxy CONNECT 403. Ich obsah sa nepovažuje za prečítaný. Závery o našich šanciach sú výpočty z vlastného algoritmu, nie tvrdenia o všetkých kasínových strojoch.

## Mechanický dojem

Klasický vzhľad s tromi valcami: jeden zreteľný stredový riadok rozhoduje, nad a pod ním viditeľné časti susedných symbolov. Pás symbolov sa posúva zvislo, rozbehne sa, spomalí a presne dosadne. Valce zastavujú postupne zľava doprava. Páka má krátky pohyb a rovnakú funkciu ako veľké tlačidlo.

Navrhovaná celková dĺžka zatočenia 2–3 sekundy; rozostup zastavení približne 250–400 ms. Zvuk rozbehu, jemné cvakanie a krátke dosadnutie synchronizovať s animáciou. Pri obmedzenom pohybe použiť krátke odhalenie výsledku. Výsledok určiť a uložiť pred animáciou, zachovať zotavenie po návrate z pozadia. Nepoužívať umelé „takmer výhry“, preklikávanie výsledku tlačidlom STOP ani automatické ďalšie zatočenia.

Podržanie patrí k niektorým typom automatov; nie je univerzálnym pravidlom jednorukého banditu. Garancia rozhodnutia do troch pokusov je vlastnosť našej rozhodovacej aplikácie.

## Náhoda a tri pokusy

Pre N rovnocenných možností a tri nezávislé valce má ľubovoľná zhodná trojica pravdepodobnosť 1/N². Pravdepodobnosť aspoň jednej trojice za tri nezávislé pokusy je 1 − (1 − 1/N²)³:

| Možnosti | Trojica pri jednom pokuse | Aspoň jedna trojica za tri pokusy |
| --- | --- | --- |
| 2 | 25 % | 57,81 % |
| 3 | 11,11 % | 29,77 % |
| 4 | 6,25 % | 17,60 % |
| 5 | 4 % | 11,53 % |

Tabuľka opisuje nezávislé valce bez podržania a bez vynúteného finále, nie súčasný garantovaný tretí pokus. Čisto nezávislé valce teda nezaručia rozhodnutie do troch pokusov.

Odporúčanie: dva jasne pomenované režimy, voľba pred začiatkom dilemy.

1. **Čistá náhoda — predvolený.** Bez podržania. Prvé dva pokusy nezávislé; prirodzená trojica ukončí hru. Ak nenastane, tretí pokus rovnomerne vyžrebuje víťaznú možnosť a valce zobrazia jej trojicu. Pred ním text „Finálové žrebovanie — teraz padne rozhodnutie“. Každá možnosť má v celej hre rovnakú výslednú šancu 1/N: skoré výhry sú symetrické a finále rovnako. Žiadna história, poradie ani grafika nezvýhodňuje konkrétnu možnosť. Opakovanie výsledku je dovolené a patrí k náhode.
2. **Hra s podržaním — voliteľný.** Zachovať doterajší mechanizmus, jasne uviesť „Podržaním ovplyvňuješ výsledok“. Podržané valce svietia a zostávajú stáť. Pred tretím pokusom výslovne oznámiť, že podržaná možnosť bude dokončená. Bez podržania je finále rovnomerné. Tento režim nemá deklarovať rovnaké konečné šance pri používateľovej preferencii.

Používateľ potvrdil dva režimy s predvolenou čistou náhodou. Toto pravidlo je schválené pre implementáciu. Zmena režimu počas rozbehnutej dilemy nemá resetovať pokusy; povoliť ju pre novú dilemu.

## Štyri grafiky, jeden herný základ

Hamburger menu: Vzhľad mašiny (náhľady štyroch štýlov), Dark/Light, Zvuk a Pravidlá. Režim hry má byť viditeľný aj pri počítadle pokusov. Prepnutie grafiky nesmie zmeniť možnosti, výsledok, podržanie, históriu ani počet pokusov.

| Štýl | Vzhľad | Symboly |
| --- | --- | --- |
| Studio — predvolený | Grafit, medené detaily, hlboké okná valcov | Jednotné realistické predmety |
| Retro | Smalt, chróm, fyzická páka, decentné kontrolky | Rovnaké realistické predmety |
| Minimal | Čisté plochy, minimum dekorácií, veľké názvy | Rovnaké realistické predmety |
| Hravý | Súčasná fialová a zelená | Súčasné emoji |

Dark/Light je nezávislé od štýlu, Minimal preto nie je iba názov svetlého režimu. Najprv implementovať Studio ako referenčný návrh, potom ďalšie obaly nad spoločnými komponentmi. Tri grafiky môžu zdieľať realistickú sadu, netreba štyri databázy obrázkov.

## Praktické používanie

- Mašina a tlačidlo majú na mobile prednosť pred veľkým úvodným textom. Ovládanie aj bez páky.
- Krátka voliteľná otázka, 2–5 možností, názov do 40 znakov, pridanie cez Enter. Zachovať automatický výber ikonky aj ručnú opravu.
- Realistické lokálne obrázky pre bežné činnosti a jedlá; pri neznámom výraze neutrálny predmet a vždy čitateľný vlastný názov. Žiadne povinné AI volanie pri zadávaní.
- Po výsledku stále viditeľná Nová dilema. Najviac tri pokusy na dilemu, nie denne.
- Nastavenia sa ukladajú v aktuálnom prehliadači. LAN adresa a Tailscale adresa majú oddelené localStorage; synchronizácia medzi mobilom a PC zatiaľ neexistuje.

## Overenie pri implementácii

Overiť symetriu výsledkov matematicky a testami vetiev pravidiel, tretí pokus, podržanie, obnovu stránky a neplatný uložený stav. Náhodný štatistický test sám osebe nie je dôkazom férovosti. V prehliadači preveriť všetky vzhľady na mobile, zmenu štýlu bez resetu, ovládanie klávesnicou, vypnutý zvuk, obmedzený pohyb a návrat zo skrytej karty. Zachovať existujúce testy pokračovania po výsledku.
