# Osud rozhodol na CasaOS

## Odporúčané: GitHub → CasaOS

Na serveri stačí Git a Docker. Nemusíš nahrávať ZIP, inštalovať Node.js ani spúšťať npm. Repozitár už obsahuje hotovú aplikáciu v `deploy/site`.

Prvé nasadenie do nového priečinka:

```sh
cd /DATA/AppData
git clone --branch main https://github.com/madplayer73-cloud/alex-garage.git osud
cd osud
docker compose up -d --build
```

Ak priečinok `osud` už existuje, neprepisuj ho naslepo. V existujúcom checkoute tohto repozitára použi aktualizačné príkazy nižšie. Existujúce iné aplikácie sa týmto nasadením nemenia.

Ďalšie aktualizácie:

```sh
cd /DATA/AppData/osud
git pull --ff-only origin main
docker compose up -d --build
```

Ak na CasaOS nie je nainštalovaný Git, namiesto jeho inštalácie môžeš použiť jednorazový kontajner. Prvé stiahnutie:

```sh
sudo mkdir -p /DATA/AppData/osud &&
sudo docker run --rm --user 0:0 -v /DATA/AppData/osud:/git -w /git alpine/git clone --depth 1 --branch main https://github.com/madplayer73-cloud/alex-garage.git . &&
cd /DATA/AppData/osud &&
sudo docker compose up -d --build
```

Ďalšie aktualizácie bez Gitu na serveri:

```sh
sudo docker run --rm --user 0:0 -v /DATA/AppData/osud:/git -w /git alpine/git pull --ff-only origin main &&
cd /DATA/AppData/osud &&
sudo docker compose up -d --build
```

Otvor `http://IP_ADRESA_SERVERA:8099`.

Ide o ručnú aktualizáciu z GitHubu: aplikácia si sama nové verzie nesťahuje. Po reštarte servera sa kontajner spustí automaticky.

## Alternatíva: pripravený balík (bez Node.js)

Balík `osud-casaos.zip` obsahuje hotovú aplikáciu a Docker konfiguráciu. Nepotrebuje databázu ani heslá. Server pri prvom spustení potrebuje prístup k Docker Hub na stiahnutie obrazu Nginx. Obraz podporuje bežné amd64 aj arm64 servery.

1. Stiahni a rozbaľ `osud-casaos.zip` na svojom počítači.
2. Cez správcu súborov v CasaOS nahraj celý rozbalený priečinok `osud` do `/DATA/AppData/`. Súbory musia byť v `/DATA/AppData/osud/`; Dockerfile a docker-compose.yml musia byť priamo v tomto priečinku, vedľa podpriečinka `dist`.
3. V termináli CasaOS alebo cez SSH spusti:

   ```sh
   cd /DATA/AppData/osud
   docker compose up -d --build
   docker compose ps
   ```

4. Otvor v prehliadači `http://IP_ADRESA_SERVERA:8099`.

Ak tvoj používateľ nemá prístup k Dockeru, pred príkazy `docker` pridaj `sudo`. Pri SSH používaj existujúce prihlásenie k svojmu serveru; do chatu neposielaj heslá ani súkromné kľúče.

## Port a ikona v CasaOS

Predvolený port je **8099**. Ak je obsadený, spusti prvý príkaz napríklad ako `OSUD_PORT=8100 docker compose up -d --build` a potom používaj port 8100. Alternatívne vedľa docker-compose.yml vytvor súbor `.env` s riadkom `OSUD_PORT=8100`, aby sa port použil aj pri ďalšom spustení.

Ak CasaOS aplikáciu nezobrazí automaticky, pridaj ju na plochu ako vlastný odkaz s názvom **Osud rozhodol** a adresou `http://IP_ADRESA_SERVERA:8099`. Pri inom porte uprav aj odkaz. Nespoliehaj sa na samotný import Compose YAML v rozhraní CasaOS: táto aplikácia používa lokálne súbory v build kontexte, preto ju najprv spusti z priečinka príkazom vyššie.

## Overenie a správa

```sh
cd /DATA/AppData/osud
docker compose ps
docker compose logs --tail=50 osud
curl --fail http://127.0.0.1:8099/
```

V aplikácii zadaj tri možnosti, roztoč valce a po prvom neúspešnom pokuse skús Podržať. Najneskôr tretie zatočenie musí rozhodnúť. Obnovenie stránky zachová počet pokusov aj výsledok.

Zastavenie: `docker compose down` z rovnakého priečinka. Opätovné spustenie: `docker compose up -d`. Aplikácia sa po reštarte servera automaticky spustí.

## Dáta

Možnosti, roztočená dilema, história a zvuk sa ukladajú v **localStorage konkrétneho prehliadača**, nie na serveri. Telefón a počítač majú vlastné dáta. Zmena adresy, portu alebo protokolu sa v prehliadači správa ako nové úložisko; pôvodné dáta tým nie sú vymazané. Na serveri sa nevytvára databáza ani dátový volume.

## Aktualizácia

Nahraj nový obsah balíka do rovnakého priečinka a znovu spusti `docker compose up -d --build`. Prehliadač stiahne aktuálny HTML súbor; verziované JS/CSS súbory majú vlastné názvy. Pri nezmenenej adrese, porte a formáte úložiska zostanú dáta prehliadača zachované.

## Spustenie zo zdrojového repozitára

Pri práci na zdrojovom kóde na vývojovom počítači spusti `npm ci`, `npm test` a `npm run build`. Build zároveň obnoví verzovaný priečinok `deploy/site`. Zdrojové zmeny aj tento priečinok odošli spolu na GitHub. Docker v hlavnom repozitári nasadzuje `deploy/site`; ZIP používa hotový `dist`. Ani jedna cesta nevyžaduje Node.js na CasaOS serveri.
