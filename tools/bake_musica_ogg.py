"""bake_musica_ogg.py — converte un brano (FLAC/WAV/MP3/OGG) nel formato che usa il gioco.

    python tools\\bake_musica_ogg.py <file sorgente> <nome> [--secondi 90]

Scrive `assets/musica/<nome>.ogg` a **76 kbit/s**, che e' il bitrate misurato dei brani gia' nel
gioco: cosi' i nuovi pesano quanto i vecchi e non stonano nel volume.

⚠️ PERCHE' SERVE: su OpenGameArt i brani stanno spesso in FLAC o WAV, cioe' senza compressione —
i cinque scaricati il 2026-08-26 pesavano 28, 38, 44 e 6,6 MB. Metterli nell'app cosi' com'erano
avrebbe moltiplicato per venti il peso della musica.

⚠️ IL TAGLIO E' UNA SCELTA DI PESO, non artistica: la musica costa **9 KB al secondo** a questo
bitrate, quindi un brano di tre minuti costa 1,6 MB e uno di 90 secondi ne costa 0,8. Si taglia
con una DISSOLVENZA in coda (`--secondi`), se no il loop stacca di netto e si sente.
"""
import sys
from pathlib import Path

import av
import numpy as np

RADICE = Path(__file__).resolve().parent.parent
BITRATE = 76_000
DISSOLVENZA = 4.0        # secondi di sfumatura finale, quando si taglia


def leggi(sorgente, freq_voluta=None):
    """Restituisce (campioni float32 interlacciati stereo, frequenza)."""
    with av.open(str(sorgente)) as c:
        flusso = c.streams.audio[0]
        freq = freq_voluta or flusso.codec_context.sample_rate
        pezzi = []
        risampler = av.audio.resampler.AudioResampler(format="fltp", layout="stereo", rate=freq)
        for frame in c.decode(audio=0):
            for f in risampler.resample(frame):
                pezzi.append(f.to_ndarray())
    if not pezzi:
        raise SystemExit("Nessun audio nel file")
    return np.concatenate(pezzi, axis=1), freq


def scrivi(dati, freq, fuori):
    with av.open(str(fuori), "w") as c:
        # ⚠️ OPUS, non Vorbis, e non e' un capriccio: il codificatore Vorbis interno di FFmpeg
        # IGNORA il bitrate richiesto (misurato: 90 secondi uscivano da 2 MB invece di 0,8, e ne'
        # `bit_rate` ne' l'opzione "b" lo smuovevano), mentre libopus lo rispetta. A parita' di
        # peso Opus suona anche meglio di Vorbis.
        # ⚠️ Sta comunque dentro un contenitore .ogg, come gli altri brani: cambia il codificatore,
        # non l'estensione. Chrome, Firefox e la WebView di Android lo leggono — verificato
        # caricandolo davvero nel browser, non dandolo per scontato (controllo [61]).
        flusso = c.add_stream("libopus", rate=48000)
        flusso.bit_rate = BITRATE
        # ⚠️ A blocchi: un frame unico da diversi minuti fa esplodere la memoria del codificatore.
        blocco = 8192
        for i in range(0, dati.shape[1], blocco):
            pezzo = np.ascontiguousarray(dati[:, i:i + blocco], dtype=np.float32)
            frame = av.AudioFrame.from_ndarray(pezzo, format="fltp", layout="stereo")
            frame.sample_rate = freq
            frame.pts = None
            for p in flusso.encode(frame):
                c.mux(p)
        for p in flusso.encode(None):
            c.mux(p)


def main():
    if len(sys.argv) < 3:
        print("Uso: python tools\\bake_musica_ogg.py <sorgente> <nome> [--secondi N]")
        return 2
    sorgente, nome = sys.argv[1], sys.argv[2]
    secondi = None
    if "--secondi" in sys.argv:
        secondi = float(sys.argv[sys.argv.index("--secondi") + 1])

    dati, freq = leggi(sorgente, 48000)   # Opus lavora a 48 kHz
    durata = dati.shape[1] / freq
    if secondi and durata > secondi:
        n = int(secondi * freq)
        dati = dati[:, :n]
        # dissolvenza in coda: senza, il loop stacca di netto e si sente
        d = int(min(DISSOLVENZA, secondi / 4) * freq)
        if d > 0:
            dati[:, -d:] *= np.linspace(1.0, 0.0, d, dtype=np.float32)

    fuori = RADICE / "assets" / "musica" / f"{nome}.ogg"
    scrivi(dati, freq, fuori)
    kb = fuori.stat().st_size / 1024
    print(f"{Path(sorgente).name} -> {fuori.name}: "
          f"{durata:.0f}s originali, {dati.shape[1] / freq:.0f}s tenuti, {kb:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
