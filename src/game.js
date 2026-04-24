/* Brain Lag — Hyperdrive Protocol
 * Week 1 MVP with space-opera reskin.
 * Vanilla JS, HTML5 Canvas, zero dependencies.
 * Core question this build answers: is the rule-swap mechanic fun or just confusing?
 */

(() => {
  'use strict';

  const W = 800;
  const H = 450;
  const FLOOR_Y = H - 60;
  const CEILING_Y = 60;

  const PLAYER_SIZE = 22;
  const PLAYER_X = 140;
  const BASE_SPEED = 260;
  const JUMP_VELOCITY = 520;
  const GRAVITY_ACC = 1600;

  const RULE_CHANGE_EVERY = 8;
  const SIGNAL_DURATION = 0.6;
  const SLOW_MO_FACTOR = 0.3;
  const ADAPT_WINDOW = { JUMP: 0.5, GRAVITY: 1.2 };

  const TRAIL_LENGTH = 10;
  const STAR_COUNT = 110;
  const STAR_SPEEDS = [70, 28, 8];

  const COLORS = {
    bg: '#01020a',
    rail: '#1a2448',
    railGlow: '#3ec3ff',
    star: '#eef0ff',
    planet: '#2a1754',
    planetRing: '#6a3ab8',
    planetShadow: '#090418',
    player: '#eef0ff',
    laser: '#ff2d5c',
    JUMP: '#3ec3ff',
    GRAVITY: '#b26bff',
  };

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const ruleLabel = document.getElementById('rule-label');
  const timeLabel = document.getElementById('time');
  const startOverlay = document.getElementById('overlay');
  const deathOverlay = document.getElementById('death');
  const deathScore = document.getElementById('death-score');
  const deathBest = document.getElementById('death-best');
  const deathTitle = document.getElementById('death-title');

  const state = {
    phase: 'start',
    time: 0,
    speed: BASE_SPEED,
    player: null,
    obstacles: [],
    currentRule: 'JUMP',
    nextRuleAt: RULE_CHANGE_EVERY,
    signalTimer: 0,
    flashTimer: 0,
    adaptTimer: 0,
    spawnCooldown: 0,
    best: Number(localStorage.getItem('brainlag_best') || 0),
    lastT: 0,
    stars: [],
    globalT: 0,
  };

  function initStars() {
    state.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      state.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 1.2 + 0.3,
        depth: Math.floor(Math.random() * 3),
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  function resetRun() {
    state.phase = 'playing';
    state.time = 0;
    state.speed = BASE_SPEED;
    state.player = {
      x: PLAYER_X,
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      onSurface: true,
      gravityDir: 1,
      trail: [],
    };
    state.obstacles = [];
    state.currentRule = 'JUMP';
    state.nextRuleAt = RULE_CHANGE_EVERY;
    state.signalTimer = 0;
    state.flashTimer = 0;
    state.adaptTimer = 0;
    state.spawnCooldown = 1.2;
    updateRuleUI();
    startOverlay.classList.remove('visible');
    deathOverlay.classList.remove('visible');
  }

  function updateRuleUI() {
    ruleLabel.textContent = state.currentRule;
    ruleLabel.className = state.currentRule.toLowerCase();
  }

  function pickNextRule() {
    return state.currentRule === 'JUMP' ? 'GRAVITY' : 'JUMP';
  }

  function triggerRuleChange() {
    const next = pickNextRule();
    state.currentRule = next;
    state.signalTimer = SIGNAL_DURATION;
    state.flashTimer = SIGNAL_DURATION;
    state.adaptTimer = ADAPT_WINDOW[next] || 1;
    state.nextRuleAt = state.time + RULE_CHANGE_EVERY;
    updateRuleUI();
    if (window.BrainLagAudio) BrainLagAudio.ruleChange();
    if (next === 'GRAVITY') {
      state.player.gravityDir = 1;
    } else {
      if (state.player.gravityDir === -1) {
        state.player.gravityDir = 1;
        state.player.onSurface = false;
        state.player.vy = 0;
      }
    }
  }

  function onInput() {
    if (window.BrainLagAudio) BrainLagAudio.start();
    if (state.phase === 'start' || state.phase === 'dead') {
      resetRun();
      return;
    }
    const p = state.player;
    if (state.currentRule === 'JUMP') {
      if (p.onSurface) {
        p.vy = -JUMP_VELOCITY;
        p.onSurface = false;
        if (window.BrainLagAudio) BrainLagAudio.jump();
      }
    } else if (state.currentRule === 'GRAVITY') {
      p.gravityDir *= -1;
      p.onSurface = false;
      if (window.BrainLagAudio) BrainLagAudio.gravityFlip();
    }
  }

  function spawnObstacle() {
    const difficulty = Math.min(state.time / 60, 1);
    const gapBase = 1.4 - difficulty * 0.5;
    state.spawnCooldown = gapBase + Math.random() * 0.4;

    const rule = state.currentRule;
    const height = 36 + Math.random() * 18;
    const width = 24 + Math.random() * 14;

    if (rule === 'JUMP') {
      state.obstacles.push({
        x: W + width,
        y: FLOOR_Y - height,
        w: width,
        h: height,
        onCeiling: false,
      });
    } else {
      const onCeiling = Math.random() < 0.5;
      state.obstacles.push({
        x: W + width,
        y: onCeiling ? CEILING_Y : FLOOR_Y - height,
        w: width,
        h: height,
        onCeiling,
      });
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function die() {
    state.phase = 'dead';
    if (state.time > state.best) {
      state.best = state.time;
      localStorage.setItem('brainlag_best', String(state.best));
    }
    deathScore.textContent = state.time.toFixed(1) + 's';
    deathBest.textContent = 'Best · ' + state.best.toFixed(1) + 's';
    deathTitle.textContent = state.signalTimer > 0 ? 'Brain Lagged.' : 'Ship Lost.';
    deathOverlay.classList.add('visible');
    if (window.BrainLagAudio) BrainLagAudio.death();
  }

  function updateStars(dt) {
    for (const s of state.stars) {
      s.x -= STAR_SPEEDS[s.depth] * dt;
      s.twinkle += dt * (1 + s.depth * 0.3);
      if (s.x < -2) {
        s.x = W + 2;
        s.y = Math.random() * H;
      }
    }
  }

  function update(dt) {
    state.globalT += dt;
    updateStars(dt);

    if (state.phase !== 'playing') return;

    const slow = state.signalTimer > 0 ? SLOW_MO_FACTOR : 1;
    const edt = dt * slow;

    state.time += edt;
    if (state.signalTimer > 0) state.signalTimer = Math.max(0, state.signalTimer - dt);
    if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt);
    if (state.adaptTimer > 0) state.adaptTimer = Math.max(0, state.adaptTimer - edt);

    if (state.time >= state.nextRuleAt && state.signalTimer === 0) {
      triggerRuleChange();
    }

    const p = state.player;
    p.vy += GRAVITY_ACC * p.gravityDir * edt;
    p.y += p.vy * edt;

    const floorTop = FLOOR_Y - PLAYER_SIZE;
    const ceilTop = CEILING_Y;
    if (p.gravityDir === 1 && p.y >= floorTop) {
      p.y = floorTop; p.vy = 0; p.onSurface = true;
    } else if (p.gravityDir === -1 && p.y <= ceilTop) {
      p.y = ceilTop; p.vy = 0; p.onSurface = true;
    }

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

    if (state.adaptTimer === 0) {
      state.spawnCooldown -= edt;
      if (state.spawnCooldown <= 0) spawnObstacle();
    }

    const speed = state.speed + Math.min(state.time * 4, 120);
    for (const o of state.obstacles) o.x -= speed * edt;
    state.obstacles = state.obstacles.filter(o => o.x + o.w > -20);

    const pBox = { x: p.x, y: p.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
    for (const o of state.obstacles) {
      if (rectsOverlap(pBox, o)) { die(); return; }
    }
  }

  function renderStarfield() {
    for (const s of state.stars) {
      const base = 1 - s.depth * 0.3;
      const tw = 0.6 + Math.sin(s.twinkle) * 0.4;
      const alpha = base * tw;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.star;
      ctx.fillRect(s.x | 0, s.y | 0, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function renderPlanet() {
    const cx = W * 0.82;
    const cy = H * 0.48;
    const r = 110;

    ctx.save();
    ctx.globalAlpha = 0.45;
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    grad.addColorStop(0, COLORS.planetRing);
    grad.addColorStop(0.6, COLORS.planet);
    grad.addColorStop(1, COLORS.planetShadow);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.planetRing;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.35, r * 0.18, -0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function renderRails() {
    const pulse = 0.6 + Math.sin(state.globalT * 2) * 0.15;
    ctx.save();
    ctx.shadowColor = COLORS.railGlow;
    ctx.shadowBlur = 10 * pulse;
    ctx.strokeStyle = COLORS.rail;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.moveTo(0, CEILING_Y);
    ctx.lineTo(W, CEILING_Y);
    ctx.stroke();

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = COLORS.railGlow;
    for (let x = (state.globalT * 40) % 40; x < W; x += 40) {
      ctx.fillRect(x, FLOOR_Y + 2, 20, 1);
      ctx.fillRect(x, CEILING_Y - 3, 20, 1);
    }
    ctx.restore();
  }

  function renderLaserGates() {
    for (const o of state.obstacles) {
      const pulse = 0.55 + Math.sin(state.globalT * 9 + o.x * 0.02) * 0.25;
      ctx.save();
      ctx.shadowColor = COLORS.laser;
      ctx.shadowBlur = 22;
      ctx.fillStyle = `rgba(255, 45, 92, ${pulse * 0.35})`;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.strokeStyle = COLORS.laser;
      ctx.lineWidth = 2;
      ctx.globalAlpha = pulse;
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);

      ctx.fillStyle = '#ffd6dd';
      ctx.globalAlpha = pulse;
      const beamW = 2;
      ctx.fillRect(o.x + o.w / 2 - beamW / 2, o.y + 2, beamW, o.h - 4);
      ctx.restore();
    }
  }

  function renderPlayer() {
    if (!state.player) return;
    const p = state.player;
    const ruleColor = COLORS[state.currentRule] || COLORS.player;

    for (let i = 0; i < p.trail.length - 1; i++) {
      const g = p.trail[i];
      const age = (i + 1) / p.trail.length;
      const offset = -(p.trail.length - i - 1) * 3.5;
      ctx.globalAlpha = age * 0.35;
      ctx.fillStyle = ruleColor;
      ctx.fillRect(g.x + offset, g.y + (PLAYER_SIZE - PLAYER_SIZE * age) / 2,
                   PLAYER_SIZE * age, PLAYER_SIZE * age);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.shadowColor = ruleColor;
    ctx.shadowBlur = 24;
    ctx.fillStyle = ruleColor;
    ctx.fillRect(p.x, p.y, PLAYER_SIZE, PLAYER_SIZE);
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x + 5, p.y + 5, PLAYER_SIZE - 10, PLAYER_SIZE - 10);
    ctx.restore();
  }

  function renderHyperspaceStreak() {
    if (state.flashTimer <= 0) return;
    const t = state.flashTimer / SIGNAL_DURATION;
    const ruleColor = COLORS[state.currentRule];

    ctx.save();
    ctx.translate(W / 2, H / 2);
    const streaks = 28;
    ctx.strokeStyle = ruleColor;
    ctx.shadowColor = ruleColor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < streaks; i++) {
      const angle = (i / streaks) * Math.PI * 2 + t * 0.6;
      const r1 = 40 + (1 - t) * 60;
      const len = 60 + t * 260;
      ctx.globalAlpha = t * 0.75;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
      ctx.lineTo(Math.cos(angle) * (r1 + len), Math.sin(angle) * (r1 + len));
      ctx.stroke();
    }
    ctx.restore();

    const alpha = t * 0.28;
    ctx.fillStyle = `${ruleColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
    ctx.fillRect(0, 0, W, H);

    const scale = 1 + t * 0.5;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = ruleColor;
    ctx.shadowColor = ruleColor;
    ctx.shadowBlur = 30;
    ctx.globalAlpha = t;
    ctx.font = '900 130px Orbitron, ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.currentRule === 'JUMP' ? '▲' : '⇅', 0, 0);
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    renderStarfield();
    renderPlanet();
    renderRails();
    renderLaserGates();
    renderPlayer();
    renderHyperspaceStreak();

    timeLabel.textContent = state.time.toFixed(1) + 's';
  }

  function frame(t) {
    if (!state.lastT) state.lastT = t;
    const dt = Math.min((t - state.lastT) / 1000, 0.05);
    state.lastT = t;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', e => { e.preventDefault(); onInput(); });
  startOverlay.addEventListener('pointerdown', e => { e.preventDefault(); onInput(); });
  deathOverlay.addEventListener('pointerdown', e => { e.preventDefault(); onInput(); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      onInput();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMute();
    }
  });

  const muteBtn = document.getElementById('mute');
  let isMuted = localStorage.getItem('brainlag_muted') === '1';
  function applyMute() {
    muteBtn.classList.toggle('muted', isMuted);
    if (window.BrainLagAudio) BrainLagAudio.setMuted(isMuted);
  }
  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('brainlag_muted', isMuted ? '1' : '0');
    applyMute();
  }
  muteBtn.addEventListener('pointerdown', e => {
    e.stopPropagation();
    e.preventDefault();
    if (window.BrainLagAudio) BrainLagAudio.start();
    toggleMute();
  });
  applyMute();

  initStars();
  deathBest.textContent = 'Best · ' + state.best.toFixed(1) + 's';

  requestAnimationFrame(frame);
})();
