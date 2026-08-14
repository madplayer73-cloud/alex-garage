# Alex Garage

Súkromná rodinná aplikácia s úlohami, odznakmi a motiváciou v podobe červeného Yarisu. Je pripravená na beh v domácej sieti na CasaOS.

## Čo aplikácia obsahuje

- tri účty s vlastným PIN-om: Alex, mama a otec,
- týždenný cieľ 10 bodov od každého rodiča,
- bodovú hodnotu úlohy určenú rodičom,
- voliteľný alebo povinný fotografický dôkaz,
- schválenie iba rodičom, ktorý úlohu zadal,
- odomknutie Yarisu na nasledujúci týždeň,
- Alexove finančné požiadavky a podmienené misie,
- herné odznaky, bezchybné týždne a trojtýždňové série,
- históriu úloh, bodov, odmien a vyplatených požiadaviek.

## Prvé spustenie

Pri prvom otvorení aplikácia vyžiada mená a PIN-y všetkých troch členov rodiny. PIN musí mať 4 až 8 číslic. Ukladá sa iba jeho zabezpečený odtlačok.

## Spustenie na CasaOS

1. Skopírujte celý priečinok projektu na CasaOS server, napríklad do `/DATA/AppData/alex-garage-src`.
2. Cez SSH otvorte daný priečinok.
3. Spustite:

   ```bash
   docker compose up -d --build
   ```

4. V telefóne alebo počítači otvorte `http://IP_ADRESA_CASAOS:3008`.
5. Dokončite prvé rodinné nastavenie.

CasaOS používa štandardný Docker Compose formát. Aplikácia publikuje port `3008` a všetky trvalé dáta uchováva v priečinku `alex-garage-data`. Konfigurácia zodpovedá aktuálnemu Compose modelu používanému v CasaOS AppStore.

## Záloha

Zálohujte celý priečinok `alex-garage-data`. Obsahuje databázu aj fotografie. Pred kopírovaním zálohy je najistejšie kontajner na chvíľu zastaviť:

```bash
docker compose stop
docker compose start
```

## Neskorší prístup cez Tailscale

Po pridaní CasaOS servera a telefónov do rovnakej Tailscale siete zostane aplikácia na porte `3008`. Otvorí sa cez Tailscale IP adresu servera. Port neotvárajte priamo do internetu cez router.

## Lokálny vývoj

Vyžaduje Node.js 22 alebo novší.

```bash
npm install
npm run dev
```

Produkčná kontrola a lokálny server:

```bash
npm run build
npm start
```

Predvolená lokálna adresa je `http://localhost:3000` a dáta sa ukladajú do priečinka `data`.
