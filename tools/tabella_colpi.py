"""tabella_colpi.py — QUANTI COLPI DI GETTO SERVE OGNI NEMICO, per grado di infezione.

    python tools\tabella_colpi.py

Stampa la tabella gia' in formato Markdown, pronta da incollare in ROADMAP.md §LA MISURA CHE
ORIENTA TUTTO.
⚠️ Misurata dal gioco vero, non calcolata a mano: e' la stessa tabella che nei documenti orienta
tutto il bilanciamento, e una tabella scritta a mano invecchia al primo numero che cambia."""
import functools
import http.server
import random
import socket
import socketserver
import sys
import threading
from pathlib import Path

RADICE = Path(r"C:\Users\ivanf\Claude\code\earwaxwar")

NOMI = {
    "flea": "pulce", "blob": "cerumino", "fly": "moscerino",
    "spit": "gorgogliante", "hopper": "saltatore", "crust": "crosta",
}

JS = r"""
async (tipi) => {
  const g = window.game, G = window.GameState;
  ['UpgradeScene','PauseScene','ShopScene','MenuScene'].forEach(k => { try { g.scene.stop(k); } catch(e){} });
  const righe = {};
  let getto = 0, nemiciInCampo = {};
  for (let grado = 0; grado <= window.CONFIG.INFEZIONE_MAX; grado++) {
    // ⚠️ prossimoLivello si imposta DOPO reset(): reset lo cancella, e senza mutatore spento la
    // misura sarebbe sporcata da vetro/corazza, che pesano piu' di un grado di infezione.
    G.reset();
    G.level = 5;
    G.infezione = grado;
    G.prossimoLivello = { kind: 'rush', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    const gs = g.scene.getScene('GameScene');
    let t = g.loop.time;
    for (let i = 0; i < 16; i++) { t += 16.6; g.loop.step(t); }
    getto = G.player.jetDamage;
    nemiciInCampo[grado] = gs.maxEnemies;
    tipi.forEach((tipo) => {
      const e = gs.spawnEnemy(tipo, { x: gs.player.x + 300 });
      if (!e) return;
      righe[tipo] = righe[tipo] || {};
      righe[tipo][grado] = Math.ceil(e.hp / getto);
      e.destroy();
    });
  }
  return { righe, getto, nemiciInCampo, max: window.CONFIG.INFEZIONE_MAX };
}
"""


def porta_libera():
    for _ in range(200):
        porta = random.randint(8000, 32000)
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", porta))
                return porta
            except OSError:
                continue
    return 8322


def main():
    from playwright.sync_api import sync_playwright

    class Silenzioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    porta = porta_libera()
    handler = functools.partial(Silenzioso, directory=str(RADICE))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", porta), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--mute-audio"])
        pagina = browser.new_page(viewport={"width": 960, "height": 540})
        pagina.goto(f"http://127.0.0.1:{porta}/", wait_until="load")
        pagina.wait_for_function(
            "() => window.game && window.game.scene "
            "&& window.game.scene.getScenes(true).some(s => s.scene.key === 'MenuScene')",
            timeout=90_000)
        res = pagina.evaluate(JS, list(NOMI))
        browser.close()
    httpd.shutdown()

    gradi = list(range(res["max"] + 1))
    print(f"| nemico | " + " | ".join(f"inf.{n}" if n == 0 else str(n) for n in gradi) + " |")
    print("|---|" + "---|" * len(gradi))
    for tipo, nome in NOMI.items():
        r = res["righe"].get(tipo, {})
        print(f"| {nome} | " + " | ".join(str(r.get(str(n), r.get(n, "?"))) for n in gradi) + " |")
    print(f"| _nemici in campo_ | "
          + " | ".join(str(res["nemiciInCampo"].get(str(n), res["nemiciInCampo"].get(n, "?"))) for n in gradi)
          + " |")
    print(f"\ndanno del getto (mai potenziato): {res['getto']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
