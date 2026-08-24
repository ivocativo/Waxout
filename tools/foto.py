# foto.py — FOTOGRAFA UNA SCENA DEL GIOCO e la salva come immagine.
#
#     python tools\foto.py assedio            -> foto_assedio.png
#     python tools\foto.py assedio schermo.png
#     python tools\foto.py assedio --gif      -> foto_assedio.gif (breve animazione)
#
# La GIF serve per le cose che si giudicano SOLO in movimento: una nebbia ferma sembra una
# macchia, e si capisce se funziona guardandola scorrere. Costa una manciata di secondi.
#
# A cosa serve: certe cose si giudicano SOLO guardandole, e i numeri non bastano. La valanga
# dell'assedio funzionava perfettamente a misure — avanzava alla velocita' giusta, faceva danno,
# risparmiava i nemici — ed era INVISIBILE, perche' il poligono riempiva il terreno invece del
# corridoio. Se ne e' accorto l'utente chiedendo uno screenshot (2026-08-21).
#
# Perche' non basta il browser di anteprima: la tela del gioco e' WebGL e non si puo' rileggere
# fuori dal suo ciclo di disegno, quindi da li' non si ricava un file.
#
# Come si aggiunge una scena: una voce in SCENE, con dentro il JavaScript che prepara la
# situazione da fotografare. Vale la pena aggiungerne una ogni volta che si disegna qualcosa di
# nuovo: costa tre righe e si rivede a comando.
import functools
import http.server
import random
import socket
import socketserver
import sys
import threading
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
FOTOGRAMMI_GIF = 26        # quanti scatti compongono l'animazione
PAUSA_GIF = 110            # ms fra uno scatto e l'altro (e durata di ogni fotogramma)

def _leggendario(nome):
    """JavaScript che mette in campo un leggendario e lo lancia, per fotografarlo."""
    return """
        const g = window.game, G = window.GameState;
        G.reset(); G.level = 4;
        g.scene.start('GameScene');
        await new Promise(r => setTimeout(r, 1500));
        const s = g.scene.getScene('GameScene');
        window.Taratura && window.Taratura.setGodmode(true);
        window.Meta.setUnlock('%s', 1); window.Meta.equipaggiaLeggendario('%s');
        G.player.leggendario = '%s'; G.bombaPronta = 0; G.granate = 3;
        s.enemies.getChildren().slice().forEach((e) => e.destroy());
        for (let i = 0; i < 3; i++) {
          const e = s.spawnEnemy('blob', { x: s.player.x + 180 + i * 90 });
          if (e) { e.spawning = false; }
        }
        s.facing = 1;
        s.usaLeggendario(1, 0);
        // ⚠️ SI FA AVANZARE L'OROLOGIO A MANO, invece di aspettare. Qui il gioco gira a pochi
        // fotogrammi al secondo: aspettando 120ms veri poteva non girarne NEMMENO UNO, e i poteri
        // che si disegnano dentro l'update (il trapano) risultavano invisibili — non perche'
        // fossero rotti, ma perche' non erano ancora stati disegnati una prima volta.
        let t = g.loop.time;
        for (let i = 0; i < 9; i++) { t += 16.6; g.loop.step(t); }
        await new Promise(r => setTimeout(r, 60));
        // ⚠️ SI CONGELA LA SCENA PRIMA DI SCATTARE. Qui il gioco gira a una manciata di
        // fotogrammi al secondo (browser invisibile, disegno via software), e un effetto che dura
        // 420ms puo' essere gia' finito quando arriva lo scatto: si fotograferebbe il nulla e si
        // penserebbe che il potere non si vede. In pausa il disegno continua ma le animazioni no.
        if (!window.__fotoGif) g.scene.pause('GameScene');
    """ % (nome, nome, nome)


