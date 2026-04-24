/* Brain Lag — Week 1 MVP
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

  const COLORS = {
    bg: '#0b0b12',
    floor: '#2a2a3a',
    player: '#e9e9f5',
    obstacle: '#ff4d6d',
    JUMP: '#4da3ff',
    GRAVITY: '#a56eff',
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
  };

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
    if (state.phase === 'start') {
      resetRun();
      return;
    }
    if (state.phase === 'dead') {
      resetRun();
      return;
    }
    const p = state.player;
    if (state.currentRule === 'JUMP') {
      if (p.onSurface) {
        p.vy = -JUMP_VELOCITY;
        p.onSurface = false;
      }
    } else if (state.currentRule === 'GRAVITY') {
      p.gravityDir *= -1;
      p.onSurface = false;
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
    deathBest.textContent = 'Best: ' + state.best.toFixed(1) + 's';
    deathTitle.textContent = state.signalTimer > 0 ? 'Brain lagged.' : 'You lagged.';
    deathOverlay.classList.add('visible');
  }

  function update(dt) {
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
      p.y = floorTop;
      p.vy = 0;
      p.onSurface = true;
    } else if (p.gravityDir === -1 && p.y <= ceilTop) {
      p.y = ceilTop;
      p.vy = 0;
      p.onSurface = true;
    }

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

  function render() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, FLOOR_Y, W, 4);
    ctx.fillRect(0, CEILING_Y - 4, W, 4);

    ctx.fillStyle = COLORS.obstacle;
    for (const o of state.obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);

    if (state.player) {
      const ruleColor = COLORS[state.currentRule] || COLORS.player;
      ctx.fillStyle = ruleColor;
      ctx.shadowColor = ruleColor;
      ctx.shadowBlur = 16;
      ctx.fillRect(state.player.x, state.player.y, PLAYER_SIZE, PLAYER_SIZE);
      ctx.shadowBlur = 0;
    }

    if (state.flashTimer > 0) {
      const alpha = (state.flashTimer / SIGNAL_DURATION) * 0.4;
      ctx.fillStyle = COLORS[state.currentRule] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fillRect(0, 0, W, H);

      const scale = 1 + (state.flashTimer / SIGNAL_DURATION) * 0.5;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.fillStyle = COLORS[state.currentRule];
      ctx.globalAlpha = state.flashTimer / SIGNAL_DURATION;
      ctx.font = 'bold 120px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.currentRule === 'JUMP' ? '▲' : '⇅', 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

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
    }
  });

  deathBest.textContent = 'Best: ' + state.best.toFixed(1) + 's';

  requestAnimationFrame(frame);
})();
