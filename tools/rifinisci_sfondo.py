"""rifinisci_sfondo.py — tutta la lavorazione che viene DOPO la cottura, nell'ordine giusto.

    python tools\rifinisci_sfondo.py 4 [--come 2]

Quattro passaggi su `bg<N>_mid.png` e `bg<N>_near.png` (il `far` e' un JPG: niente trasparenza,
niente tavolozza, si limita all'armonizzazione del colore).

⚠️ L'ORDINE E' IL PUNTO, ed e' per questo che i quattro passaggi stanno in UN SOLO strumento e non
in tre. Quando la pulizia del magenta girava DOPO l'armonizzazione, su una pittura molto satura
scambiava i punti luce dell'arte per chiave e le bucava — a schermo si vedevano quadratini di
sfondo dentro le formazioni (successo davvero col set 4, 2026-08-26). La chiave e' pura solo
appena usciti dalla cottura: e' li' che va tolta.

1. CHIAZZE DI MAGENTA rimaste opache: chiave che lo scontorno non ha riconosciuto affatto (nel
   set 3 erano 16.240 pixel, e si vedevano nel menu). Regola strettissima, e applicata quando
   l'arte e' ancora nei suoi colori originali.
2. FRANGIA SUL BORDO: si erode il contorno di 2px e si fa il despill su cio' che resta.
   ⚠️ Solo lungo il bordo: la condizione sul colore da sola, su arte rosa, prende anche il disegno.
3. ARMONIZZAZIONE verso un set di riferimento: saturazione e luce misurate SOI PIXEL VISIBILI
   (meta' del primo piano e' trasparente: contando i buchi la media direbbe "scurissimo").
   ⚠️ Serve perche' la tinta di Phaser moltiplica: puo' spegnere e virare, mai ravvivare.
4. PESO: tavolozza a 256 colori, che porta gli strati a un quinto senza differenza visibile.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
RADICE = Path(__file__).resolve().parent.parent

EROSIONE = 5        # lato del filtro di minimo: 5 = due pixel via per lato
SOGLIA = 40         # di quanto rosso e blu devono superare il verde per dirsi "frangia"
COLORI = 256
LIMITE = (0.7, 2.2)   # quanto si puo' spingere l'armonizzazione, in su e in giu'


def misura(im):
    """Saturazione e luminosita' medie dei soli pixel visibili."""
    a = np.asarray(im, dtype=np.float32) / 255
    visibile = a[:, :, 3] > 0.4
    if visibile.sum() < 100:
        return None, None
    rgb = a[:, :, :3][visibile]
    mx = rgb.max(axis=1)
    mn = rgb.min(axis=1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return float(sat.mean()), float(mx.mean())


def correggi(im, fs, fv):
    a = np.asarray(im, dtype=np.float32) / 255
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    grigio = rgb.mean(axis=2, keepdims=True)
    # saturazione: si allontana ogni canale dal proprio grigio
    rgb = np.clip(grigio + (rgb - grigio) * fs, 0, 1)
    rgb = np.clip(rgb * fv, 0, 1)
    fuori = np.concatenate([rgb, alpha[:, :, None]], axis=2)
    return Image.fromarray((fuori * 255).astype(np.uint8), "RGBA")



def togli_chiazze(im):
    """Chiave rimasta opaca in mezzo all'arte. Da fare PRIMA di ravvivare i colori."""
    a = np.asarray(im, dtype=np.int16)
    chiazza = ((a[:, :, 3] > 10) & (a[:, :, 0] > 170) & (a[:, :, 2] > 170) & (a[:, :, 1] < 100)
               & (np.abs(a[:, :, 0] - a[:, :, 2]) < 45))
    quante = int(chiazza.sum())
    if quante:
        maschera = Image.fromarray((chiazza * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
        alpha = np.asarray(im.getchannel("A")).copy()
        alpha[np.asarray(maschera) > 0] = 0
        im.putalpha(Image.fromarray(alpha))
    return quante


def togli_frangia(im):
    """Erosione del contorno + despill, SOLO lungo il bordo."""
    alpha = im.getchannel("A").filter(ImageFilter.MinFilter(EROSIONE))
    im.putalpha(alpha)
    trasparente = Image.fromarray(((np.asarray(alpha) < 10) * 255).astype(np.uint8))
    bordo = np.asarray(trasparente.filter(ImageFilter.MaxFilter(7))) > 0
    a = np.asarray(im, dtype=np.int16)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    frangia = (al > 10) & bordo & (r - g > SOGLIA) & (b - g > SOGLIA)
    quante = int(frangia.sum())
    tetto = g + SOGLIA
    a[:, :, 0] = np.where(frangia, np.minimum(r, tetto), r)
    a[:, :, 2] = np.where(frangia, np.minimum(b, tetto), b)
    return Image.fromarray(a.astype(np.uint8), "RGBA"), quante


def fattori(im, im_rif):
    s0, v0 = misura(im)
    s1, v1 = misura(im_rif)
    if s0 is None or s1 is None or s0 < 0.01:
        return 1.0, 1.0
    return (min(max(s1 / s0, LIMITE[0]), LIMITE[1]),
            min(max(v1 / v0, LIMITE[0]), LIMITE[1]))


def main():
    if len(sys.argv) < 2:
        print("Uso: python tools\rifinisci_sfondo.py <set> [--come <set di riferimento>]")
        return 2
    n = sys.argv[1]
    rif = sys.argv[sys.argv.index("--come") + 1] if "--come" in sys.argv else "2"
    cartella = RADICE / "assets" / "backgrounds" / n
    cartella_rif = RADICE / "assets" / "backgrounds" / rif
    if not cartella.is_dir():
        print(f"Cartella non trovata: {cartella}")
        return 2

    for ruolo, est in [("far", "jpg"), ("mid", "png"), ("near", "png")]:
        f = cartella / f"bg{n}_{ruolo}.{est}"
        f_rif = cartella_rif / f"bg{rif}_{ruolo}.{est}"
        if not f.exists():
            print(f"Manca {f.name}: salto")
            continue
        im = Image.open(f).convert("RGBA")
        peso_prima = f.stat().st_size
        chiazze = frangia = 0
        if est == "png":
            chiazze = togli_chiazze(im)
            im, frangia = togli_frangia(im)
        if f_rif.exists() and n != rif:
            fs, fv = fattori(im, Image.open(f_rif).convert("RGBA"))
            im = correggi(im, fs, fv)
        else:
            fs = fv = 1.0
        if est == "jpg":
            fondo = Image.new("RGB", im.size, (26, 12, 20))
            fondo.paste(im, (0, 0), im)
            fondo.save(f, quality=86, optimize=True)
        else:
            im.quantize(colors=COLORI, method=Image.FASTOCTREE).save(f, optimize=True)
        print(f"{f.name}: chiazze {chiazze}, frangia {frangia}, "
              f"colore x{fs:.2f} sat x{fv:.2f} luce  |  "
              f"peso {peso_prima / 1024:.0f} -> {f.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
