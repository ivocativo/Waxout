"""prepara_sfondo.py — mette in ordine le immagini appena generate, PRIMA della cottura.

    python tools\\prepara_sfondo.py 3

Legge `assets/backgrounds/<N>/back|mid|front.(png|jpg)` — i nomi con cui escono dai generatori —
e scrive i tre file coi nomi che si aspetta `bake_background_set.ps1`:

    back  -> fondale.png        mid -> mid.png        front -> primo piano.png

Ma soprattutto fa la cosa per cui esiste: **SPIANA I BORDI**.

⚠️ I generatori consegnano sempre immagini piu' chiare al centro e piu' scure ai bordi: e' la
vignettatura, che in una illustrazione da guardare e' bella e in uno sfondo che SCORRE E SI RIPETE
e' un difetto. Misurato sul materiale del 2026-08-24: dal +24% al +49% di luminosita' fra centro e
bordi. Il gioco affianca l'immagine alla propria copia specchiata, quindi quei due bordi scuri si
trovano appiccicati e diventano una BANDA SCURA che ripassa a ogni giro dello sfondo.

Come si spiana: si misura la luminosita' media di ogni COLONNA, si smussa il profilo, e si
riporta ogni colonna alla luminosita' mediana. Solo le colonne — le righe non contano, perche' in
alto e in basso ci sono soffitto e terreno del gioco a coprire.

⚠️ Il magenta e' ESCLUSO dal conto e dalla correzione: e' una chiave, non un colore dell'immagine.
Includendolo si sposterebbe la media dove ci sono i buchi (che sono meta' del primo piano) e la
correzione lavorerebbe al contrario proprio dove serve.

⚠️ Il guadagno e' limitato fra 0,75 e 1,6: senza limite, un bordo quasi nero verrebbe moltiplicato
per dieci e diventerebbe una banda slavata — cioe' lo stesso difetto, di un altro colore.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
RADICE = Path(__file__).resolve().parent.parent

# come si chiamano in uscita, nell'ordine in cui il gioco li impila
NOMI = [("back", "fondale.png"), ("mid", "mid.png"), ("front", "primo piano.png")]
GUADAGNO_MIN, GUADAGNO_MAX = 0.75, 1.6


def trova(cartella, base):
    for est in (".png", ".jpg", ".jpeg", ".webp"):
        p = cartella / (base + est)
        if p.exists():
            return p
    return None


def spiana(im):
    """Toglie la vignettatura orizzontale. Restituisce (immagine, quanto era marcata)."""
    a = np.asarray(im.convert("RGB"), dtype=np.float64)
    lum = a.mean(axis=2)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    magenta = (r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 70)
    utile = ~magenta

    # media per colonna, contando solo i pixel veri
    somma = np.where(utile, lum, 0).sum(axis=0)
    conta = utile.sum(axis=0)
    valide = conta > (im.height * 0.05)          # colonne quasi tutte magenta: non dicono niente
    if valide.sum() < 10:
        return im, 0.0
    profilo = np.full(im.width, np.nan)
    profilo[valide] = somma[valide] / conta[valide]
    # le colonne senza dati prendono il valore delle vicine
    indici = np.arange(im.width)
    profilo = np.interp(indici, indici[valide], profilo[valide])

    # smussatura larga: si vuole l'ANDAMENTO del bordo scuro, non il dettaglio dell'arte
    finestra = max(9, (im.width // 8) | 1)
    nucleo = np.ones(finestra) / finestra
    liscio = np.convolve(np.pad(profilo, finestra, mode="edge"), nucleo, mode="same")[finestra:-finestra]

    bersaglio = np.median(liscio)
    marcata = 100 * (liscio.max() - liscio.min()) / max(bersaglio, 1)
    guadagno = np.clip(bersaglio / np.maximum(liscio, 1), GUADAGNO_MIN, GUADAGNO_MAX)

    corretta = np.clip(a * guadagno[None, :, None], 0, 255)
    # dove c'e' la chiave si tiene il magenta com'era: correggerlo lo sporcherebbe
    corretta[magenta] = a[magenta]
    return Image.fromarray(corretta.astype(np.uint8)), marcata


def main():
    if len(sys.argv) < 2:
        print("Uso: python tools\\prepara_sfondo.py <numero del set>")
        return 2
    n = sys.argv[1]
    cartella = RADICE / "assets" / "backgrounds" / n
    if not cartella.is_dir():
        print(f"Cartella non trovata: {cartella}")
        return 2

    for base, uscita in NOMI:
        sorgente = trova(cartella, base)
        if not sorgente:
            print(f"Manca {base}.*: salto")
            continue
        im = Image.open(sorgente)
        pulita, marcata = spiana(im)
        pulita.save(cartella / uscita)
        print(f"{sorgente.name:12} -> {uscita:16} bordi spianati (erano {marcata:.0f}% piu' scuri)")
    print("\nOra: powershell -NoProfile -File tools\\bake_background_set.ps1 -Set " + n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
