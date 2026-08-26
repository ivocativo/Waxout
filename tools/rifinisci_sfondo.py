"""rifinisci_sfondo.py — ultima passata su un set di sfondo COTTO: bordi puliti e peso ridotto.

    python tools\\rifinisci_sfondo.py 3

Da lanciare dopo `bake_background_set.ps1`. Fa due cose sui due strati con trasparenza
(`bg<N>_mid.png`, `bg<N>_near.png`).

1) TOGLIE LA FRANGIA MAGENTA.
   ⚠️ Scontornare non basta mai del tutto: sul bordo restano pixel a meta' fra l'arte e la chiave,
   e quella meta' e' magenta. Misurato sul materiale del 2026-08-24: **1-2% dei pixel visibili**
   aveva una dominante magenta, e a schermo si vedeva come un contorno viola attorno alle
   formazioni (se n'e' accorto l'utente guardando le anteprime).
   Rimedio in due tempi:
   - **si erode l'alpha** di un paio di pixel: la sagoma si stringe di un'inezia — su uno sfondo
     non se ne accorge nessuno — e si porta via l'intera fascia sporca;
   - **despill** su cio' che resta: dove rosso E blu stanno tutti e due ben sopra il verde, si
     riportano giu'. ⚠️ La condizione e' "tutti e due": l'arte e' rosa e malva, cioe' ha comunque
     il rosso sopra il verde, e una regola piu' larga la scolorirebbe invece di pulirla.

2) RIDUCE IL PESO a un quinto, portando la tavolozza a 256 colori.
   Misurato: lo strato di mezzo passa da 2.988 KB a 608 KB **senza differenza visibile** — l'arte
   pittorica usa sfumature vicine dentro una gamma stretta, il caso in cui 256 colori bastano.
   Senza questo passaggio quattro set raddoppiavano il peso dell'app.
   FASTOCTREE e' l'unico metodo di Pillow che quantizza TENENDO la trasparenza.

Non tocca il `far`: e' un JPG, non ha ne' trasparenza ne' tavolozza.
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


def rifinisci(f):
    im = Image.open(f).convert("RGBA")
    prima = np.asarray(im, dtype=np.int16)
    r0, g0, b0, a0 = prima[:, :, 0], prima[:, :, 1], prima[:, :, 2], prima[:, :, 3]
    vuoto0 = Image.fromarray(((a0 < 10) * 255).astype(np.uint8))
    bordo0 = np.asarray(vuoto0.filter(ImageFilter.MaxFilter(7))) > 0
    sporchi_prima = int((((a0 > 10) & bordo0 & (r0 - g0 > SOGLIA) & (b0 - g0 > SOGLIA))).sum())

    # 1a-bis — CHIAZZE DI MAGENTA RIMASTE OPACHE. ⚠️ Non e' la frangia del bordo: e' chiave che lo
    # scontorno non ha proprio riconosciuto, e resta li' come una macchia viola in mezzo all'arte
    # (nel set 3 erano 16.240 pixel, e si vedevano nel menu). Succede dove il magenta della
    # sorgente e' sporco — JPEG, ombre — e finisce fuori dalla tolleranza dello scontorno.
    # Qui la regola e' STRETTISSIMA (rosso e blu quasi al massimo, verde molto basso): l'arte rosa
    # non ci arriva mai nemmeno dopo che e' stata ravvivata.
    a0m = np.asarray(im, dtype=np.int16)
    chiazza = ((a0m[:, :, 3] > 10) & (a0m[:, :, 0] > 170) & (a0m[:, :, 2] > 170) & (a0m[:, :, 1] < 100))
    chiazze_tolte = int(chiazza.sum())
    if chiazze_tolte:
        # allargata di un pixel, per portarsi via anche l'alone attorno
        maschera = Image.fromarray((chiazza * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
        alpha0 = np.asarray(im.getchannel("A")).copy()
        alpha0[np.asarray(maschera) > 0] = 0
        im.putalpha(Image.fromarray(alpha0))

    # 1a — erosione dell'alpha: il minimo su una finestra 5x5 spegne i bordi
    alpha = im.getchannel("A").filter(ImageFilter.MinFilter(EROSIONE))
    im.putalpha(alpha)

    # 1b — despill su quel che resta, SOLO LUNGO IL BORDO.
    # ⚠️ La condizione sul colore da sola NON BASTA, e crederlo e' costato un giro: ravvivando
    # l'arte (armonizza_sfondo.py) la pittura rosa comincia a soddisfarla, e il despill si e'
    # mangiato 1,3 MILIONI di pixel di disegno invece dei pochi del contorno. La frangia vive
    # attaccata alla trasparenza: si guarda li' e basta.
    alpha_np = np.asarray(alpha)
    trasparente = Image.fromarray(((alpha_np < 10) * 255).astype(np.uint8))
    vicino_al_vuoto = np.asarray(trasparente.filter(ImageFilter.MaxFilter(7))) > 0
    a = np.asarray(im, dtype=np.int16)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    frangia = (al > 10) & vicino_al_vuoto & (r - g > SOGLIA) & (b - g > SOGLIA)
    tetto = g + SOGLIA
    a[:, :, 0] = np.where(frangia, np.minimum(r, tetto), r)
    a[:, :, 2] = np.where(frangia, np.minimum(b, tetto), b)
    pulita = Image.fromarray(a.astype(np.uint8), "RGBA")

    dopo = np.asarray(pulita, dtype=np.int16)
    r1, g1, b1, a1 = dopo[:, :, 0], dopo[:, :, 1], dopo[:, :, 2], dopo[:, :, 3]
    vuoto1 = Image.fromarray(((a1 < 10) * 255).astype(np.uint8))
    bordo1 = np.asarray(vuoto1.filter(ImageFilter.MaxFilter(7))) > 0
    sporchi_dopo = int((((a1 > 10) & bordo1 & (r1 - g1 > SOGLIA) & (b1 - g1 > SOGLIA))).sum())

    peso_prima = f.stat().st_size
    pulita.quantize(colors=COLORI, method=Image.FASTOCTREE).save(f, optimize=True)
    peso_dopo = f.stat().st_size
    print(f"{f.name}: frangia {sporchi_prima} -> {sporchi_dopo} pixel"
          f"  |  chiazze tolte {chiazze_tolte} pixel"
          f"  |  peso {peso_prima / 1024:.0f} KB -> {peso_dopo / 1024:.0f} KB")


def main():
    if len(sys.argv) < 2:
        print("Uso: python tools\\rifinisci_sfondo.py <numero del set>")
        return 2
    n = sys.argv[1]
    cartella = RADICE / "assets" / "backgrounds" / n
    if not cartella.is_dir():
        print(f"Cartella non trovata: {cartella}")
        return 2
    for ruolo in ("mid", "near"):
        f = cartella / f"bg{n}_{ruolo}.png"
        if f.exists():
            rifinisci(f)
        else:
            print(f"Manca {f.name}: salto")
    return 0


if __name__ == "__main__":
    sys.exit(main())
