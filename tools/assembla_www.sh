#!/usr/bin/env bash
# assembla_www.sh — prepara la cartella `www` che Capacitor impacchetta nell'app.
#
#     bash tools/assembla_www.sh
#
# ⚠️ ESISTE PER NON AVERE DUE ELENCHI. Questa lista viveva copiata dentro TUTTI E DUE i workflow —
# quello dell'APK di prova e quello dell'AAB da pubblicare. Il 2026-08-26 sono stati aggiunti set
# di sfondo nuovi e le texture del cerume sono passate da testo incorporato a file: il primo
# workflow e' stato aggiornato, il secondo no. Risultato: l'APK con cui si prova era a posto e IL
# PACCHETTO DA PUBBLICARE sarebbe uscito senza le texture del cerume e con un solo sfondo su tre.
# Nessun controllo poteva accorgersene — il gioco sul computer legge dal disco e trova tutto.
# Due elenchi della stessa cosa divergono sempre; qui ce n'e' uno solo, e lo usano entrambi.
#
# ⚠️ NON si fa `cp -r assets www`: dentro assets/ ci sono anche le sorgenti di lavorazione (i
# disegni originali, le pose scartate), che nell'app non servono. Si copia quello che serve.
set -e

rm -rf www
mkdir -p www/assets/backgrounds www/assets/spritesheets/hero www/assets/spritesheets/enemies

cp index.html www/
cp -r vendor src www/

# Cartelle che si copiano per intero.
# ⚠️ assets/wax dal 2026-08-26: prima era incorporato come data URI in src/assets_data.js, cioe'
# 2,17 MB di TESTO dentro il codice — piu' pesante dei PNG (il base64 costa un terzo in piu') e da
# rileggere a ogni avvio. Resta incorporato solo il fondale di ripiego, pochi KB.
cp -r assets/sprites assets/musica assets/wax www/assets/

# SFONDI: i file COTTI di OGNI set, TROVATI e non elencati.
# ⚠️ Prima era scritto a mano il solo set 2, e aggiungendone altri l'app sarebbe partita senza.
# Un elenco a mano di cose che si aggiungono nel tempo e' una trappola che scatta sempre, e sempre
# in ritardo. Le sorgenti (fondale.png, mid.png, back.jpg...) restano fuori: servono a ricuocere.
for f in assets/backgrounds/*/bg*_far.jpg assets/backgrounds/*/bg*_mid.png assets/backgrounds/*/bg*_near.png; do
  [ -e "$f" ] || continue
  mkdir -p "www/$(dirname "$f")"
  cp "$f" "www/$f"
done

# Fogli di animazione: solo quelli cotti (_px per il personaggio).
cp assets/spritesheets/hero/*_px.png www/assets/spritesheets/hero/
cp assets/spritesheets/enemies/*.png www/assets/spritesheets/enemies/

echo "--- peso della cartella www ---"
du -sh www www/src www/assets/* | sort -h
