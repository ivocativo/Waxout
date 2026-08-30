// MenuScene: titolo, avvio partita. RIDISEGNATA nel round 2 (H.1): prima la schermata
// principale era affollata (titolo+sottotitolo+banca+2 mascotte+9 righe di comandi/obiettivo
// tutti insieme) e lo sfondo era un gradiente+ellissi disegnati a mano, poco coerente col resto
// del gioco. Ora: sfondo VERO (stesso fondale carnoso pixel-art usato in partita), schermata
// principale alleggerita (comandi/obiettivo spostati in un pannello "?" a comparsa), pulsanti
// piu' curati (bordo + ombra, stesso linguaggio del negozio ma un po' piu' rifinito).
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const T = window.I18n;

    // Sfondo VERO del condotto (lo stesso fondale pixel-art usato in GameScene), + un velo
    // scuro per far risaltare i testi sopra — stessa tecnica gia' usata in UpgradeScene.
    window.GameGfx.drawBackground(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.32).setDepth(-13);

    // Pannello dietro a titolo/sottotitolo/banca: li raggruppa visivamente e aiuta la leggibilita'
    // sul fondale ora "vero" (piu' movimentato del vecchio gradiente piatto).
    this.add.rectangle(W / 2, 108, 620, 168, 0x000000, 0.3).setStrokeStyle(2, 0xffd166, 0.35).setDepth(-1);

    const title = this.add.text(W / 2, 66, 'WAXOUT', {
      fontFamily: 'monospace', fontSize: '60px', color: '#fdf0d5',
      stroke: '#14161f', strokeThickness: 8,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: '-=6', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add.text(W / 2, 118, T.t('menu_subtitle'), {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffe2b0',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    // Banca permanente (roguelike): cerume accumulato + record
    const meta = window.Meta.get();
    this.add.text(W / 2, 154, T.t('menu_bank', { bank: meta.bank, best: meta.bestLevel }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Mascotte: il personaggio VERO, quello animato che si usa in partita. Qui era rimasto il
    // vecchio sprite pixel di due restyling fa (segnalato dall'utente 2026-07-29): chi apriva il
    // gioco vedeva un personaggio, poi ne trovava un altro appena premeva Inizia.
    // Le animazioni sono registrate da BootScene, quindi sono gia' pronte qui.
    const guy = this.add.sprite(W / 2 - 150, 300, 'hero_idle', 0);
    guy.setScale(150 / guy.height);            // stessa statura della mascotte nemica
    if (this.anims.exists('hero_idle_a')) guy.play('hero_idle_a');
    this.tweens.add({ targets: guy, y: '-=12', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // Mascotte nemico: scala calcolata dalla texture (l'immagine AI e' molto piu' grande della
    // vecchia texture pixel — a scala fissa 2.6 sarebbe gigantesca). ~150px di altezza.
    const blob = this.add.sprite(W / 2 + 150, 320, 'enemy_blob');
    const bs = 150 / blob.height;
    blob.setScale(bs);
    // Striscia anche nel menu (l'animazione e' registrata da BootScene ed e' globale). Lo
    // schiacciamento a tween resta: da solo il ciclo e' volutamente sottile.
    if (this.anims.exists('blob_crawl')) blob.play('blob_crawl');
    this.tweens.add({ targets: blob, scaleY: bs * 0.9, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Pulsante: rettangolo con bordo + ombra leggera (stesso linguaggio del negozio, un po'
    // piu' rifinito) invece del vecchio testo piatto su sfondo giallo pieno.
    const mkBtn = (x, y, label, onTap, w) => {
      w = w || 190;
      const shadow = this.add.rectangle(x + 3, y + 4, w, 46, 0x000000, 0.35);
      const panel = this.add.rectangle(x, y, w, 46, 0xffd166, 1).setStrokeStyle(3, 0x8a5a1a, 0.9);
      const label_ = this.add.text(x, y, label, {
        fontFamily: 'monospace', fontSize: '19px', color: '#14161f',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(x, y, w, 46, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => panel.setFillStyle(0xffe199, 1));
      hit.on('pointerout', () => panel.setFillStyle(0xffd166, 1));
      hit.on('pointerdown', onTap);
      return { shadow, panel, label: label_, hit };
    };

    const begin = () => { window.Sfx.unlock(); window.GameState.reset(); this.scene.start('GameScene'); };
    const openShop = () => { window.Sfx.unlock(); this.scene.start('ShopScene'); };

    // ARSENALE TOLTO DAL MENU (2026-07-29, dopo il playtest): "si colpisce prevalentemente da
    // lontano, quindi variare le armi corpo a corpo ha poco senso" — si pubblica col kit unico
    // (coton fioc + spruzzino) e semmai si riapre se qualche giocatore lo chiede. Il meccanismo
    // resta tutto al suo posto (window.ARMI, ArmiScene, Meta.arma): per riaccenderlo basta
    // rimettere questo pulsante.
    const startBtn = mkBtn(W / 2 - 110, 430, T.t('menu_start'), begin, 200);
    this.tweens.add({ targets: [startBtn.panel, startBtn.label], alpha: 0.6, duration: 650, yoyo: true, repeat: -1 });
    mkBtn(W / 2 + 110, 430, T.t('menu_shop'), openShop, 200);

    // SELETTORE INFEZIONE (round A, A.5): compare solo dopo aver vinto almeno una volta (prima
    // infezioneUnlocked() vale 0 = solo il grado base, niente da scegliere). Frecce ◄ ►, tocco
    // ampio per il telefono. La scelta vive in window.GameState.infezione e NON viene azzerata da
    // reset(): begin() la conserva.
    const unlocked = window.Meta.infezioneUnlocked();
    if (unlocked >= 1) {
      // Il grado di partenza viene dal salvataggio, non dalla memoria della sessione: riaprendo
      // il gioco si ritrova quello che si stava giocando (vedi Meta.infezionePredefinita).
      window.GameState.infezione = window.Meta.infezionePredefinita();
      const iy = 384;
      const label = this.add.text(W / 2, iy, '', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ff9a8a',
        stroke: '#14161f', strokeThickness: 3,
      }).setOrigin(0.5);
      // Il nome della malattia accanto al numero: e' il tema che si sta per giocare (vedi
      // GameGfx.TEMI). Un numero da solo non dice dove stai andando.
      const refresh = () => {
        label.setText(T.t('menu_infezione', {
          n: window.GameState.infezione,
          tema: T.t('tema_' + window.GameGfx.temaAttivo().id),
        }));
        // ⚠️ LE FRECCE SI SPOSTANO CON LA SCRITTA. Erano a distanza fissa (96px dal centro), e da
        // quando accanto al numero c'e' il nome della malattia le parole lunghe ci finivano sotto
        // (segnalato dall'utente 2026-08-26). Si misura la scritta e si mettono di la'.
        const mezza = label.width / 2 + 34;
        if (this._frecce) this._frecce.forEach((f) => f.setX(W / 2 + f._verso * mezza));
        // Lo SFONDO deve seguire il grado scelto: e' il tema che cambia, e il tema decide le
        // tinte. Prima si aggiornava solo per caso, cambiando lingua (che ridisegna la scena).
        window.GameGfx.ritingiSfondo(this);
      };
      const arrow = (dx, chr) => {
        const a = this.add.text(W / 2 + dx, iy, chr, {
          fontFamily: 'monospace', fontSize: '22px', color: '#14161f',
          backgroundColor: '#ffd166', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        a.on('pointerover', () => a.setStyle({ backgroundColor: '#ffe199' }));
        a.on('pointerout', () => a.setStyle({ backgroundColor: '#ffd166' }));
        a.on('pointerdown', () => {
          window.Sfx.unlock();
          window.GameState.infezione = Phaser.Math.Clamp((window.GameState.infezione || 0) + dx / Math.abs(dx), 0, unlocked);
          window.Meta.setInfezioneScelta(window.GameState.infezione);   // si ricorda per la prossima volta
          refresh();
        });
        a._verso = dx / Math.abs(dx);
        return a;
      };
      this._frecce = [arrow(-96, '<'), arrow(96, '>')];
      refresh();                                   // ...dopo le frecce: e' lui a posizionarle
    } else {
      window.GameState.infezione = 0;   // non ancora sbloccato: sempre base
    }

    // PANNELLO DI PROVA: in un angolo, piccolo. Se una manopola e' stata girata lo dice, se no
    // ci si dimentica di averlo fatto e si giudica il gioco con numeri finti.
    // Nella versione da pubblicare non c'e': lo spegne `CONFIG.PANNELLO_PROVA` (vedi taratura.js).
    if (window.Taratura.acceso()) {
    const tarLabel = () => T.t('tar_open') + (window.Taratura.modificata() ? ' *' : '');
    const tarBtn = this.add.text(12, H - 10, tarLabel(), {
      fontFamily: 'monospace', fontSize: '11px',
      color: window.Taratura.modificata() ? '#ffffff' : '#ffd9d9',
      backgroundColor: window.Taratura.modificata() ? '#b03030' : '#6a3030',
      padding: { x: 8, y: 5 },
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    tarBtn.on('pointerdown', () => { window.Sfx.pick(); this.scene.start('TaraturaScene', { from: 'MenuScene' }); });
    }

    // Pannello INFO (era un "?" tondo fino al 2026-08-24: l'utente ha chiesto la parola, perche'
    // un punto interrogativo non dice cosa c'e' dentro).
    // ⚠️ SCORREVOLE. Dentro ci sono tre sezioni — come si gioca, comandi, crediti — e i crediti
    // sono destinati a crescere a ogni brano nuovo: un pannello a misura fissa avrebbe cominciato
    // a tagliare le righe in fondo senza che nessuno se ne accorgesse.
    const infoBtn = this.add.text(W / 2, 486, T.t('menu_info'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd166',
      backgroundColor: '#3a2430', padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    infoBtn.on('pointerover', () => infoBtn.setStyle({ backgroundColor: '#523344' }));
    infoBtn.on('pointerout', () => infoBtn.setStyle({ backgroundColor: '#3a2430' }));
    let helpOpen = null;
    const closeHelp = () => { if (helpOpen) { helpOpen.destroy(); helpOpen = null; } };
    const openHelp = () => {
      if (helpOpen) return;
      window.Sfx.unlock();
      const group = this.add.container(0, 0).setDepth(200);
      const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.62).setInteractive();
      const PW = 660, PH = 460;
      const panelBg = window.GameGfx.panel(this, W / 2, H / 2, PW, PH, { accento: window.GameGfx.UI.ambraScura });
      // Finestrella entro cui si vede il contenuto: quello che esce di qui viene ritagliato.
      const vX = W / 2 - PW / 2 + 24, vY = H / 2 - PH / 2 + 22;
      const vW = PW - 48, vH = PH - 62;

      // TUTORIAL PER PRIMO (richiesta dell'utente): a chi apre questa schermata la prima volta
      // serve sapere COSA deve fare, non quale tasto salta. I comandi si ricontrollano dopo.
      const sezioni = [
        { titolo: T.t('menu_tutorial_title'), colore: '#ffd166', dim: 15, corpo: [
          T.t('menu_goal_1'), T.t('menu_goal_2'),
        ] },
        { titolo: T.t('menu_ctrl_title'), colore: '#ffd166', dim: 15, corpo: [
          T.t('menu_ctrl_move'), T.t('menu_ctrl_jump'), T.t('menu_ctrl_attack'),
          T.t('menu_ctrl_dash'), T.t('menu_ctrl_leg'), T.t('menu_ctrl_touch'),
        ] },
        // CREDITI. Tutti i brani sono CC0 e non OBBLIGANO a citare nessuno, ma l'autore di quello
        // del menu lo chiede sulla sua scheda ("you are committed to mention Rob Bery"), e chi
        // regala musica merita il suo nome. Gli altri sono qui per correttezza.
        { titolo: T.t('credits_title'), colore: '#c9a6b2', dim: 12, corpo: [
          T.t('credits_music'),
          T.t('credits_m1'), T.t('credits_m2'), T.t('credits_m3'), T.t('credits_m4'),
          '', T.t('credits_engine'),
        ] },
      ];

      const contenuto = this.add.container(vX, vY);
      let y = 0;
      sezioni.forEach((sez, i) => {
        if (i > 0) {
          const sep = this.add.graphics();
          sep.fillStyle(window.GameGfx.UI.bordo, 0.5);
          sep.fillRect(0, y + 8, vW, 1);
          contenuto.add(sep);
          y += 24;
        }
        const tit = this.add.text(vW / 2, y, sez.titolo, {
          fontFamily: 'monospace', fontSize: '14px', color: sez.colore,
        }).setOrigin(0.5, 0);
        contenuto.add(tit);
        y += tit.height + 10;
        const corpo = this.add.text(vW / 2, y, sez.corpo.join('\n'), {
          fontFamily: 'monospace', fontSize: sez.dim + 'px',
          color: sez.dim > 12 ? '#fff7e8' : '#c9a6b2', align: 'center',
          lineSpacing: 4, wordWrap: { width: vW - 20 },
        }).setOrigin(0.5, 0);
        contenuto.add(corpo);
        y += corpo.height + 14;
      });
      const altezza = y;

      const maschera = this.make.graphics({ x: 0, y: 0, add: false });
      maschera.fillStyle(0xffffff, 1);
      maschera.fillRect(vX, vY, vW, vH);
      contenuto.setMask(maschera.createGeometryMask());

      // Barretta di scorrimento: senza, non si capisce che sotto c'e' altro — ed e' l'unica cosa
      // che distingue "il testo finisce qui" da "il testo continua".
      const scorrevole = Math.max(0, altezza - vH);
      const barra = this.add.rectangle(vX + vW + 8, vY, 3, vH * Math.min(1, vH / altezza), 0xffd166, 0.5)
        .setOrigin(0, 0).setVisible(scorrevole > 0);
      let scorri = 0;
      const applica = () => {
        scorri = Phaser.Math.Clamp(scorri, 0, scorrevole);
        contenuto.y = vY - scorri;
        if (scorrevole > 0) barra.y = vY + (vH - barra.height) * (scorri / scorrevole);
      };

      // Si scorre trascinando (telefono) o con la rotellina (computer). ⚠️ La zona di presa sta
      // SOPRA al fondo scuro: senza, il trascinamento arrivava al fondo e chiudeva il pannello.
      const presa = this.add.zone(W / 2, H / 2, PW, PH).setInteractive({ draggable: false });
      let ultimo = null;
      presa.on('pointerdown', (p) => { ultimo = p.y; });
      presa.on('pointermove', (p) => {
        if (ultimo === null || !p.isDown) return;
        scorri -= (p.y - ultimo); ultimo = p.y; applica();
      });
      presa.on('pointerup', () => { ultimo = null; });
      const rotella = (p, sopra, dx, dy) => { scorri += dy * 0.5; applica(); };
      this.input.on('wheel', rotella);
      applica();

      const hint = this.add.text(W / 2, H / 2 + PH / 2 - 18, T.t('menu_help_close'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#cabfa0',
      }).setOrigin(0.5);
      group.add([backdrop, panelBg, contenuto, barra, presa, hint]);
      backdrop.on('pointerdown', closeHelp);
      // Alla chiusura si stacca la rotellina: restasse attaccata, ogni pannello aperto ne
      // lascerebbe una copia in ascolto e lo scorrimento accelererebbe a ogni apertura.
      group.once('destroy', () => { this.input.off('wheel', rotella); maschera.destroy(); });
      helpOpen = group;
    };
    infoBtn.on('pointerdown', openHelp);

    // Selettore lingua: in alto a destra; toccarlo cambia lingua e ridisegna.
    const langBtn = this.add.text(W - 16, 16, T.t('menu_lang', { lang: T.nativeName(T.lang) }), {
      fontFamily: 'monospace', fontSize: '15px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 12, y: 7 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    langBtn.on('pointerover', () => langBtn.setStyle({ backgroundColor: '#ffe199' }));
    langBtn.on('pointerout', () => langBtn.setStyle({ backgroundColor: '#ffd166' }));
    langBtn.on('pointerdown', () => { window.Sfx.unlock(); T.next(); this.scene.restart(); });

    // Controlli audio: volume (cicla pieno/basso/muto) e musica on/off, in alto a sinistra.
    window.Sfx.addAudioButton(this, 28, 26);
    window.Sfx.addMusicButton(this, 68, 26);

    // Atmosfera musicale del menu (parte davvero al primo tocco, via unlock).
    window.Sfx.setMusic('menu');

    this.input.keyboard.once('keydown-ENTER', begin);
    this.input.keyboard.once('keydown-SPACE', begin);
    this.input.keyboard.once('keydown-N', openShop);
  }
}
window.MenuScene = MenuScene;
