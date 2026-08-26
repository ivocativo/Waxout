"""armonizza_sfondo.py — porta un set di sfondo nella stessa famiglia di colore di un altro.

    python tools\\armonizza_sfondo.py 3 --come 2

⚠️ PERCHE' NON BASTA UNA TINTA NEL CODICE. La tinta di Phaser MOLTIPLICA: puo' spegnere e virare,
mai ravvivare. Con set nati desaturati (misurato il 2026-08-26: saturazione 0,31 e 0,20 contro lo
0,60 del set 2) il risultato restava smorto qualunque tinta si desse, e passando da un tratto
all'altro si sentiva lo stacco. Per ALZARE saturazione e luce bisogna toccare l'immagine.

Cosa fa: misura saturazione e luminosita' medie del set da correggere e del set di riferimento,
strato per strato, e applica i due fattori che li fanno combaciare.

⚠️ SI MISURANO SOLO I PIXEL VISIBILI. Meta' del primo piano e' trasparente: contando anche i
buchi, la media direbbe "scurissimo" e la correzione sparerebbe la luce alle stelle.

⚠️ I fattori sono limitati (0,7-2,2) e i valori vengono tagliati a 1: senza limite un set molto
piatto verrebbe bruciato invece che ravvivato — cioe' si sostituirebbe un difetto con un altro.

Ordine nella lavorazione: prepara -> bake -> **armonizza** -> rifinisci. Prima di rifinisci,
perche' e' meglio quantizzare DOPO aver spostato i colori: quantizzare prima e correggere poi
farebbe emergere le bande della tavolozza ridotta.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
RADICE = Path(__file__).resolve().parent.parent
STRATI = [("far", "jpg"), ("mid", "png"), ("near", "png")]
LIMITE = (0.7, 2.2)


def apri(cartella, n, ruolo, est):
    f = cartella / f"bg{n}_{ruolo}.{est}"
    return (f, Image.open(f).convert("RGBA")) if f.exists() else (f, None)


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


def main():
    if len(sys.argv) < 2:
        print("Uso: python tools\\armonizza_sfondo.py <set> [--come <set di riferimento>]")
        return 2
    n = sys.argv[1]
    rif = sys.argv[sys.argv.index("--come") + 1] if "--come" in sys.argv else "2"
    cartella = RADICE / "assets" / "backgrounds" / n
    cartella_rif = RADICE / "assets" / "backgrounds" / rif
    if not cartella.is_dir() or not cartella_rif.is_dir():
        print("Cartella non trovata")
        return 2

    for ruolo, est in STRATI:
        f, im = apri(cartella, n, ruolo, est)
        _, im_rif = apri(cartella_rif, rif, ruolo, est)
        if im is None or im_rif is None:
            print(f"{ruolo}: manca un'immagine, salto")
            continue
        s0, v0 = misura(im)
        s1, v1 = misura(im_rif)
        if s0 is None or s1 is None or s0 < 0.01:
            print(f"{ruolo}: troppo poco visibile per misurare, salto")
            continue
        fs = min(max(s1 / s0, LIMITE[0]), LIMITE[1])
        fv = min(max(v1 / v0, LIMITE[0]), LIMITE[1])
        fuori = correggi(im, fs, fv)
        if est == "jpg":
            fondo = Image.new("RGB", fuori.size, (26, 12, 20))
            fondo.paste(fuori, (0, 0), fuori)
            fondo.save(f, quality=86, optimize=True)
        else:
            fuori.save(f)
        s2, v2 = misura(Image.open(f).convert("RGBA"))
        print(f"{ruolo:5}: saturazione {s0:.3f} -> {s2:.3f} (riferimento {s1:.3f}), "
              f"luce {v0:.3f} -> {v2:.3f} (riferimento {v1:.3f})")
    print(f"\nOra: python tools\\rifinisci_sfondo.py {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
