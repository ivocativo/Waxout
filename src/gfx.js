// GameGfx: rendering ed effetti visivi del gioco, SEPARATI dalla logica di gameplay
// (che resta in GameScene.js). Ogni funzione riceve la scena come primo argomento e
// disegna usando le sue API (scene.add, scene.tweens, ...). Tenere la grafica qui e il
// gameplay in GameScene permette di lavorarci in parallelo da due sessioni senza
// pestarsi i piedi: la sessione "grafica" tocca questo file, quella "gameplay" l'altro.
//
// GameScene mantiene piccoli metodi-richiamo di una riga (es. drawBackground() ->
// GameGfx.drawBackground(this)) cosi' i punti di chiamata nel gameplay restano invariati.
window.GameGfx = {

  // ---------- Sfondo ----------

  // Sfondo del condotto: FONDALE dipinto (immagine generata, parete di carne) che
  // riempie lo schermo e scorre lento (parallax). updateBackground() (da
  // GameScene.update) lo fa scorrere con la telecamera.
  // Manopola dello ZOOM (regolabile al volo in preview via window.__BG_ZOOM): quanto
  // zoomare dentro il fondale. >1 mostra solo un SETTORE dell'immagine, cosi' ogni
  // livello inquadra una zona diversa della stessa immagine (piu' sfondi con 1 file).
  // La GRANA (pixel + colori ridotti) e' gia' "cotta" nel PNG da tools/bake_bg_pixel.ps1.
  BG_ZOOM: 2.0,

  // ---------- SET DI SFONDO a 3 strati (pittorici) ----------
  // Un set = 3 immagini (assets/backgrounds/<N>/, preparate da tools/bake_background_set.ps1)
  // montate come strati di PARALLAX: lontano/medio/vicino scorrono a velocita' crescenti, e la
  // differenza di velocita' e' cio' che da' la sensazione di profondita'. Stanno tutti DIETRO a
  // soffitto e terreno (disegnati a depth 4 e 4.3): lo sfondo scorre TRA di essi.
  // Gli strati sono ancorati allo SCHERMO (scrollFactor 0) e si muovono spostando la texture
  // (tilePositionX in updateBackground), cosi' si ripetono all'infinito su livelli di qualunque
  // lunghezza senza dover essere larghi quanto il mondo.
  // Il set cambia a FASCE di 5 livelli, cioe' dopo ogni boss (i boss sono i multipli di 5).
  //
  // Manopole per strato: y = bordo alto sullo schermo, f = velocita' di parallax, scale =
  // ingrandimento della texture. NOTA su 'near': le colate pendono dal BORDO ALTO
  // dell'immagine, quindi lo strato va abbassato (y positivo) o finiscono nascoste dietro al
  // soffitto invece di sporgere dentro il condotto.
  // alpha/tint servono a dare la PROSPETTIVA ATMOSFERICA: piu' uno strato e' lontano, piu' e'
  // smorzato e tende al colore della foschia. Senza questo i tre strati hanno lo stesso
  // contrasto, sembrano tutti alla stessa distanza e l'insieme risulta solo "affollato".
  // NB: le immagini del set sono SPECCHIATE dallo script ([originale|riflesso]), cosi' quando lo
  // strato si ripete scorrendo non si vede la riga verticale della giuntura. Questo raddoppia la
  // larghezza e abbassa l'altezza a parita' di peso: le 'scale' qui sotto tengono conto di quello.
  BG_LAYERS: [
    { role: 'far',  y: -40, f: 0.10, scale: 1.02, depth: -15, alpha: 1.00, tint: 0xffffff },
    { role: 'mid',  y: -40, f: 0.22, scale: 1.38, depth: -14, alpha: 0.96, tint: 0xefe2ea },
    { role: 'near', y: -60, f: 0.40, scale: 1.32, depth: -13, alpha: 1.00, tint: 0xffffff },
  ],

  // ================================ TEMI DELL'INFEZIONE ================================
  // Ogni GRADO DI INFEZIONE e' una malattia diversa, con il suo ambiente (idea dell'utente,
  // 2026-08-24). Non e' solo bellezza: salire di grado deve VEDERSI prima ancora di combattere.
  //
  // ⚠️ NIENTE FILE NUOVI, ed e' una scelta ragionata, non un ripiego. Un set di sfondo disegnato
  // pesa 3,4 MB e l'app sta a 16: sei temi dedicati la raddoppierebbero. Qui invece si ricolora
  // quello che c'e' gia' — strati di parallax, carne del terreno e del soffitto — e si aggiunge
  // un'ATMOSFERA disegnata a codice, che e' la tecnica con cui il gioco ha gia' fatto la nebbia
  // dell'assedio. Se un domani un tema meritera' arte sua, la si mette al posto della ricoloritura
  // senza toccare nient'altro.
  //
  // ⚠️ LA REGOLA CHE DECIDE LE PALETTE: cerume e nemici sono AMBRA. Un fondale arancione acceso se
  // li mangia (stessa lezione delle elite: e' il CONTRASTO a far leggere le cose, non il colore).
  // Percio' la febbre e' rosso CUPO con le braci come unico accento caldo, e gli altri temi stanno
  // tutti lontani dall'ambra: ciano, verde malato, viola, nero elettrico.
  //
  // ⚠️ La tinta di Phaser MOLTIPLICA: puo' spegnere e virare, mai schiarire. Dove serve calore o
  // luce (febbre, acufene) si aggiunge un VELO in fusione additiva sopra al fondale — l'unica
  // strada per aggiungere luce che nell'immagine non c'e'.
  TEMI: [
    { id: 'cerume', strati: [0xffffff, 0xefe2ea, 0xffffff],
      carne: { profondo: 0x2b0f18, crosta: 0xc2455f, bordo: 0xe89aad },
      velo: null, atmosfera: null },
    { id: 'raffreddore', strati: [0x8fc8ee, 0x86b6d8, 0xa6dcf5],
      carne: { profondo: 0x10222f, crosta: 0x3f7f9e, bordo: 0xa9dcef },
      velo: { colore: 0x8fd8ff, alpha: 0.10 }, atmosfera: 'ghiaccio' },
    { id: 'febbre', strati: [0xd2564a, 0xc04a44, 0xe0705a],
      carne: { profondo: 0x2a0806, crosta: 0xb03028, bordo: 0xff9a6a },
      velo: { colore: 0xff5a1e, alpha: 0.13 }, atmosfera: 'braci' },
    // ⚠️ VERDE SPINTO, non oliva. Il primo tentativo (crosta 0x8f9a33) era troppo vicino
    // all'ambra del cerume: a occhio si notava, e il controllo automatico lo ha misurato (102 su
    // 120 di distanza minima). Con un pus piu' verde i cumuli tornano a staccare dal pavimento.
    { id: 'otite', strati: [0xa9cf6a, 0x9abd63, 0xbcde88],
      carne: { profondo: 0x16240f, crosta: 0x63a047, bordo: 0xbfe58a },
      velo: null, atmosfera: 'bolle' },
    { id: 'micosi', strati: [0x7a5cc4, 0x6a4fae, 0x9a7ae0],
      carne: { profondo: 0x1a0f2c, crosta: 0x5b3f96, bordo: 0xc9a8ff },
      velo: { colore: 0x8a5cff, alpha: 0.10 }, atmosfera: 'spore' },
    { id: 'acufene', strati: [0x3a4a66, 0x33405a, 0x46587a],
      carne: { profondo: 0x05070d, crosta: 0x1d2740, bordo: 0x5ff0ff },
      velo: { colore: 0x00e5ff, alpha: 0.08 }, atmosfera: 'onde' },
  ],

  // CORREZIONE DI COLORE PER SET. ⚠️ I set non nascono uguali: il 2 e' rosa caldo, l'1 e il 3
  // escono grigi-malva, e passando da un tratto all'altro si vedeva il salto (segnalato
  // dall'utente 2026-08-26: "il primo sfondo tende al grigio invece che al rosa"). Qui ognuno
  // viene riportato nella stessa famiglia, senza rigenerare l'arte.
  // ⚠️ Si moltiplica, quindi si puo' solo TOGLIERE: per andare verso il rosa si abbassano verde e
  // blu, non si alza il rosso. Ecco perche' i valori partono tutti da 0xff sul rosso.
  SET_TINTE: { 1: 0xffb0c4, 3: 0xffb4c8 },

  // Fonde due tinte canale per canale (tema x set): moltiplicare due tinte equivale a passarle
  // una dopo l'altra, ed e' l'unico modo di tenerle indipendenti.
  fondiTinte(a, b) {
    const c = (spost) => Math.round((((a >> spost) & 255) * ((b >> spost) & 255)) / 255);
    return (c(16) << 16) | (c(8) << 8) | c(0);
  },

  // La tinta finale di uno strato: quella del tema, corretta per il set in uso.
  tintaStrato(i) {
    const tema = (this.temaAttivo().strati || [])[i] || 0xffffff;
    const set = this.SET_TINTE[this.bgSetFor((window.GameState && window.GameState.level) || 1)];
    return set ? this.fondiTinte(tema, set) : tema;
  },

  // Il tema di questa run. ⚠️ Legge il grado di infezione SCELTO, non il record: si guarda cio' che
  // si sta giocando adesso.
  temaAttivo() {
    const g = (window.GameState && window.GameState.infezione) || 0;
    return this.TEMI[Phaser.Math.Clamp(g, 0, this.TEMI.length - 1)] || this.TEMI[0];
  },

  // Va chiamata PRIMA di disegnare fondale e carne: e' lei a decidere di che colore saranno.
  // ⚠️ `CARNE` viene proprio riscritta, invece di passare i colori a ogni funzione che disegna:
  // le funzioni che la leggono sono quattro e sparse (terreno, soffitto, pedane, timpano), e
  // aggiungere un parametro a tutte avrebbe dato quattro punti in cui dimenticarselo.
  applicaTema(scene) {
    const t = this.temaAttivo();
    this.CARNE = t.carne;
    scene._tema = t;
  },

  // Velo e atmosfera: si aggiungono DOPO il fondale, perche' ci stanno sopra.
  vestiLaScena(scene) {
    const t = scene._tema || this.temaAttivo();
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    // VELO: l'unico modo di AGGIUNGERE luce a un'immagine che non ce l'ha (la tinta moltiplica).
    // Sta sotto a terreno e soffitto (profondita' -12 contro 4): scalda il fondale, non il gioco.
    if (t.velo) {
      scene._velo = scene.add.rectangle(W / 2, H / 2, W, H, t.velo.colore, t.velo.alpha)
        .setScrollFactor(0).setDepth(-12).setBlendMode(Phaser.BlendModes.ADD);
    }
    if (!t.atmosfera) { scene._atmo = null; return; }

    // ATMOSFERA: una manciata di particelle riusate all'infinito. ⚠️ Fisse rispetto alla
    // telecamera (scrollFactor 0) e poche decine: e' aria, non scenografia, e su un telefono
    // qualche centinaio di oggetti in movimento si sentirebbe.
    const N = 26;
    const p = [];
    for (let i = 0; i < N; i++) {
      let o;
      if (t.atmosfera === 'ghiaccio') {
        o = scene.add.circle(0, 0, 1 + Math.random() * 2, 0xdff2ff, 0.85);
      } else if (t.atmosfera === 'braci') {
        o = scene.add.circle(0, 0, 1 + Math.random() * 2.2, Math.random() < 0.5 ? 0xff7a2a : 0xffc46a, 0.9);
        o.setBlendMode(Phaser.BlendModes.ADD);
      } else if (t.atmosfera === 'bolle') {
        o = scene.add.circle(0, 0, 2 + Math.random() * 4, 0xdfe89a, 0.35);
        o.setStrokeStyle(1, 0xf2f7c0, 0.7);
      } else if (t.atmosfera === 'spore') {
        o = scene.add.circle(0, 0, 1.5 + Math.random() * 2.5, 0xd9b3ff, 0.9);
        o.setBlendMode(Phaser.BlendModes.ADD);
      } else {                                   // 'onde' dell'acufene
        o = scene.add.circle(0, 0, 10 + Math.random() * 26, 0x00e5ff, 0);
        o.setStrokeStyle(1.5, 0x6ff2ff, 0.5);
        o.setBlendMode(Phaser.BlendModes.ADD);
      }
      o.setScrollFactor(0).setDepth(-11);
      o._x = Math.random(); o._y = Math.random();
      o._v = 0.05 + Math.random() * 0.22;
      o._fase = Math.random() * Math.PI * 2;
      p.push(o);
    }
    scene._atmo = { tipo: t.atmosfera, p, t: 0 };
  },

  // Cambia il tema di una scena GIA' disegnata: ritinge gli strati e rifa velo e atmosfera.
  // Serve al menu, dove si sceglie il grado di infezione e lo sfondo deve rispondere subito —
  // ⚠️ senza questo cambiava solo per effetto collaterale del cambio lingua, che ridisegna tutta
  // la scena (segnalato dall'utente 2026-08-26).
  ritingiSfondo(scene) {
    this.applicaTema(scene);
    (scene.bgLayers || []).forEach((L, i) => {
      const tinta = this.tintaStrato(i);
      if (tinta === 0xffffff) L.s.clearTint(); else L.s.setTint(tinta);
    });
    // Velo e particelle vanno buttati e rifatti: appartengono al tema vecchio.
    if (scene._velo) { scene._velo.destroy(); scene._velo = null; }
    if (scene._atmo) { scene._atmo.p.forEach((o) => o.destroy()); scene._atmo = null; }
    this.vestiLaScena(scene);
  },

  // Un fotogramma d'aria. La chiama updateBackground, che gira gia' a ogni fotogramma.
  aggiornaAtmosfera(scene, dt) {
    const a = scene._atmo;
    if (!a) return;
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const s = dt / 1000;
    a.t += s;
    a.p.forEach((o) => {
      if (a.tipo === 'ghiaccio') {               // fiocchi che scendono ondeggiando
        o._y += o._v * s * 0.5;
        if (o._y > 1.05) { o._y = -0.05; o._x = Math.random(); }
        o.setPosition(o._x * W + Math.sin(a.t * 0.8 + o._fase) * 22, o._y * H);
      } else if (a.tipo === 'braci' || a.tipo === 'spore') {   // salgono, piano
        o._y -= o._v * s * 0.55;
        if (o._y < -0.05) { o._y = 1.05; o._x = Math.random(); }
        o.setPosition(o._x * W + Math.sin(a.t * 1.3 + o._fase) * 16, o._y * H);
        o.setAlpha(0.35 + 0.5 * (0.5 + 0.5 * Math.sin(a.t * 2 + o._fase)));   // pulsano
      } else if (a.tipo === 'bolle') {           // salgono e scoppiano in alto
        o._y -= o._v * s * 0.4;
        if (o._y < -0.05) { o._y = 1.05; o._x = Math.random(); o.setScale(1); }
        o.setPosition(o._x * W + Math.sin(a.t * 0.6 + o._fase) * 10, o._y * H);
        o.setScale(1 + Math.sin(a.t * 1.6 + o._fase) * 0.18);
      } else {                                   // 'onde': anelli che si allargano e svaniscono
        const q = (a.t * 0.35 + o._fase) % 1;    // 0 -> 1, poi ricomincia
        o.setPosition(o._x * W, o._y * H);
        o.setScale(0.3 + q * 1.9);
        o.setAlpha((1 - q) * 0.45);
      }
    });
  },

  // ---------- MASSA ORGANICA (terreno e soffitto) ----------
  // Terreno e soffitto erano due lastroni di colore piatto marrone: con lo sfondo pittorico
  // dietro erano diventati la cosa piu' fuori posto dell'inquadratura. Qui vengono disegnati
  // via codice (nessun asset) come una SEZIONE DI TESSUTO: massa profonda scura, corpo, crosta
  // vicino alla superficie e un filo di luce sul bordo — cioe' gli stessi toni del fondale.
  // NB: e' solo aspetto. La FORMA resta quella generata dal gameplay (colline, cunette,
  // strettoie) e la collisione non viene toccata.
  CARNE: {
    profondo: 0x2b0f18,   // in fondo alla massa (quasi buio)
    crosta:   0xc2455f,   // appena sotto la superficie, satura come il fondale
    bordo:    0xe89aad,   // filo di luce sul bordo
  },

  // profilo(x) -> y del bordo della massa.
  // verso: +1 la massa sta SOTTO il bordo (terreno), -1 sta SOPRA (soffitto).
  // lontano: y dove la massa "finisce" fuori schermo.
  paintOrganicMass(scene, profilo, opts) {
    const verso = opts.verso, lontano = opts.lontano;
    // PASSO 16 e non 8: ogni velatura e' un poligono lungo tutto il livello, quindi raddoppiare i
    // punti raddoppia il costo di costruzione del livello (misurato: si era piu' che raddoppiato).
    // A 16px la silhouette e' identica a vedersi.
    const W = scene.worldW, PASSO = 16;
    const P = this.CARNE;
    const g = scene.add.graphics().setDepth(opts.depth);

    const bordo = [];
    for (let x = 0; x <= W; x += PASSO) bordo.push({ x, y: profilo(x) });
    bordo.push({ x: W, y: profilo(W) });

    // Fascia di massa tra due profondita' (a = piu' vicina al bordo, b = piu' dentro).
    // Il confine interno ONDEGGIA: se fosse dritto la sfumatura sembrerebbe una fascia
    // orizzontale dipinta sopra, invece cosi' la massa respira come tessuto vero.
    const fase = Phaser.Math.FloatBetween(0, 6.28);
    const onda = (x, d) => d * (0.78 + 0.44 * Math.sin(x * 0.0085 + fase));
    const banda = (a, b) => bordo.map((p) => ({ x: p.x, y: p.y + verso * a }))
      .concat(bordo.slice().reverse().map((p) => ({ x: p.x, y: p.y + verso * onda(p.x, b) })));

    // 1) massa profonda fino a fuori schermo
    g.fillStyle(P.profondo, 1);
    g.fillPoints(bordo.map((p) => ({ x: p.x, y: p.y }))
      .concat([{ x: W, y: lontano }, { x: 0, y: lontano }]), true);

    // 2) SFUMATURA verso la superficie, fatta con VELATURE trasparenti sovrapposte invece che con
    // tinte piene: ogni fascia aggiunge un velo di crosta, e piu' ci si avvicina al bordo piu'
    // veli si accumulano. Con le tinte piene si vedevano i GRADINI paralleli alla superficie;
    // cosi' la transizione e' continua.
    // La profondita' deve stare DENTRO l'altezza visibile (~180px sotto la superficie): con 230
    // il buio restava fuori schermo e il terreno sembrava una tinta unita slavata.
    const VELI = 10, PROFONDITA = 120;
    for (let k = VELI; k >= 1; k--) {
      g.fillStyle(P.crosta, 0.16);
      g.fillPoints(banda(0, k * (PROFONDITA / VELI)), true);
    }

    // 4) macchie: bolle piu' chiare/scure dentro la massa, per togliere l'effetto tinta unita
    // Macchie appena percettibili: prima erano scure e tonde e sembravano buchi/chiazze.
    for (let x = 20; x < W; x += Phaser.Math.Between(38, 74)) {
      const prof = Phaser.Math.Between(24, 150);
      const r = Phaser.Math.Between(14, 30);
      const chiara = Math.random() < 0.6;
      g.fillStyle(chiara ? P.crosta : P.profondo, chiara ? 0.16 : 0.14);
      g.fillEllipse(x, profilo(x) + verso * prof, r * 2.6, r * 1.1);
    }
    // 5) grumi sul bordo: spezzano la linea netta. Sul TERRENO restano sotto la superficie (se
    //    sporgessero il PG sembrerebbe camminare sospeso); sul SOFFITTO possono pendere.
    for (let x = 16; x < W; x += Phaser.Math.Between(34, 78)) {
      const r = Phaser.Math.Between(7, 17);
      const dentro = verso > 0 ? r * 0.75 : -r * 0.15;   // terreno: dentro / soffitto: sporge
      g.fillStyle(P.bordo, 0.28);                        // appena accennati: piu' marcati
      g.fillEllipse(x, profilo(x) + verso * dentro, r * 2.8, r * 1.3);   // sembravano bollicine
    }
    // 6) filo di luce sul bordo (dove batte la luce del condotto)
    g.lineStyle(3, P.bordo, 0.75);
    g.beginPath();
    bordo.forEach((p, i) => { if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
    g.strokePath();
    return g;
  },

  // PEDANA: mensola di tessuto, stessa tavolozza e stesso trattamento della massa (velature dal
  // piano d'appoggio verso il basso). Il rettangolo fisico resta invariato e invisibile: qui si
  // disegna solo l'aspetto, quindi la collisione e la quota d'appoggio non cambiano di un pixel.
  paintLedge(scene, x, y, w, h) {
    const P = this.CARNE;
    const g = scene.add.graphics().setDepth(4.35);
    const sx = x - w / 2, top = y - h / 2;
    const SPESSORE = 24;                       // quanto scende sotto il piano d'appoggio
    const ang = { tl: 5, tr: 5, bl: 11, br: 11 };

    g.fillStyle(P.profondo, 1);
    g.fillRoundedRect(sx, top, w, SPESSORE, ang);
    // velature: piu' si sta in alto piu' se ne accumulano -> il piano d'appoggio e' illuminato,
    // il sottopancia resta scuro (e' da li' che si capisce che e' una sporgenza e non una riga)
    for (let k = 6; k >= 1; k--) {
      g.fillStyle(P.crosta, 0.2);
      g.fillRoundedRect(sx, top, w, SPESSORE * (k / 6), ang);
    }
    // qualche grumo sul bordo superiore: toglie l'aria di rettangolo
    for (let i = 0; i < Math.max(2, Math.round(w / 34)); i++) {
      const bx = sx + Phaser.Math.Between(6, Math.max(7, w - 6));
      const r = Phaser.Math.Between(5, 10);
      g.fillStyle(P.crosta, 0.85);
      g.fillEllipse(bx, top + 2, r * 2.1, r * 1.1);
    }
    // filo di luce sul piano dove si atterra
    g.fillStyle(P.bordo, 0.8);
    g.fillRect(sx + 2, top, w - 4, 2);
    // una o due gocce appese sotto
    for (let i = 0; i < Phaser.Math.Between(1, 2); i++) {
      const dx = sx + Phaser.Math.Between(8, Math.max(9, w - 8));
      const dr = Phaser.Math.Between(3, 5);
      g.fillStyle(P.profondo, 0.9);
      g.fillEllipse(dx, top + SPESSORE + dr, dr * 1.6, dr * 2.6);
    }
    return g;
  },

  // POZZA SCIVOLOSA. Prima era una barra dritta color senape: su un terreno in pendenza non lo
  // seguiva, e soprattutto quel giallo si confondeva col CERUME da raccogliere. Ora e' una
  // patina bagnata FREDDA (verde-acqua) che segue il profilo del terreno: contro il rosa della
  // carne salta all'occhio, e non somiglia a niente altro nel gioco. La forma e' a lente
  // (sottile ai bordi) perche' una pozza non ha spigoli.
  SCIVOLO: { film: 0x45b8a6, lucido: 0xe4fffa },

  paintSlick(scene, x1, x2, profilo) {
    const S = this.SCIVOLO;
    const g = scene.add.graphics().setDepth(4.5);
    const PASSO = 6, SPESSORE = 17, larg = Math.max(1, x2 - x1);
    const spess = (x) => Math.max(2, SPESSORE * Math.sin(Math.PI * (x - x1) / larg));

    const sopra = [], sotto = [];
    for (let x = x1; x <= x2; x += PASSO) {
      const y = profilo(x);
      sopra.push({ x, y: y - spess(x) });
      sotto.push({ x, y: y + 2 });
    }
    g.fillStyle(S.film, 0.78);
    g.fillPoints(sopra.concat(sotto.reverse()), true);
    // riflesso: filo chiaro lungo il bordo alto = superficie bagnata che riflette
    g.lineStyle(2.5, S.lucido, 0.8);
    g.beginPath();
    sopra.forEach((p, i) => { if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
    g.strokePath();

    // due o tre luccichii che pulsano: e' il segnale "qui si scivola"
    for (let i = 0; i < Phaser.Math.Between(2, 3); i++) {
      const gx = Phaser.Math.Between(x1 + 12, x2 - 12);
      const e = scene.add.ellipse(gx, profilo(gx) - 5, Phaser.Math.Between(14, 26), 4, S.lucido, 0.75)
        .setDepth(4.55);
      scene.tweens.add({
        targets: e, alpha: 0.15, scaleX: 1.5, yoyo: true, repeat: -1,
        duration: Phaser.Math.Between(700, 1100), ease: 'Sine.inOut',
        delay: Phaser.Math.Between(0, 500),
      });
    }
    return g;
  },

  // (Il timpano non e' piu' disegnato via codice: dal round B.1 e' un'immagine AI scontornata,
  // caricata in BootScene come 'eardrum' e piazzata da GameScene.buildGoal.)

  // ---------- INCASSO DEL TIMPANO (playtest 2026-07-25: «il timpano sembra scollegato») ----------
  // L'immagine del timpano e' un OVALE ritagliato: appesa in mezzo al condotto sembrava un quadro
  // appoggiato al fondale, non la fine del condotto. Qui si disegna DIETRO di essa la carne che lo
  // tiene: (1) una massa che si addensa verso il centro = il condotto che finisce, (2) un labbro
  // saturo tutt'intorno = il bordo della membrana incastonato nel tessuto, (3) i vasi che partono
  // dal timpano e proseguono nella carne intorno.
  // Tutto ASPETTO: nessuna fisica, nessun cambiamento al traguardo (che dipende da `goalX`).
  // Sta a depth 2.6, cioe' DIETRO al timpano (3) e dietro a soffitto (4) e terreno (4.3): quelli
  // gli passano sopra e ritagliano da soli l'incasso nell'altezza del condotto.
  // Il vaso deve STACCARE dalla carne (0xc2455f): un rosso vicino al suo si perdeva del tutto.
  VASO: { scuro: 0x5c1226, chiaro: 0xe0788f },

  paintEardrumSocket(scene, cx, cy, rx, ry) {
    const P = this.CARNE, V = this.VASO;
    const g = scene.add.graphics().setDepth(2.6);
    const fase = Phaser.Math.FloatBetween(0, 6.28);

    // Ovale MOSSO: le ellissi perfette, sovrapposte, si leggevano come i cerchi di un bersaglio
    // disegnato col compasso. Il raggio ondeggia con l'angolo (due sinusoidi sfasate) e ogni anello
    // ha una fase diversa: cosi' i contorni non sono mai concentrici e la carne sembra tessuto.
    const ovale = (f, wob) => {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const m = f * (1 + wob * (Math.sin(a * 3 + f * 5.1 + fase) * 0.6 + Math.sin(a * 5 - f * 2.3) * 0.4));
        pts.push({ x: cx + Math.cos(a) * rx * m, y: cy + Math.sin(a) * ry * m });
      }
      return pts;
    };

    // 1) MASSA: veli concentrici sempre piu' stretti. Accumulandosi fanno buio verso il centro
    // (il condotto sprofonda e finisce li') e sfumano verso l'esterno SENZA bordo netto — un
    // poligono a tinta piena si sarebbe visto come una macchia rettangolare incollata sul fondale.
    const VELI = 9;
    for (let k = VELI; k >= 1; k--) {
      const f = 1.15 + (k / VELI) * 2.35;
      g.fillStyle(P.profondo, 0.17);
      g.fillPoints(ovale(f, 0.07), true);
    }
    // 2) macchie appena accennate: tolgono l'aria di tinta unita (stesso trucco della massa organica)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + fase;
      const d = 1.2 + Math.abs(Math.sin(i * 2.3)) * 1.7;
      const r = Phaser.Math.Between(10, 26);
      g.fillStyle(i % 3 === 0 ? P.crosta : P.profondo, 0.15);
      g.fillEllipse(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r * 2.4, r * 1.2);
    }
    // 3) LABBRO: il tessuto si fa piu' saturo avvicinandosi alla membrana. Di nuovo a VELATURE e
    // non a due tinte piene: con due sole ellissi si vedeva il bordo netto e sembrava un bersaglio.
    // Sono ellissi PIENE dietro al timpano, non anelli: cosi' quando il timpano "respira" (tween
    // di scala) non scopre mai il fondale.
    for (let k = 10; k >= 1; k--) {
      const f = 1.05 + (k / 10) * 0.45;
      g.fillStyle(P.crosta, 0.10);
      g.fillPoints(ovale(f, 0.045), true);
    }
    // OMBRA DI CONTATTO: la crepa scura appiccicata al bordo della membrana. E' il pezzo che fa
    // davvero leggere "incastonato": qualunque cosa posata su un fondo, senza un'ombra che la
    // tocca, sembra incollata sopra. Va PRIMA del filo di luce, che sta appena piu' fuori.
    g.lineStyle(10, P.profondo, 0.30); g.strokeEllipse(cx, cy, rx * 2 * 1.03, ry * 2 * 1.03);
    g.lineStyle(20, P.profondo, 0.16); g.strokeEllipse(cx, cy, rx * 2 * 1.09, ry * 2 * 1.08);
    // filo di luce sul labbro rialzato, appena fuori dall'ombra (mosso, non un anello perfetto)
    g.lineStyle(3, P.bordo, 0.45);
    g.strokePoints(ovale(1.15, 0.035), true);

    // 4) VASI che continuano dal timpano nella carne: partono dal labbro e si allontanano
    // ramificandosi. Sono la ragione per cui l'occhio legge "attaccato" invece di "appoggiato".
    // Disegnati a segmenti che si assottigliano e si smorzano: una linea di spessore e opacita'
    // costanti sembrava un RAGGIO di ruota, non un vaso (primo tentativo, bocciato a schermo).
    const vaso = (a, lung, spess, col, alpha) => {
      const PASSI = 9;
      let px = cx + Math.cos(a) * rx * 1.03, py = cy + Math.sin(a) * ry * 1.02;
      for (let s = 1; s <= PASSI; s++) {
        const t = s / PASSI;
        const curva = Math.sin(t * 3.4 + a * 3.1) * 24 * t;   // serpeggia
        const nx = cx + Math.cos(a) * rx * (1.03 + lung * t) - Math.sin(a) * curva;
        const ny = cy + Math.sin(a) * ry * (1.02 + lung * t) + Math.cos(a) * curva;
        g.lineStyle(Math.max(0.8, spess * (1 - t * 0.85)), col, alpha * (1 - t * 0.85));
        g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.strokePath();
        px = nx; py = ny;
      }
    };
    const N = 11;
    for (let i = 0; i < N; i++) {
      // angoli IRREGOLARI: a passo fisso tornavano a sembrare i raggi di una ruota
      const a = (i / N) * Math.PI * 2 + fase * 0.3 + Phaser.Math.FloatBetween(-0.22, 0.22);
      const lung = Phaser.Math.FloatBetween(0.35, 1.25);
      vaso(a, lung, Phaser.Math.FloatBetween(5, 8), V.scuro, 0.95);
      vaso(a + Phaser.Math.FloatBetween(0.1, 0.3), lung * 0.5, 3, V.scuro, 0.7);      // ramo
      if (i % 5 === 0) vaso(a - 0.12, lung * 0.7, 1.6, V.chiaro, 0.22);               // in luce
    }
    // capillari cortissimi tutt'intorno al bordo: cuciono la membrana al tessuto
    for (let i = 0; i < 40; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      vaso(a, Phaser.Math.FloatBetween(0.05, 0.15), 2.4, V.scuro, 0.6);
    }
    return g;
  },

  // ---------- SCHERMATE DI CONTORNO (negozio, potenziamenti, arsenale, pausa, game over) ----------
  // Erano rettangoli marroni piatti con bordo giallo: la vecchia palette, rimasta indietro mentre
  // tutto il resto diventava carne e cerume. Qui c'e' UN linguaggio solo, usato da tutte, cosi'
  // passare dal gioco al negozio non sembra cambiare gioco.
  // Regole: fondo = tessuto profondo con bolle di carne appena accennate (lo stesso fondale visto
  // "da dentro", non un colore inventato); pannelli = plum scuro con un filo di luce in alto;
  // accento = l'AMBRA del cerume, che nel gioco vuol dire "questa e' la risorsa".
  UI: {
    fondo:     0x1c0a12,
    fondo2:    0x3a1424,
    pannello:  0x2a1220,
    pannelloIn:0x3a1a2c,
    bordo:     0x8a4258,
    ambra:     0xffd166,
    ambraScura:0xc98a12,
    verde:     0x9fe6a0,
    testo:     '#fff2e6',
    testoSoft: '#c9a6b2',
  },

  // Fondo comune a tutte le schermate: sfumatura + bolle di tessuto + vignettatura.
  // `scene` deve chiamarlo per PRIMO (sta a depth -50, sotto a tutto il resto).
  paintSceneBg(scene) {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, U = this.UI;
    const g = scene.add.graphics().setDepth(-50).setScrollFactor(0);
    // Sfumatura verticale a fasce (Graphics non ha gradienti veri): 40 bande = transizione liscia.
    const BANDE = 40;
    const c1 = Phaser.Display.Color.IntegerToColor(U.fondo2);
    const c2 = Phaser.Display.Color.IntegerToColor(U.fondo);
    for (let i = 0; i < BANDE; i++) {
      const t = i / (BANDE - 1);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 1, t);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, Math.floor(H * i / BANDE), W, Math.ceil(H / BANDE) + 1);
    }
    // Bolle di tessuto: grandi, molto smorzate. Deterministiche (stesso disegno a ogni apertura:
    // se saltellassero a ogni ridisegno della scena si noterebbe, il negozio si ricarica spesso).
    const h = (n) => { const x = Math.abs(Math.sin(n) * 43758.5453); return x - Math.floor(x); };
    for (let i = 0; i < 16; i++) {
      const x = h(i * 1.7) * W, y = h(i * 3.1 + 5) * H;
      const r = 40 + h(i * 5.3) * 130;
      g.fillStyle(U.fondo2, 0.30);
      g.fillEllipse(x, y, r * 2.3, r * 1.5);
    }
    // Vignettatura: bordi piu' scuri, cosi' l'occhio va al centro dove stanno i pannelli.
    for (let i = 0; i < 9; i++) {
      g.fillStyle(0x000000, 0.055);
      g.fillRect(0, 0, W, 12 + i * 9);
      g.fillRect(0, H - (12 + i * 9), W, 12 + i * 9);
      g.fillRect(0, 0, 12 + i * 9, H);
      g.fillRect(W - (12 + i * 9), 0, 12 + i * 9, H);
    }
    return g;
  },

  // Pannello/riga: rettangolo arrotondato con filo di luce in alto (da' volume senza immagini).
  // opts: { accento (colore del bordo), soft (piu' scuro, per le righe di elenco), depth }
  panel(scene, x, y, w, h, opts) {
    const U = this.UI;
    const o = opts || {};
    const r = Math.min(10, h / 3);
    const g = scene.add.graphics().setDepth(o.depth === undefined ? 0 : o.depth);
    g.fillStyle(o.soft ? U.pannello : U.pannelloIn, o.alpha === undefined ? 1 : o.alpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
    g.lineStyle(2, o.accento === undefined ? U.bordo : o.accento, 0.9);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
    // filo di luce lungo il bordo alto
    g.fillStyle(0xffffff, 0.07);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 2, w - 6, Math.min(10, h / 2), { tl: r, tr: r, bl: 0, br: 0 });
    return g;
  },

  // Titolo di schermata: scritta ambra con una riga sottile sotto (stessa in tutte le schermate).
  sceneTitle(scene, testo, y) {
    const W = window.CONFIG.WIDTH, U = this.UI;
    const t = scene.add.text(W / 2, y, testo, {
      fontFamily: 'monospace', fontSize: '30px', color: '#ffd166',
      stroke: '#1c0a12', strokeThickness: 6,
    }).setOrigin(0.5);
    const g = scene.add.graphics();
    g.fillStyle(U.ambraScura, 0.75);
    g.fillRect(W / 2 - t.width / 2 - 10, y + 20, t.width + 20, 2);
    return t;
  },

  // Pulsante comune: pannello + scritta, con stati sopra/premuto. Ritorna { zona, label }.
  uiButton(scene, x, y, testo, onTap, opts) {
    const U = this.UI;
    const o = opts || {};
    const w = o.w || 190, h = o.h || 44;
    const acc = o.accento === undefined ? U.ambra : o.accento;
    const sfondo = scene.add.graphics();
    const disegna = (dentro) => {
      sfondo.clear();
      sfondo.fillStyle(dentro ? U.ambra : U.pannelloIn, 1);
      sfondo.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      sfondo.lineStyle(2, acc, dentro ? 1 : 0.85);
      sfondo.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      if (!dentro) { sfondo.fillStyle(0xffffff, 0.06); sfondo.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 2, w - 6, 9, { tl: 8, tr: 8, bl: 0, br: 0 }); }
    };
    disegna(false);
    const label = scene.add.text(x, y, testo, {
      fontFamily: 'monospace', fontSize: (o.size || 17) + 'px', color: U.testo, align: 'center',
    }).setOrigin(0.5);
    const zona = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    zona.on('pointerover', () => { disegna(true); label.setColor('#1c0a12'); });
    zona.on('pointerout', () => { disegna(false); label.setColor(U.testo); });
    zona.on('pointerdown', () => { window.Sfx.pick(); onTap(); });
    return { zona: zona, label: label, sfondo: sfondo };
  },

  bgSetFor(level) {
    const sets = (window.BG_SETS && window.BG_SETS.length) ? window.BG_SETS : null;
    if (!sets) return null;
    return sets[Math.floor((Math.max(1, level) - 1) / 5) % sets.length];
  },

  drawBackground(scene) {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const lvl0 = (window.GameState && window.GameState.level) || 1;
    const set = this.bgSetFor(lvl0);
    const keys = set != null ? this.BG_LAYERS.map((L) => 'bg' + set + '_' + L.role) : [];
    if (keys.length && keys.every((k) => scene.textures.exists(k))) {
      // Sfasamento orizzontale diverso per livello (stesso livello -> stesso sfondo): con gli
      // strati che si ripetono basta questo per non rivedere la stessa inquadratura.
      scene.bgBaseX = ((lvl0 * 137) % 997) / 997 * 800;
      scene.bgBaseY = 0;
      scene.bgLayers = this.BG_LAYERS.map((L, i) => {
        const key = keys[i];
        const alta = scene.textures.get(key).getSourceImage().height;
        // ⚠️ LO STRATO DEVE ARRIVARE IN FONDO ALLO SCHERMO, sempre. La scala scritta in BG_LAYERS
        // era tarata sulle proporzioni del set 2; i set nuovi sono piu' larghi e bassi, e con
        // quella scala il fondale finiva PRIMA del bordo inferiore — nel gioco non si vedeva
        // (terreno e soffitto coprono), nel menu si' (segnalato dall'utente 2026-08-26: "un buco
        // nell'angolo in basso a destra"). Si prende la scala piu' grande fra quella voluta e
        // quella che serve a coprire, cosi' il difetto non puo' tornare con un set futuro.
        const serve = (H - L.y + 8) / alta;
        const scala = Math.max(L.scale, serve);
        const h = alta * scala;
        const ts = scene.add.tileSprite(0, L.y, W, h, key)
          .setOrigin(0, 0).setScrollFactor(0).setDepth(L.depth);
        ts.tileScaleX = scala; ts.tileScaleY = scala;
        if (L.alpha != null) ts.setAlpha(L.alpha);
        // La tinta viene dal TEMA della run, corretta per il set in uso (vedi tintaStrato).
        const tinta = this.tintaStrato(i);
        if (tinta && tinta !== 0xffffff) ts.setTint(tinta);
        return { s: ts, f: L.f };
      });
      this.vestiLaScena(scene);
      this.updateBackground(scene);
      return;
    }
    // --- RIPIEGO: vecchio fondale unico (se il set non e' disponibile) ---
    const ZOOM = window.__BG_ZOOM || this.BG_ZOOM;
    // Fondale gia' pixelato+posterizzato: si usa direttamente a pixel netti (NEAREST),
    // niente canvas/getImageData a runtime (che da file:// si romperebbero).
    const tex = scene.textures.get('bg_flesh_px');
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const low = tex.getSourceImage();
    const lowW = low.width, lowH = low.height;

    const scale = (H / lowH) * ZOOM;              // riempi l'altezza, poi zooma
    const bg = scene.add.tileSprite(0, 0, W, H, 'bg_flesh_px').setOrigin(0, 0).setScrollFactor(0).setDepth(-14);
    bg.tileScaleX = scale; bg.tileScaleY = scale;

    // Settore diverso per livello: offset deterministico dal numero di livello (stesso
    // livello -> stesso sfondo). Verticale entro la banda non visibile lasciata dallo zoom.
    const lvl = (window.GameState && window.GameState.level) || 1;
    const freeY = Math.max(0, lowH - H / scale);
    scene.bgBaseX = ((lvl * 137) % 997) / 997 * lowW;
    scene.bgBaseY = ((lvl * 311) % 997) / 997 * freeY;
    bg.tilePositionY = scene.bgBaseY;

    scene.bgLayers = [{ s: bg, f: 0.25 }];        // parallax lento
    this.vestiLaScena(scene);
    this.updateBackground(scene);
  },

  // Scorre il fondale in base alla telecamera (effetto parallax), partendo dal settore
  // scelto per il livello (scene.bgBaseX).
  updateBackground(scene) {
    this.aggiornaAtmosfera(scene, scene.game.loop.delta || 16.7);
    if (!scene.bgLayers) return;
    const sx = scene.cameras.main.scrollX;
    for (let i = 0; i < scene.bgLayers.length; i++) {
      const L = scene.bgLayers[i];
      L.s.tilePositionX = (scene.bgBaseX || 0) + (sx * L.f) / L.s.tileScaleX;
    }
  },

  // ---------- Protuberanze (scenografia di SFONDO) ----------

  // Immagini AI usabili come protuberanze, divise per superficie. Per aggiungerne:
  // ritaglia il PNG (tools/cutout_protuberance.ps1), incorporalo (tools/embed_assets.ps1),
  // caricalo in BootScene e aggiungi la chiave qui. Le immagini di SOFFITTO vanno
  // generate gia' orientate per pendere dall'alto (niente flip verticale nel codice).
  PROTUBERANCES: {
    floor:   ['prot_coral_stalk', 'prot_coral_branch'],
    ceiling: ['prot_web', 'prot_drip'],
  },

  // Sparge escrescenze organiche ancorate a PAVIMENTO e SOFFITTO lungo tutto il
  // condotto. Sono SCENOGRAFIA DI SFONDO (secondo/terzo piano): depth 2 = davanti solo
  // al fondale lontano (-14) ma DIETRO a tutto il gameplay (timpano 3, pavimento 4,
  // cerume/membrane 5-6, raccolte/nemici 7-9, personaggio 10) -> non coprono mai gli
  // oggetti di gioco. Niente collisioni. Scorrono col mondo (scrollFactor 1), quindi
  // rispetto al fondale (parallax 0.25) sembrano piu' vicine = effetto profondita'.
  // Quantita' e posizioni variano a ogni livello. Chiamata da GameScene.buildLevel.
  drawProtuberances(scene) {
    const H = window.CONFIG.HEIGHT;
    const groundTop = scene.groundTop != null ? scene.groundTop : H - window.CONFIG.GROUND_H;
    const worldW = scene.worldW || window.CONFIG.WIDTH;
    const lvl = (window.GameState && window.GameState.level) || 1;
    const P = this.PROTUBERANCES;

    scene.protuberances = [];
    const floorN = Phaser.Math.Clamp(4 + Math.floor(lvl * 0.8), 4, 14);
    const ceilN = Phaser.Math.Clamp(3 + Math.floor(lvl * 0.6), 3, 11);

    // Due PIANI di sfondo a velocita' di scorrimento diverse -> parallasse TRA le
    // protuberanze stesse (non solo verso il fondale lontano). Entrambi restano dietro
    // al gameplay (depth 1 e 2 < timpano 3). Il piano lontano scorre piu' lento, e' piu'
    // piccolo e smorzato (tinta verso il fondale = profondita' atmosferica); il vicino e'
    // piu' grande, pieno e quasi radicato al terreno.
    const PLANES = [
      { sf: 0.50, depth: 1, sizeMul: 0.72, alpha: 0.82, tint: 0xcf9d9d },  // lontano
      { sf: 0.85, depth: 2, sizeMul: 1.00, alpha: 1.00, tint: 0xffffff },  // vicino
    ];
    const W = window.CONFIG.WIDTH;
    const maxScroll = Math.max(1, worldW - W);

    const place = (key, anchor) => {
      const plane = PLANES[Phaser.Math.Between(0, PLANES.length - 1)];
      // Posiziono in "spazio-scroll": scelgo a che punto dell'attraversamento (s) e dove
      // sullo schermo comparira', poi ricavo la x nel mondo (con scrollFactor sf<1 vale
      // xMondo = xSchermo + s*sf). Cosi' anche il piano lento copre tutto il livello.
      const s = Phaser.Math.Between(0, maxScroll);
      const x = Phaser.Math.Between(40, W - 40) + s * plane.sf;
      // floor: appoggia in basso (un filo dentro al pavimento); ceiling: pende dall'alto.
      const y = anchor === 'floor' ? groundTop + 6 : -6;
      const img = scene.add.image(x, y, key).setDepth(plane.depth);
      img.setScrollFactor(plane.sf, 1);                     // sf<1 = parallasse orizzontale
      img.setOrigin(0.5, anchor === 'floor' ? 1 : 0);
      // Scala mirata a un'ALTEZZA a schermo (px) * fattore del piano: cosi' funziona sia
      // per le bozze piccole sia per le immagini AI grandi, e i piani lontani sono piu' piccoli.
      const srcH = scene.textures.get(key).getSourceImage().height || 64;
      const targetH = (anchor === 'floor' ? Phaser.Math.Between(150, 300) : Phaser.Math.Between(120, 230)) * plane.sizeMul;
      img.setScale(targetH / srcH);
      img.setAlpha(plane.alpha);
      if (plane.tint !== 0xffffff) img.setTint(plane.tint);
      if (Math.random() < 0.5) img.setFlipX(true);          // varieta' (solo orizzontale)
      // NB: le immagini di soffitto (prot_web/prot_drip...) sono gia' orientate per pendere
      // dall'alto (origin 0.5,0), quindi NON si ribaltano verticalmente.
      scene.protuberances.push(img);
    };

    for (let i = 0; i < floorN; i++) place(Phaser.Utils.Array.GetRandom(P.floor), 'floor');
    for (let i = 0; i < ceilN; i++) place(Phaser.Utils.Array.GetRandom(P.ceiling), 'ceiling');
  },

  // ---------- Muro di cerume ----------

  // ---------- Effetti / particelle ----------

  // Piccolo "splat" di feedback quando un pezzo di cerume si stacca.
  splat(scene, x, y, type) {
    const C = window.CONFIG.COLORS;
    const col = { soft: C.waxSoftLight, hard: C.waxHardLight, dirt: C.dirtLight }[type] || C.waxSoftLight;
    const ring = scene.add.circle(x, y, 6, col, 0.7).setDepth(7);
    scene.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => ring.destroy() });
  },

  // Esplosione di particelle (briciole di cerume/sporco).
  burst(scene, key, x, y, n) {
    const e = scene.add.particles(x, y, key, {
      speed: { min: 60, max: 210 }, angle: { min: 0, max: 360 },
      lifespan: 450, scale: { start: 1, end: 0 }, gravityY: 520, emitting: false,
    });
    e.setDepth(15);
    e.explode(n, x, y);
    scene.time.delayedCall(700, () => e.destroy());
  },

  // Sbuffo di terriccio/cerume quando qualcosa emerge dal pavimento.
  groundPuff(scene, x, groundTop, big) {
    this.burst(scene, 'bit_dirt', x, groundTop - 4, big ? 18 : 9);
    const C = window.CONFIG.COLORS;
    const mound = scene.add.ellipse(x, groundTop - 2, big ? 70 : 44, big ? 26 : 16, C.dirtDark, 0.8).setDepth(7);
    scene.tweens.add({ targets: mound, scaleX: 1.6, scaleY: 0.2, alpha: 0, duration: 360, ease: 'Quad.out', onComplete: () => mound.destroy() });
  },

  // Filo di cerume che cola dal soffitto sopra al volante mentre scende.
  ceilingDrip(scene, x, restY) {
    const C = window.CONFIG.COLORS;
    const strand = scene.add.rectangle(x, 0, 5, restY + 20, C.waxSoftDark, 0.85).setOrigin(0.5, 0).setDepth(7);
    const blob = scene.add.circle(x, 6, 6, C.waxSoft, 0.9).setDepth(7);
    scene.tweens.add({ targets: [strand], scaleY: 0, alpha: 0, duration: 540, ease: 'Quad.in', onComplete: () => strand.destroy() });
    scene.tweens.add({ targets: [blob], y: 0, scale: 0, alpha: 0, duration: 300, onComplete: () => blob.destroy() });
  },

  // ---------- UI a schermo (effetti) ----------


  // Cartello a schermo per annunciare i livelli speciali (boss / sciame).
  showBanner(scene, text, color, yPos) {
    const W = window.CONFIG.WIDTH;
    const y = yPos || 118;
    const col = color || '#ffd166';
    const t = scene.add.text(W / 2, y, text, {
      fontFamily: 'monospace', fontSize: '34px', color: col,
      stroke: '#14161f', strokeThickness: 8, align: 'center',
    }).setOrigin(0.5).setDepth(121).setScrollFactor(0);
    // Pannello scuro dietro al testo: stacca il banner dallo sfondo carnoso (leggibilita').
    const strokeCol = Phaser.Display.Color.HexStringToColor(col).color;
    const bg = scene.add.rectangle(W / 2, y, t.width + 52, t.height + 26, 0x14161f, 0.74)
      .setOrigin(0.5).setDepth(120).setScrollFactor(0).setStrokeStyle(3, strokeCol, 0.95);
    const group = [bg, t];
    // ⚠️ UN CARTELLO ALLA VOLTA. Si disegnano tutti alla stessa altezza e restano quasi tre
    // secondi: se ne arriva un altro prima, i due testi finiscono UNO SOPRA L'ALTRO e non si
    // legge piu' niente. Segnalato col fuggitivo dorato (uccidendolo subito dopo la comparsa,
    // "IN FUGA" e "CATTURATO" si accavallavano), ma vale per qualsiasi coppia ravvicinata:
    // arrivo del boss + furia, mutatore + evento, e cosi' via.
    // Il nuovo SOSTITUISCE il vecchio, con un'uscita rapida invece che immediata (sparire di
    // colpo si legge come uno sfarfallio). Sostituire e non impilare: con tre cartelli in fila
    // una pila finirebbe fuori schermo, e comunque quello che conta e' sempre l'ultimo.
    const vecchio = scene._cartelloAttivo;
    if (vecchio && vecchio.length && vecchio[0].active) {
      scene.tweens.killTweensOf(vecchio);
      scene.tweens.add({ targets: vecchio, alpha: 0, duration: 150, ease: 'Quad.in',
        onComplete: () => vecchio.forEach((o) => { if (o.active) o.destroy(); }) });
    }
    scene._cartelloAttivo = group;
    group.forEach((o) => { o.setAlpha(0); o.setScale(0.85); });
    // "Pop" d'entrata + permanenza lunga + dissolvenza.
    scene.tweens.add({ targets: group, alpha: 1, scaleX: 1, scaleY: 1, duration: 320, ease: 'Back.out' });
    scene.time.delayedCall(2600, () => {
      // se nel frattempo un altro cartello ha preso il posto, questo e' gia' stato tolto
      if (!bg.active || !t.active) return;
      scene.tweens.add({ targets: group, alpha: 0, duration: 550, ease: 'Quad.in',
        onComplete: () => {
          if (scene._cartelloAttivo === group) scene._cartelloAttivo = null;
          if (bg.active) bg.destroy();
          if (t.active) t.destroy();
        } });
    });
  },

  // Fumetto/battuta comica: piccola scritta che spunta sopra la testa del personaggio, sale un
  // po' e sfuma. Posizione fissata al momento della comparsa (effetto breve, non insegue il
  // movimento). Usata per dare carattere al personaggio (vedi window.SPEECH in state.js e
  // GameScene.maybeSpeech/showSpeech).
  showSpeech(scene, x, y, text) {
    const t = scene.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: '15px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4, align: 'center',
      wordWrap: { width: 150 },
    }).setOrigin(0.5, 1).setDepth(50);
    const bg = scene.add.rectangle(x, y - t.height / 2, t.width + 18, t.height + 12, 0x14161f, 0.68)
      .setOrigin(0.5, 0.5).setDepth(49).setStrokeStyle(2, 0xffd166, 0.85);
    const group = [bg, t];
    group.forEach((o) => { o.setAlpha(0); o.setScale(0.7); });
    scene.tweens.add({ targets: group, alpha: 1, scaleX: 1, scaleY: 1, y: '-=6', duration: 200, ease: 'Back.out' });
    scene.time.delayedCall(1400, () => {
      scene.tweens.add({ targets: group, alpha: 0, y: '-=14', duration: 400, ease: 'Quad.in', onComplete: () => { bg.destroy(); t.destroy(); } });
    });
  },
};
