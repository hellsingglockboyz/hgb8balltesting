/* 7.0.1: LATE NIGHT CONFESSION — 8 ball
   Respostas em ANSWERS (curtas: precisam caber na janela da bola). */
(() => {
  'use strict';

  const CONFIG = {
    promoChance: 0.12, // chance de sair uma resposta que cita o álbum
    shakeMs: 1100,
  };

  const ANSWERS = {
    yes: ['sim.', 'yessir.', 'pode crer.', 'é certo.', 'você já sabe.', 'sempre foi sim.', 'ninguém vai saber.', 'tá feito.', 'vai.'],
    no: ['não.', 'nem.', 'tarde demais.', 'hoje não.', 'ninguém vem.', 'você sabe a resposta.', 'wtf 🤣 hell no.', 'tá viajando.', 'nah.', 'sem chance.'],
    maybe: ['pergunta às 3 da manhã.', 'silêncio.', 'ainda não.', 'as vozes decidem.', 'não sei. tá escuro.'],
    promo: ['Vampires are real.', 'pergunta à meia-noite.'],
  };
  const PLACEHOLDERS = ['confess.', 'what are you hiding.', 'who do you miss.', 'say it.', 'ask the dark.'];

  const $ = (id) => document.getElementById(id);
  const el = {
    gate: $('gate'), enter: $('enter'), stage: $('stage'), rig: $('rig'), liquid: $('liquid'), ans: $('ans'), sr: $('srAnswer'),
    form: $('askForm'), q: $('q'), go: $('go'), after: $('after'), again: $('again'), makeCard: $('makeCard'),
    modal: $('modal'), cardImg: $('cardImg'), dl: $('dl'), share: $('share'), closeModal: $('closeModal'),
    timer: $('timer'),
  };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (n) => Math.floor(Math.random() * n);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let busy = false, last = { q: '', a: '' }, lastAnswer = '';

  /* partículas finas na água (sem bolhas) */
  (function () {
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('i');
      const sz = 1 + Math.random() * 1.6;
      p.style.cssText =
        `--s:${sz.toFixed(1)}px;--o:${(0.12 + Math.random() * 0.25).toFixed(2)};--x:${(Math.random() * 100).toFixed(1)}%;--y:${(Math.random() * 100).toFixed(1)}%;` +
        `--dur:${(9 + Math.random() * 9).toFixed(1)}s;--dly:-${(Math.random() * 12).toFixed(1)}s;` +
        `--dx:${((Math.random() * 2 - 1) * 10).toFixed(1)}px;--dy:${((Math.random() * 2 - 1) * 10).toFixed(1)}px`;
      el.liquid.appendChild(p);
    }
  })();

  /* timer: meia-noite de 2 de novembro de 2026, no horário local de quem está vendo */
  (function () {
    const target = new Date(2026, 10, 2, 0, 0, 0).getTime();
    const pad = (n) => String(n).padStart(2, '0');
    function tick() {
      const t = Math.max(0, Math.floor((target - Date.now()) / 1000));
      if (t === 0) { el.timer.textContent = 'out now'; return; }
      el.timer.textContent = `${pad(Math.floor(t / 86400))}d ${pad(Math.floor((t % 86400) / 3600))}h ${pad(Math.floor((t % 3600) / 60))}m ${pad(t % 60)}s`;
    }
    tick(); setInterval(tick, 1000);
  })();

  /* a bola acompanha o ponteiro */
  (function () {
    if (reduceMotion) return;
    let tx = 0, ty = 0, x = 0, y = 0;
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth) * 2 - 1;
      ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
    (function loop() {
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      el.rig.style.setProperty('--px', x.toFixed(3));
      el.rig.style.setProperty('--py', y.toFixed(3));
      requestAnimationFrame(loop);
    })();
  })();

  /* ===== som (só depois do ENTER) =====
     Tudo sintetizado na hora (zero arquivo, funciona em file://). Vibe: Nosferatu / noite de sinfonia vampiresca.
     Calmo, macio, em ré menor.
       música   = noturno: piano em tercinas + violino + violoncelo + cordas, loop de 16 compassos (composição própria, estilo romântico)
       ambiente = vento, estalinhos de fita velha, sino bem distante
       chocalho = xilofone de esqueleto (ossos cartoon)
       resposta = harpa suave + sininho + cordas
       letras   = máquina de escrever rápida
     Volumes: AMBIENT_LEVEL (ambiente) e MUSIC_LEVEL (música). 0 = mudo, 1 = bem presente.
     MUSIC_FILE: se quiser uma gravação real (ex.: 'assets/noturno.mp3'), coloque o caminho aqui
     e ela toca em loop no lugar da música sintetizada. */
  const AMBIENT_LEVEL = 0.5;
  const MUSIC_LEVEL = 0.6;
  const MUSIC_FILE = 'assets/classical_song.mp3';

  let ac = null, noiseBuf = null, master = null, verbIn = null, ambBus = null, musBus = null, duckNode = null;
  let ambOn = false, fileAudio = null, fadeTimer = null;
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const rr = (a, b) => a + Math.random() * (b - a);

  function initAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ac = new Ctx();
      const sr = ac.sampleRate;

      noiseBuf = ac.createBuffer(1, sr * 3, sr);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
      master = ac.createGain(); master.gain.value = 0.85;
      master.connect(comp); comp.connect(ac.destination);

      // reverb escuro de igreja (impulso gerado + lowpass, cauda ~3.4s)
      const len = Math.floor(sr * 3.4), ir = ac.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); let lp = 0;
        for (let i = 0; i < len; i++) {
          lp += ((Math.random() * 2 - 1) - lp) * 0.28;
          d[i] = lp * Math.pow(1 - i / len, 2.4);
        }
      }
      const verb = ac.createConvolver(); verb.buffer = ir;
      const verbOut = ac.createGain(); verbOut.gain.value = 0.75;
      verbIn = ac.createGain();
      verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);

      // música e ambiente: bus (fade-in) -> duckNode (abaixa quando tem efeito) -> master; cada bus alimenta o reverb
      duckNode = ac.createGain(); duckNode.connect(master);
      ambBus = ac.createGain(); ambBus.gain.value = 0; ambBus.connect(duckNode);
      musBus = ac.createGain(); musBus.gain.value = 0; musBus.connect(duckNode);
      const as = ac.createGain(); as.gain.value = 0.6; ambBus.connect(as); as.connect(verbIn);
      const ms = ac.createGain(); ms.gain.value = 0.7; musBus.connect(ms); ms.connect(verbIn);
    } catch (e) { ac = null; return; }
  }

  /* ---------- helpers ---------- */
  function wet(node, amt) { const g = ac.createGain(); g.gain.value = amt; node.connect(g); g.connect(verbIn); return g; }
  function pan(node, p, dest) {
    if (ac.createStereoPanner) { const s = ac.createStereoPanner(); s.pan.value = p; node.connect(s); s.connect(dest); } else node.connect(dest);
  }
  function noiseSrc(loop) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s; }
  function lfo(rate, depth, param) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o;
  }
  function duck(depth, hold) {
    if (!ac || !ambOn) return;
    const t = ac.currentTime, g = duckNode.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.setTargetAtTime(depth, t, 0.06); g.setTargetAtTime(1, t + hold, 0.8);
  }

  /* ---------- instrumentos ---------- */
  // sino (parciais inarmônicos); send > 0 só quando o destino não tem reverb próprio
  function bell(f, vol, send, dest) {
    const t = ac.currentTime;
    const P = [[0.5, 0.55, 5], [1, 0.6, 4.2], [1.19, 0.38, 3], [1.56, 0.26, 2.4], [2, 0.24, 2], [2.51, 0.14, 1.4], [3.01, 0.1, 1.1], [4.1, 0.06, 0.7]];
    const out = ac.createGain(); out.gain.value = vol; out.connect(dest); if (send) wet(out, send);
    P.forEach(([r, a, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * r * (1 + rr(-0.0015, 0.0015));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    });
  }

  // piano macio (senoides + harmônicos, filtro que fecha com o tempo)
  function piano(f, t, vel, dest, send) {
    const g = ac.createGain(), lp = ac.createBiquadFilter(), d = Math.max(1.4, 3.2 - f / 450);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(f * 7, 4500), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.8, 350), t + 1.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    [[1, 1, 'sine'], [2, 0.3, 'sine'], [3, 0.1, 'sine'], [1.003, 0.4, 'triangle']].forEach(([r, a, ty]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = ty; o.frequency.value = f * r; og.gain.value = a;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + d + 0.05);
    });
    lp.connect(g);
    pan(g, Math.max(-0.6, Math.min(0.6, Math.log2(f / 262) * 0.35)), dest || musBus);
    if (send) wet(g, send);
  }

  // violino: serras desafinadas + vibrato + arco (ataque lento)
  function violin(f, t, dur, vel) {
    const lp = ac.createBiquadFilter(), hp = ac.createBiquadFilter(), g = ac.createGain(), end = t + dur + 0.55;
    lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.6;
    hp.type = 'highpass'; hp.frequency.value = 220;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.3);
    g.gain.setValueAtTime(vel * 0.9, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, end);
    [-6, 6].forEach((det) => {
      const o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      vib.frequency.value = rr(4.9, 5.5); vg.gain.value = 7; vib.connect(vg); vg.connect(o.detune);
      o.connect(hp); o.start(t); o.stop(end + 0.05); vib.start(t); vib.stop(end + 0.05);
    });
    hp.connect(lp); lp.connect(g); pan(g, 0.15, musBus);
  }

  // violoncelo: nota longa e grave
  function cello(f, t, dur, vel) {
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.7);
    g.gain.setValueAtTime(vel, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
    [-5, 5].forEach((det) => {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 1);
    });
    lp.connect(g); g.connect(musBus);
  }

  // cordas em cama (acorde sustentado)
  function strings(notes, t, dur, o) {
    o = o || {};
    const vel = o.vel || 0.01, att = o.att || 1.4, rel = o.rel || 1.6, dest = o.dest || musBus;
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + att);
    g.gain.setValueAtTime(vel, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    notes.forEach((n) => [-7, 7].forEach((det) => {
      const os = ac.createOscillator(); os.type = 'sawtooth'; os.frequency.value = mtof(n); os.detune.value = det;
      os.connect(lp); os.start(t); os.stop(t + dur + rel + 0.05);
    }));
    lp.connect(g); g.connect(dest); if (o.send) wet(g, o.send);
  }

  // xilofone de esqueleto
  function xylo(f, t, vel, p) {
    const g = ac.createGain(), d = 0.2 - Math.min(0.08, Math.max(0, f - 500) / 8000);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    [[1, 1], [2.7, 0.08]].forEach(([r, a]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * r; og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.03);
    });
    const n = noiseSrc(), bp = ac.createBiquadFilter(), ng = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
    ng.gain.setValueAtTime(0.14, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.009);
    n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t, rr(0, 2.5), 0.02);
    pan(g, p, master); wet(g, 0.12);
  }

  // tecla de máquina de escrever
  function key(t, vel) {
    const n = noiseSrc(), bp = ac.createBiquadFilter(), ng = ac.createGain(), o = ac.createOscillator(), og = ac.createGain(), mix = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = rr(1800, 3200); bp.Q.value = 1.4;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.001); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
    o.type = 'sine'; o.frequency.setValueAtTime(rr(150, 210), t); o.frequency.exponentialRampToValueAtTime(70, t + 0.04);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(bp); bp.connect(ng); ng.connect(mix); o.connect(og); og.connect(mix);
    pan(mix, rr(-0.15, 0.15), master); wet(mix, 0.1);
    n.start(t, rr(0, 2.9), 0.03); o.start(t); o.stop(t + 0.06);
  }

  /* ---------- efeitos ---------- */
  function sfxRattle(ms) {
    if (!ac) return;
    const t0 = ac.currentTime, dur = ms / 1000, SC = [74, 77, 79, 81, 84]; // D F G A C
    duck(0.6, dur + 0.3);

    // ossos: xilofone rápido, três toques + respiro
    let t = t0 + 0.02, k = rand(SC.length), i = 0;
    while (t < t0 + dur - 0.12) {
      k = Math.max(0, Math.min(SC.length - 1, k + [-1, 0, 0, 1][rand(4)]));
      const env = Math.sin(Math.PI * Math.min(1, (t - t0) / dur)) * 0.6 + 0.4;
      xylo(mtof(SC[k]), t, 0.035 * env * rr(0.8, 1), rr(-0.35, 0.35));
      t += (i % 4 === 3 ? 0.16 : 0.085) * rr(0.92, 1.08); i++;
    }

    // líquido bem de leve
    const sl = noiseSrc(true), lpf = ac.createBiquadFilter(), sg = ac.createGain();
    lpf.type = 'lowpass'; lpf.frequency.value = 500; lpf.Q.value = 1;
    lfo(4.5, 200, lpf.frequency);
    sg.gain.setValueAtTime(0.0001, t0); sg.gain.linearRampToValueAtTime(0.03, t0 + 0.2);
    sg.gain.setValueAtTime(0.03, t0 + dur - 0.2); sg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    sl.connect(lpf); lpf.connect(sg); sg.connect(master);
    sl.start(t0, rr(0, 1)); sl.stop(t0 + dur + 0.05);
  }

  function sfxReveal() {
    if (!ac) return;
    const t = ac.currentTime;
    duck(0.55, 1.4);
    // harpa macia rolando um Dm aberto
    [50, 57, 62, 65, 69].forEach((n, k) => piano(mtof(n), t + k * 0.075, (0.1 - k * 0.012) * 0.8, master, 0.44));
    // Resposta 20% mais baixa; mantém o timbre e a reverberação.
    bell(mtof(74), 0.032, 0.72, master);
    strings([50, 57, 62], t, 1.2, { dest: master, send: 0.48, vel: 0.0096, att: 0.35, rel: 1.4 });
  }

  // letras aparecendo (chamada a cada 2 letras). Às vezes (~60% das respostas) entra a máquina de escrever rápida;
  // nas outras, só uns toquinhos suaves de piano em ré menor.
  let tickLast = -9, tickMode = 'type', tickN = 0;
  function sfxTick() {
    if (!ac) return;
    const t = ac.currentTime;
    if (t - tickLast > 0.8) { tickMode = Math.random() < 0.6 ? 'type' : 'soft'; tickN = 0; }
    tickLast = t; tickN++;
    if (tickMode === 'type') {
      key(t, rr(0.8, 1));
      key(t + 0.055 * rr(0.9, 1.1), rr(0.6, 1));
    } else if (tickN % 3 === 1) {
      piano(mtof([74, 77, 81, 79, 74, 69][rand(6)]), t, 0.03, master, 0.5);
    }
  }

  /* ---------- música: noturno em ré menor, 16 compassos em loop ---------- */
  const BEAT = 1.2, BAR = BEAT * 4;
  const CH = {
    Dm: { b: 38, a: [57, 62, 65] }, Bb: { b: 34, a: [58, 62, 65] }, Gm: { b: 31, a: [55, 58, 62] },
    A: { b: 33, a: [57, 61, 64] }, A7: { b: 33, a: [57, 61, 67] }, F: { b: 41, a: [57, 60, 65] }, C: { b: 36, a: [55, 60, 64] },
  };
  const PROG = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A7', 'F', 'C', 'Bb', 'Gm', 'Dm', 'A', 'Gm', 'A'];
  // melodia do violino por compasso: [nota midi, início em tempos, duração em tempos]
  const MEL = [
    [[69, 0, 3], [67, 3, 1]], [[65, 0, 2], [67, 2, 1], [65, 3, 1]], [[70, 0, 2], [69, 2, 1], [67, 3, 1]], [[64, 0, 2], [65, 2, 1], [64, 3, 1]],
    [[74, 0, 3], [72, 3, 1]], [[70, 0, 2], [72, 2, 1], [70, 3, 1]], [[67, 0, 2], [70, 2, 2]], [[69, 0, 1], [67, 1, 1], [65, 2, 1], [64, 3, 1]],
    [[65, 0, 2], [69, 2, 2]], [[67, 0, 2], [72, 2, 2]], [[74, 0, 3], [72, 3, 1]], [[70, 0, 2], [69, 2, 1], [67, 3, 1]],
    [[65, 0, 2], [69, 2, 2]], [[61, 0, 2], [64, 2, 2]], [[70, 0, 2], [67, 2, 2]], [[64, 0, 2], [61, 2, 2]],
  ];
  let nextBar = 0, barN = 0, musicTimer = null;

  function scheduleBar(n, t0) {
    const i = n % PROG.length, c = CH[PROG[i]], swell = 0.85 + 0.15 * Math.sin((i / PROG.length) * Math.PI * 2), step = BAR / 12;
    for (let k = 0; k < 12; k++) {
      piano(mtof(c.a[k % 3]), t0 + k * step + rr(0, 0.012), (k % 3 === 0 ? 0.05 : 0.034) * swell * rr(0.85, 1.1));
    }
    piano(mtof(c.b), t0, 0.07 * swell);
    piano(mtof(c.b + 12), t0 + 0.01, 0.05 * swell);
    cello(mtof(c.b + 12), t0, BAR, 0.035);
    if (n >= 1) strings(c.a, t0, BAR);
    if (n >= 2) MEL[i].forEach(([m, s, d]) => violin(mtof(m), t0 + s * BEAT, d * BEAT, 0.03 * swell));
  }

  function startMusic() {
    nextBar = ac.currentTime + 0.4; barN = 0;
    const pump = () => {
      if (!ac || ac.state !== 'running') return;
      if (nextBar < ac.currentTime - 0.2) nextBar = ac.currentTime + 0.1;
      while (nextBar < ac.currentTime + 1.5) { scheduleBar(barN, nextBar); nextBar += BAR; barN++; }
    };
    pump(); musicTimer = setInterval(pump, 300);
  }

  /* ---------- música de fundo: arquivo real, em loop ---------- */
  function startBackgroundMusic() {
    if (fileAudio) {
      fileAudio.play().catch(() => {});
      return;
    }
    fileAudio = new Audio(MUSIC_FILE);
    fileAudio.loop = true;
    fileAudio.volume = 0;
    const playPromise = fileAudio.play();
    if (playPromise && playPromise.catch) playPromise.catch(() => {});
    let v = 0;
    fadeTimer = setInterval(() => {
      v = Math.min(1, v + 0.04);
      // Volume final em 88% (reduzido em cerca de 12%).
      if (fileAudio) fileAudio.volume = 0.88 * v;
      if (v >= 1) {
        clearInterval(fadeTimer);
        fadeTimer = null;
      }
    }, 150);
  }

  // Ao trocar de aba, pausa apenas os efeitos sintetizados. A música MP3
  // continua tocando suavemente em segundo plano, em loop.
  document.addEventListener('visibilitychange', () => {
    if (ac) {
      if (document.hidden) ac.suspend();
      else ac.resume().catch(() => {});
    }
  });

  // Bloqueia o menu do botão direito no site, exceto em hyperlinks.
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('a[href]')) return;
    e.preventDefault();
  });

  /* texto na janela da bola */
  let typer = null;
  function setAns(text, type) {
    clearInterval(typer);
    text = text.toUpperCase();
    if (!type || reduceMotion) { el.ans.textContent = text; return Promise.resolve(); }
    return new Promise((resolve) => {
      let i = 0; el.ans.textContent = '';
      typer = setInterval(() => {
        i++; el.ans.textContent = text.slice(0, i);
        if (i % 2 === 0) sfxTick();
        if (i >= text.length) { clearInterval(typer); resolve(); }
      }, 55);
    });
  }

  function pickAnswer() {
    const pool = Math.random() < CONFIG.promoChance ? ANSWERS.promo : [].concat(ANSWERS.yes, ANSWERS.no, ANSWERS.maybe);
    let a, guard = 0;
    do { a = pool[rand(pool.length)]; guard++; } while (a === lastAnswer && guard < 8);
    lastAnswer = a;
    return a;
  }

  function nope() {
    el.form.classList.remove('nope'); void el.form.offsetWidth; el.form.classList.add('nope');
    el.q.focus();
  }

  async function shake() {
    if (busy) return;
    const q = el.q.value.trim();
    if (!q) { nope(); return; }
    busy = true; el.go.disabled = true; el.after.hidden = true;
    el.stage.classList.remove('reveal');
    el.stage.classList.add('shaking');
    el.sr.textContent = ''; setAns('', false);
    if (navigator.vibrate) { try { navigator.vibrate([60, 40, 60, 40, 90]); } catch (e) { /* ok */ } }
    const ms = reduceMotion ? 500 : CONFIG.shakeMs;
    sfxRattle(ms);
    await sleep(ms);

    const answer = pickAnswer();
    el.stage.classList.remove('shaking');
    void el.stage.offsetWidth;
    el.stage.classList.add('reveal');
    sfxReveal();
    el.sr.textContent = answer;
    last = { q, a: answer };
    await setAns(answer, true);

    el.after.hidden = false; el.go.disabled = false; busy = false;
  }

  el.form.addEventListener('submit', (e) => { e.preventDefault(); initAudio(); startBackgroundMusic(); shake(); });
  el.stage.addEventListener('click', () => { initAudio(); startBackgroundMusic(); shake(); });
  el.again.addEventListener('click', () => {
    el.q.value = ''; el.q.placeholder = PLACEHOLDERS[rand(PLACEHOLDERS.length)];
    el.stage.classList.remove('reveal'); setAns('', false); el.after.hidden = true; el.q.focus();
  });

  /* sacudir o celular */
  let lastShakeAt = 0;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity; if (!a) return;
    const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    const now = Date.now();
    if (mag > 26 && now - lastShakeAt > 2500 && !busy && el.gate.hidden) { lastShakeAt = now; shake(); }
  }
  async function enableMotion() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return;
      }
      window.addEventListener('devicemotion', onMotion);
    } catch (e) { /* sem problema */ }
  }

  el.enter.addEventListener('click', () => {
    initAudio(); startBackgroundMusic(); enableMotion();
    el.gate.hidden = true;
    el.q.focus({ preventScroll: true });
  });

  /* ===== card pro story (1080 x 1920), preto e branco ===== */
  function wrap(ctx, text, maxW, maxLines) {
    const words = text.split(/\s+/), lines = []; let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let l = lines[maxLines - 1];
      while (ctx.measureText(`${l}…`).width > maxW && l.length > 1) l = l.slice(0, -1);
      lines[maxLines - 1] = `${l}…`;
    }
    return lines;
  }
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  async function buildCard(question, answer) {
    try { await Promise.all([document.fonts.load('900 60px "Archivo"'), document.fonts.load('700 60px "UnifrakturCook"')]); } catch (e) { /* fallback */ }
    const W = 1080, H = 1920, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const sans = '"Archivo", "Arial Black", sans-serif', serif = '"Times New Roman", Times, serif';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W / 2, 1000, 40, W / 2, 1000, 760);
    g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // título
    ctx.textAlign = 'center'; ctx.fillStyle = '#b3121a';
    ctx.font = `700 150px "UnifrakturCook", "Times New Roman", serif`;
    ctx.fillText('7.0.1:', W / 2, 270);
    ctx.font = `700 118px "UnifrakturCook", "Times New Roman", serif`;
    ctx.fillText('Late Night', W / 2, 395);
    ctx.fillText('Confession', W / 2, 505);

    // pergunta
    ctx.textAlign = 'center'; ctx.fillStyle = '#7d7d7d'; ctx.font = `italic 34px ${serif}`;
    ctx.fillText('you asked', W / 2, 600);
    ctx.fillStyle = '#ececec'; ctx.font = `italic 56px ${serif}`;
    wrap(ctx, `“${question}”`, 900, 3).forEach((l, i) => ctx.fillText(l, W / 2, 670 + i * 66));

    // vampiro
    try {
      const v = await loadImg(window.CARD_VAMP || 'assets/vampire.webp');
      const vw = 1000, vh = vw * (v.height / v.width), top = 800;
      ctx.save(); ctx.beginPath(); ctx.rect(0, top - 20, W, 860); ctx.clip();
      ctx.drawImage(v, (W - vw) / 2, top, vw, vh); ctx.restore();
      // Sombra contínua sobre toda a arte: sem faixa clara nem espaço vazio antes da resposta.
      g = ctx.createLinearGradient(0, 800, 0, 1660);
      g.addColorStop(0, 'rgba(0,0,0,0.18)');
      g.addColorStop(0.38, 'rgba(0,0,0,0.28)');
      g.addColorStop(0.72, 'rgba(0,0,0,0.72)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = g; ctx.fillRect(0, 800, W, 860);
    } catch (e) { /* segue sem a imagem */ }

    // resposta
    ctx.font = `bold 92px ${serif}`; ctx.lineJoin = 'round';
    const aLines = wrap(ctx, answer.toUpperCase(), 880, 3), lh = 104;
    aLines.forEach((l, i) => {
      const y = 1585 + i * lh;
      ctx.lineWidth = 14; ctx.strokeStyle = '#000'; ctx.strokeText(l, W / 2, y);
      ctx.fillStyle = '#fff'; ctx.fillText(l, W / 2, y);
    });

    // rodapé: mantém apenas a assinatura do artista, sem o título repetido
    ctx.fillStyle = '#7d7d7d'; ctx.font = `italic 26px ${serif}`;
    ctx.fillText('hellsing glock boyz', W / 2, 1888);

    for (let i = 0; i < 26000; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    return c.toDataURL('image/png');
  }

  function dataUrlToFile(url, name) {
    const [head, b64] = url.split(','), mime = /:(.*?);/.exec(head)[1], bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  }

  let cardUrl = '';
  el.makeCard.addEventListener('click', async () => {
    if (!last.q) return;
    el.makeCard.disabled = true;
    const label = el.makeCard.textContent; el.makeCard.textContent = '...';
    try {
      cardUrl = await buildCard(last.q, last.a);
      el.cardImg.src = cardUrl; el.dl.href = cardUrl; el.modal.hidden = false;
      try { el.share.hidden = !(navigator.canShare && navigator.canShare({ files: [dataUrlToFile(cardUrl, 'late-night-confession.png')] })); } catch (e) { el.share.hidden = true; }
      el.closeModal.focus();
    } catch (e) { /* silêncio */ }
    el.makeCard.textContent = label; el.makeCard.disabled = false;
  });
  el.share.addEventListener('click', async () => {
    try { await navigator.share({ files: [dataUrlToFile(cardUrl, 'late-night-confession.png')], title: '7.0.1: LATE NIGHT CONFESSION' }); } catch (e) { /* cancelado */ }
  });
  const closeModal = () => { el.modal.hidden = true; el.makeCard.focus(); };
  el.closeModal.addEventListener('click', closeModal);
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.modal.hidden) closeModal(); });
})();