SCENE = {
    # Assedio con la valanga poco dietro il giocatore: si vedono la massa, il fronte e il terreno.
    "assedio": """
        const g = window.game, G = window.GameState;
        G.reset(); G.level = 8;
        G.prossimoLivello = { kind: 'siege', mutator: null, waxMult: 1 };
        g.scene.start('GameScene');
        await new Promise(r => setTimeout(r, 1500));
        const s = g.scene.getScene('GameScene');
        window.Taratura && window.Taratura.setGodmode(true);
        s.player.x = 900; s.valangaX = 700;
        s.avanzaValanga(16);
        await new Promise(r => setTimeout(r, 400));
    """,
    # Un leggendario in azione. Stessa preparazione per tutti e quattro: campo sgombro, un
    # bersaglio davanti, e il potere lanciato. Servono a GUARDARLI: i numeri dicono che colpiscono,
    # non come vengono.
    "laser": _leggendario("laser"),
    "trapano": _leggendario("trapano"),
    "razzo": _leggendario("razzo"),
    "granata": _leggendario("granata"),
    # Il menu principale cosi' com'e'.
    "menu": """
        const g = window.game;
        g.scene.start('MenuScene');
        await new Promise(r => setTimeout(r, 900));
    """,
    # Il pannello INFO del menu, aperto: si controlla che le tre sezioni ci stiano e si scorrano.
    "info": """
        const g = window.game;
        g.scene.start('MenuScene');
        await new Promise(r => setTimeout(r, 700));
        const m = g.scene.getScene('MenuScene');
        const bottone = m.children.list.find((o) => o.text === window.I18n.t('menu_info'));
        if (bottone) bottone.emit('pointerdown');
        await new Promise(r => setTimeout(r, 400));
    """,
    # Il negozio dei leggendari come lo vede chi ha vinto UNA volta al grado 0: e' la situazione
    # normale, e serve a controllare cosa si vede davvero invece di cosa si vede con tutto aperto.
    "leggendari_normale": """
        const g = window.game;
        window.Meta.forzaInfezione(0);
        window.Meta.addBank(9000);
        g.scene.start('ShopScene', { pagina: 2 });
        await new Promise(r => setTimeout(r, 800));
    """,
    # Il negozio, pagina dei leggendari, con tutto sbloccato.
    "leggendari": """
        const g = window.game;
        window.Meta.forzaInfezione(window.CONFIG.INFEZIONE_MAX);
        window.Meta.addBank(9000);
        g.scene.start('ShopScene', { pagina: 2 });
        await new Promise(r => setTimeout(r, 800));
    """,
}


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
    if len(sys.argv) < 2 or sys.argv[1] not in SCENE:
        print("Scene disponibili: " + ", ".join(SCENE))
        return 2
    nome = sys.argv[1]
    argomenti = sys.argv[2:]
    gif = "--gif" in argomenti
    resto = [a for a in argomenti if not a.startswith("--")]
    fuori = Path(resto[0]) if resto else RADICE / f"foto_{nome}.{'gif' if gif else 'png'}"

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Manca Playwright:  python -m pip install playwright")
        return 2

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
            timeout=90_000,
        )
        # In modalita' GIF la scena NON va messa in pausa: la si vuole vedere MUOVERSI. La pausa
        # serve solo allo scatto singolo, per non perdere gli effetti brevi.
        if gif:
            pagina.evaluate("() => { window.__fotoGif = true }")
        pagina.evaluate("async () => {" + SCENE[nome] + "}")
        if gif:
            # ⚠️ Si fotografa MENTRE IL GIOCO GIRA DA SOLO: niente passi sintetici. Farlo avanzare
            # a mano darebbe fotogrammi regolarissimi ma non direbbe come si comporta davvero — ed
            # e' proprio il "davvero" che si vuole vedere.
            import io
            import time
            try:
                from PIL import Image
            except ImportError:
                print("Per la GIF serve Pillow:  python -m pip install pillow")
                return 2
            scatti = []
            for _ in range(FOTOGRAMMI_GIF):
                scatti.append(Image.open(io.BytesIO(pagina.screenshot())).convert("RGB"))
                time.sleep(PAUSA_GIF / 1000)
            # meta' risoluzione e tavolozza ridotta: a piena misura una GIF pesa troppo
            scatti = [f.resize((f.width // 2, f.height // 2), Image.LANCZOS) for f in scatti]
            scatti = [f.quantize(colors=128, method=Image.MEDIANCUT) for f in scatti]
            scatti[0].save(str(fuori), save_all=True, append_images=scatti[1:],
                           duration=PAUSA_GIF, loop=0, optimize=True)
        else:
            pagina.screenshot(path=str(fuori))
        browser.close()
    httpd.shutdown()
    print(f"Salvato {fuori}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
