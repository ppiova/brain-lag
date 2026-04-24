/* Brain Lag — Procedural Audio Engine
 * Tron/Daft Punk-inspired synthwave loop + SFX.
 * Zero dependencies, zero binaries. All synthesized at runtime via Web Audio API.
 */

(() => {
  'use strict';

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let started = false;
  let muted = false;
  let loopTimer = null;
  let barIndex = 0;
  let nextBarAt = 0;

  const BPM = 118;
  const BEAT = 60 / BPM;
  const BAR = BEAT * 4;

  const NOTES = {
    C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
  };
  const f = n => NOTES[n] || 220;

  // Am - F - C - G — cold minor opener, lifts to major.
  const CHORDS = [
    { root: 'A1', bass: 'A2', arp: ['A3', 'C4', 'E4', 'A4', 'E4', 'C4', 'E4', 'A4'] },
    { root: 'F1', bass: 'F2', arp: ['F3', 'A3', 'C4', 'F4', 'C4', 'A3', 'C4', 'F4'] },
    { root: 'C2', bass: 'C3', arp: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'G4', 'C5'] },
    { root: 'G1', bass: 'G2', arp: ['G3', 'B3', 'D4', 'G4', 'D4', 'B3', 'D4', 'G4'] },
  ];

  NOTES.A1 = 55.00; NOTES.F1 = 43.65; NOTES.G1 = 49.00;

  function ensureCtx() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
  }

  function kick(t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.13);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g); g.connect(musicBus);
    osc.start(t); osc.stop(t + 0.3);

    // click transient
    const click = ctx.createOscillator();
    const cg = ctx.createGain();
    click.type = 'triangle';
    click.frequency.value = 1800;
    cg.gain.setValueAtTime(0.25, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    click.connect(cg); cg.connect(musicBus);
    click.start(t); click.stop(t + 0.03);
  }

  function hihat(t, len = 0.04, gain = 0.14) {
    const bufSize = Math.floor(ctx.sampleRate * len);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(hp); hp.connect(g); g.connect(musicBus);
    src.start(t);
  }

  function bassNote(freq, t, dur) {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    o1.frequency.value = freq;
    o2.frequency.value = freq * 2;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + dur * 0.35);
    filter.frequency.exponentialRampToValueAtTime(300, t + dur);
    filter.Q.value = 8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.01);
    g.gain.setValueAtTime(0.32, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    o1.connect(mix); o2.connect(mix);
    mix.connect(filter); filter.connect(g); g.connect(musicBus);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function arpNote(freq, t, dur) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3500;
    filter.Q.value = 2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);

    osc.connect(filter); filter.connect(g); g.connect(musicBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function pad(freq, t, dur) {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    o1.frequency.value = freq;
    o2.frequency.value = freq * 1.007;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.linearRampToValueAtTime(1400, t + dur / 2);
    filter.frequency.linearRampToValueAtTime(400, t + dur);
    filter.Q.value = 4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.1);
    g.gain.setValueAtTime(0.07, t + dur - 0.25);
    g.gain.linearRampToValueAtTime(0, t + dur);

    const mix = ctx.createGain(); mix.gain.value = 0.5;
    o1.connect(mix); o2.connect(mix);
    mix.connect(filter); filter.connect(g); g.connect(musicBus);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  function scheduleBar(t) {
    const chord = CHORDS[barIndex % CHORDS.length];

    // drums — four-on-the-floor kick, off-beat hats, ghost 16th notes
    for (let b = 0; b < 4; b++) kick(t + b * BEAT);
    for (let b = 0; b < 8; b++) {
      if (b % 2 === 1) hihat(t + b * (BEAT / 2), 0.05, 0.13);
    }
    for (let b = 0; b < 16; b++) {
      if (b % 4 === 2) hihat(t + b * (BEAT / 4), 0.02, 0.06);
    }

    // bass — two hits per bar for that Tron pulse
    bassNote(f(chord.bass), t, BEAT * 1.7);
    bassNote(f(chord.bass), t + BEAT * 2, BEAT * 1.7);

    // arpeggio — 8 notes per bar
    const step = BAR / chord.arp.length;
    for (let i = 0; i < chord.arp.length; i++) {
      arpNote(f(chord.arp[i]), t + i * step, step * 1.1);
    }

    // pad — hold the chord root an octave down
    pad(f(chord.bass) / 2, t, BAR);

    barIndex++;
  }

  function tick() {
    if (!started || !ctx) return;
    const now = ctx.currentTime;
    while (nextBarAt < now + 0.6) {
      scheduleBar(nextBarAt);
      nextBarAt += BAR;
    }
  }

  function start() {
    ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) {
      started = true;
      barIndex = 0;
      nextBarAt = ctx.currentTime + 0.1;
      tick();
      loopTimer = setInterval(tick, 120);
    }
    // fade in master
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, ctx.currentTime + 0.6);
  }

  function setMuted(m) {
    muted = m;
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, ctx.currentTime + 0.25);
  }

  function isMuted() { return muted; }

  // ——— SFX ———

  function sfxJump() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(920, t + 0.12);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.22);
  }

  function sfxNearMiss() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(2800, t + 0.08);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.16);
  }

  function sfxDash() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 5;
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(filter); filter.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.22);

    // sub-boom on dash start
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, t);
    sub.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    sg.gain.setValueAtTime(0.4, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    sub.connect(sg); sg.connect(sfxBus);
    sub.start(t); sub.stop(t + 0.25);
  }

  function sfxGravity() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 6;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(filter); filter.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.26);
  }

  function sfxRuleChange() {
    if (!ctx) return;
    const t = ctx.currentTime;
    // hyperspace whoosh
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.55);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.55);
    filter.Q.value = 10;
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(filter); filter.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.75);

    // stinger bell
    const bell = ctx.createOscillator();
    const bg = ctx.createGain();
    bell.type = 'sine'; bell.frequency.value = 1200;
    bg.gain.setValueAtTime(0.2, t + 0.45);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    bell.connect(bg); bg.connect(sfxBus);
    bell.start(t + 0.45); bell.stop(t + 1.05);
  }

  function sfxDeath() {
    if (!ctx) return;
    const t = ctx.currentTime;
    // glitch burst
    for (let i = 0; i < 4; i++) {
      const st = t + i * 0.07;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 420 - i * 90;
      g.gain.setValueAtTime(0.28, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
      osc.connect(g); g.connect(sfxBus);
      osc.start(st); osc.stop(st + 0.12);
    }
    // sub drop
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(180, t);
    sub.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    sg.gain.setValueAtTime(0.5, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    sub.connect(sg); sg.connect(sfxBus);
    sub.start(t); sub.stop(t + 0.75);
  }

  window.BrainLagAudio = {
    start, setMuted, isMuted,
    jump: sfxJump, gravityFlip: sfxGravity, dash: sfxDash,
    nearMiss: sfxNearMiss, ruleChange: sfxRuleChange, death: sfxDeath,
  };
})();
