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
  const TERMINAL_VELOCITY = 1100;
  const COYOTE_TIME = 0.08;
  const JUMP_BUFFER_TIME = 0.12;

  const SIGNAL_DURATION = 0.6;
  const SLOW_MO_FACTOR = 0.3;
  const ADAPT_WINDOW = { JUMP: 0.5, GRAVITY: 1.2, DASH: 1.0, BOUNCE: 0.8 };

  // Difficulty: smooth asymptote. 0 at t=0, ~0.63 at 45s, ~0.86 at 90s.
  function difficulty() { return 1 - Math.exp(-state.time / 45); }
  function ruleInterval() {
    if (state.time < 10) return 10;    // warmup — first rule lingers
    return 9 - difficulty() * 4;        // 9s → 5s
  }

  const DASH_DURATION = 0.28;
  const DASH_COOLDOWN = 0.45;

  const BOUNCE_VELOCITY_LOW = 460;
  const BOUNCE_VELOCITY_HIGH = 640;

  const NEAR_MISS_THRESHOLD = 14;

  const RULE_POOL = ['JUMP', 'GRAVITY', 'DASH', 'BOUNCE'];
  const RULE_ICONS = { JUMP: '\u25B2', GRAVITY: '\u21C5', DASH: '\u25B6', BOUNCE: '\u25CF' };

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
    DASH: '#ff8a3d',
    BOUNCE: '#3ff2a0',
  };

  // ——— Deterministic PRNG (mulberry32) ———
  // Gameplay-affecting randomness routes through rng() so we can seed runs.
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = Math.random;
  function setSeed(seed) { rng = mulberry32(seed); }
  function clearSeed() { rng = Math.random; }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const ruleLabel = document.getElementById('rule-label');
  const ruleIconEl = document.getElementById('rule-icon');
  const timeLabel = document.getElementById('time');
  const comboLabel = document.getElementById('combo');
  const startOverlay = document.getElementById('overlay');
  const deathOverlay = document.getElementById('death');
  const deathScore = document.getElementById('death-score');
  const deathBest = document.getElementById('death-best');
  const deathCombo = document.getElementById('death-combo');
  const deathTitle = document.getElementById('death-title');
  const deathCaption = document.getElementById('death-caption');
  const newRecordBadge = document.getElementById('new-record');
  const pauseOverlay = document.getElementById('pause');
  const settingsOverlay = document.getElementById('settings');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsClose = document.getElementById('settings-close');
  const musicVolInput = document.getElementById('music-vol');
  const sfxVolInput = document.getElementById('sfx-vol');
  const reduceMotionInput = document.getElementById('reduce-motion');
  const musicValLabel = document.getElementById('music-val');
  const sfxValLabel = document.getElementById('sfx-val');
  const statsLine = document.getElementById('stats-line');
  const btnDaily = document.getElementById('btn-daily');
  const dailyBadge = document.getElementById('daily-badge');
  const dailyMeta = document.getElementById('daily-meta');

  let reduceMotion = localStorage.getItem('brainlag_reduce_motion') === '1';

  // ——— Persistent stats ———
  const stats = { runs: 0, totalTime: 0, bestCombo: 0, fails: {} };
  function loadStats() {
    try {
      const raw = localStorage.getItem('brainlag_stats');
      if (raw) Object.assign(stats, JSON.parse(raw));
    } catch (e) { /* corrupted JSON — ignore */ }
  }
  function saveStats() {
    try { localStorage.setItem('brainlag_stats', JSON.stringify(stats)); } catch (e) {}
  }
  function formatDuration(seconds) {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  }
  function renderStatsLine() {
    if (!statsLine) return;
    if (stats.runs === 0) { statsLine.textContent = ''; return; }
    statsLine.textContent =
      stats.runs + ' run' + (stats.runs === 1 ? '' : 's') +
      ' \u00B7 ' + formatDuration(stats.totalTime) + ' in hyperspace' +
      ' \u00B7 best x' + stats.bestCombo;
  }
  loadStats();
  renderStatsLine();
  const firstHint = document.getElementById('first-hint');
  if (firstHint && stats.runs === 0) firstHint.classList.add('visible');

  // ——— Daily challenge ———
  function todaysKey() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function todaysSeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }
  const daily = { key: todaysKey(), bestTime: 0, bestCombo: 0, runs: 0 };
  function loadDaily() {
    try {
      const raw = localStorage.getItem('brainlag_daily');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.key === daily.key) Object.assign(daily, parsed);
      }
    } catch (e) { /* ignore */ }
  }
  function saveDaily() {
    try { localStorage.setItem('brainlag_daily', JSON.stringify(daily)); } catch (e) {}
  }
  function renderDailyMeta() {
    if (!dailyMeta) return;
    const hasScore = daily.bestTime > 0;
    dailyMeta.textContent = daily.key + ' \u00B7 ' +
      (hasScore
        ? 'today\u2019s best: ' + daily.bestTime.toFixed(1) + 's · x' + daily.bestCombo
        : 'today\u2019s best: —');
  }
  loadDaily();
  renderDailyMeta();

  function startNewRun() {
    if (state.isDaily) setSeed(todaysSeed());
    else clearSeed();
    resetRun();
  }
  function startFree() {
    state.isDaily = false;
    dailyBadge.classList.remove('visible');
    startNewRun();
  }
  function startDaily() {
    state.isDaily = true;
    dailyBadge.textContent = 'DAILY \u00B7 ' + daily.key;
    dailyBadge.classList.add('visible');
    startNewRun();
  }

  btnDaily.addEventListener('pointerdown', e => {
    e.stopPropagation();
    e.preventDefault();
    if (window.BrainLagAudio) BrainLagAudio.start();
    startDaily();
  });

  // ——— Share result ———
  const btnShare = document.getElementById('btn-share');
  const SHARE_URL = 'https://ppiova.github.io/brain-lag/';
  function buildShareText() {
    const time = state.time.toFixed(1);
    const combo = state.bestCombo;
    const mode = state.isDaily ? 'DAILY ' + daily.key : 'free play';
    const quip = deathTitle.textContent || '';
    return 'Brain Lag \u00B7 ' + mode + ' \u2014 ' +
      time + 's \u00B7 x' + combo + ' combo' +
      (quip ? ' \u00B7 ' + quip : '') +
      '\n' + SHARE_URL;
  }
  async function shareResult() {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Brain Lag', text, url: SHARE_URL });
        return;
      } catch (e) { /* user cancelled — fall through to clipboard */ }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        flashCopied();
        return;
      } catch (e) { /* fall through */ }
    }
    // Last-resort fallback: prompt for manual copy
    window.prompt('Copy your result:', text);
  }
  function flashCopied() {
    const original = btnShare.textContent;
    btnShare.textContent = 'COPIED';
    btnShare.classList.add('copied');
    setTimeout(() => {
      btnShare.textContent = original;
      btnShare.classList.remove('copied');
    }, 1400);
  }
  btnShare.addEventListener('pointerdown', e => {
    e.stopPropagation();
    e.preventDefault();
    shareResult();
  });

  const state = {
    phase: 'start',
    time: 0,
    speed: BASE_SPEED,
    player: null,
    obstacles: [],
    currentRule: 'JUMP',
    nextRuleAt: 0,
    signalTimer: 0,
    flashTimer: 0,
    adaptTimer: 0,
    spawnCooldown: 0,
    best: Number(localStorage.getItem('brainlag_best') || 0),
    lastT: 0,
    stars: [],
    globalT: 0,
    particles: [],
    floatTexts: [],
    shake: 0,
    deathFreezeTimer: 0,
    deathSequenceTimer: 0,
    deathFlash: 0,
    paused: false,
  };

  // ——— Particle system ———
  function spawnParticles(x, y, count, color, spread, life, gravity) {
    spread = spread || 220;
    life = life || 0.7;
    gravity = gravity != null ? gravity : 280;
    if (reduceMotion) count = Math.max(1, Math.floor(count * 0.3));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = spread * (0.2 + Math.random() * 0.8);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life, maxLife: life,
        size: 2 + Math.random() * 2.5,
        color,
        gravity,
      });
    }
  }

  function addShake(amount) {
    if (reduceMotion) return;
    state.shake = Math.max(state.shake, amount);
  }

  function spawnFloatText(x, y, text, color) {
    state.floatTexts.push({
      x, y, text, color,
      life: 0.9, maxLife: 0.9,
      vy: -55,
    });
  }

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
    stats.runs += 1;
    saveStats();
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
      coyoteTimer: 0,
      bufferedJump: 0,
      squashY: 1,
      visualRot: 0,
      rotTarget: 0,
      dashTimer: 0,
      dashCooldown: 0,
    };
    state.obstacles = [];
    state.currentRule = 'JUMP';
    state.nextRuleAt = ruleInterval();
    state.signalTimer = 0;
    state.flashTimer = 0;
    state.adaptTimer = 0;
    state.spawnCooldown = 1.2;
    state.combo = 0;
    state.bestCombo = 0;
    state.lastNearMissAt = -99;
    state.particles = [];
    state.floatTexts = [];
    state.deathFreezeTimer = 0;
    state.deathSequenceTimer = 0;
    state.deathFlash = 0;
    state.lastRuleChangeAt = 0;
    state.paused = false;
    pauseOverlay.classList.remove('visible');
    updateRuleUI();
    comboLabel.textContent = 'x0';
    comboLabel.classList.remove('fire', 'bump');
    startOverlay.classList.remove('visible');
    deathOverlay.classList.remove('visible');
  }

  function updateRuleUI() {
    const lc = state.currentRule.toLowerCase();
    ruleLabel.textContent = state.currentRule;
    ruleLabel.className = lc;
    if (ruleIconEl) {
      ruleIconEl.textContent = RULE_ICONS[state.currentRule] || '?';
      ruleIconEl.className = 'rule-icon ' + lc;
    }
  }

  function pickNextRule() {
    const others = RULE_POOL.filter(r => r !== state.currentRule);
    return others[Math.floor(rng() * others.length)];
  }

  function triggerRuleChange() {
    const next = pickNextRule();
    state.currentRule = next;
    state.signalTimer = SIGNAL_DURATION;
    state.flashTimer = SIGNAL_DURATION;
    state.adaptTimer = ADAPT_WINDOW[next] || 1;
    state.nextRuleAt = state.time + ruleInterval();
    state.lastRuleChangeAt = state.time;
    updateRuleUI();
    state.combo = 0;
    comboLabel.textContent = 'x0';
    comboLabel.classList.remove('fire', 'bump');
    addShake(7);
    spawnParticles(W / 2, H / 2, 32, COLORS[next], 320, 0.65, 0);
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
    // BOUNCE rule kickstart: if player is resting on a surface, pop them up
    if (next === 'BOUNCE' && state.player.onSurface) {
      doBounce(state.player, BOUNCE_VELOCITY_LOW, COLORS.BOUNCE);
    }
  }

  function doJump(p) {
    p.vy = -JUMP_VELOCITY;
    p.onSurface = false;
    p.bufferedJump = 0;
    p.coyoteTimer = 0;
    p.squashY = 1.4;
    if (window.BrainLagAudio) BrainLagAudio.jump();
  }

  function doDash(p) {
    if (p.dashCooldown > 0) return;
    p.dashTimer = DASH_DURATION;
    p.dashCooldown = DASH_COOLDOWN;
    p.squashY = 0.75;
    spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 14,
      COLORS.DASH, 180, 0.45, 0);
    addShake(4);
    if (window.BrainLagAudio) BrainLagAudio.dash();
  }

  function doBounce(p, velocity, color) {
    p.vy = -velocity * p.gravityDir;
    p.onSurface = false;
    p.squashY = 1.5;
    spawnParticles(p.x + PLAYER_SIZE / 2,
      p.gravityDir === 1 ? p.y + PLAYER_SIZE : p.y,
      velocity > BOUNCE_VELOCITY_LOW + 50 ? 12 : 5,
      color, 160, 0.35, 300 * p.gravityDir);
  }

  function onInput() {
    if (window.BrainLagAudio) BrainLagAudio.start();
    if (state.phase === 'start') {
      if (typeof startFree === 'function') startFree(); else resetRun();
      return;
    }
    if (state.phase === 'dead') {
      if (typeof startNewRun === 'function') startNewRun(); else resetRun();
      return;
    }
    // Allow skipping the death cinematic — but not the 120ms freeze-frame.
    if (state.phase === 'dying' && state.deathFreezeTimer <= 0) {
      if (typeof startNewRun === 'function') startNewRun(); else resetRun();
      return;
    }
    if (state.phase === 'dying') return;
    const p = state.player;
    if (state.currentRule === 'JUMP') {
      if (p.onSurface || p.coyoteTimer > 0) {
        doJump(p);
      } else {
        p.bufferedJump = JUMP_BUFFER_TIME;
      }
    } else if (state.currentRule === 'GRAVITY') {
      p.gravityDir *= -1;
      p.onSurface = false;
      p.rotTarget += Math.PI;
      p.squashY = 1.3;
      spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 8,
        COLORS.GRAVITY, 160, 0.35, 0);
      if (window.BrainLagAudio) BrainLagAudio.gravityFlip();
    } else if (state.currentRule === 'DASH') {
      doDash(p);
    } else if (state.currentRule === 'BOUNCE') {
      if (p.onSurface) {
        doBounce(p, BOUNCE_VELOCITY_HIGH, COLORS.BOUNCE);
        if (window.BrainLagAudio) BrainLagAudio.jump();
      } else {
        p.bufferedJump = JUMP_BUFFER_TIME;
      }
    }
  }

  function spawnObstacle() {
    const d = difficulty();
    const gapBase = 1.3 - d * 0.6;       // 1.3s → 0.7s between spawns
    const gapRand = 0.5 - d * 0.25;      // 0.5  → 0.25 jitter
    state.spawnCooldown = gapBase + rng() * gapRand;

    const rule = state.currentRule;
    const base = { minDist: Infinity, scored: false, kind: 'PILLAR' };
    const roll = rng();

    // DASH rule: wide walls that *require* dashing (too tall to jump)
    if (rule === 'DASH' && roll < 0.55) {
      const h = 150 + rng() * 30;
      state.obstacles.push({
        ...base, kind: 'WIDE_WALL',
        x: W + 60, y: FLOOR_Y - h,
        w: 54 + rng() * 14, h, onCeiling: false,
      });
      return;
    }

    // BOUNCE rule: mix of short (auto-clear) and tall (require tap-boosted bounce)
    if (rule === 'BOUNCE') {
      const tall = rng() < 0.45;
      const h = tall ? 70 + rng() * 25 : 22 + rng() * 18;
      const w = 26 + rng() * 10;
      state.obstacles.push({
        ...base, kind: 'PILLAR',
        x: W + w, y: FLOOR_Y - h, w, h, onCeiling: false,
      });
      return;
    }

    // Moving laser — thin beam patrolling a vertical lane
    if (roll < 0.18 && rule !== 'DASH' && rule !== 'BOUNCE') {
      const h = 10;
      const w = 12 + rng() * 6;
      state.obstacles.push({
        ...base, kind: 'MOVING_LASER',
        x: W + w, y: CEILING_Y + 40 + rng() * 80,
        w, h, onCeiling: false,
        moveVy: (rng() < 0.5 ? -1 : 1) * (70 + rng() * 50),
        laneMin: CEILING_Y + 20,
        laneMax: FLOOR_Y - 40,
      });
      return;
    }

    const height = 36 + rng() * 18;
    const width = 24 + rng() * 14;

    if (rule === 'JUMP' || rule === 'DASH') {
      state.obstacles.push({
        ...base,
        x: W + width,
        y: FLOOR_Y - height,
        w: width, h: height,
        onCeiling: false,
      });
    } else {
      const onCeiling = rng() < 0.5;
      state.obstacles.push({
        ...base,
        x: W + width,
        y: onCeiling ? CEILING_Y : FLOOR_Y - height,
        w: width, h: height,
        onCeiling,
      });
    }
  }

  function pickFailureMode() {
    // Ordered by specificity — first match wins.
    if (state.time < 2) {
      return { title: 'Tunnel Vision.', caption: "Your first two seconds? Gone." };
    }
    if (state.signalTimer > 0) {
      return { title: 'Brain Lag.', caption: "Still running the old protocol." };
    }
    if (state.time - state.lastRuleChangeAt < 1.5) {
      return { title: 'Muscle Memory.', caption: "Old reflex. New rule." };
    }
    if (state.combo >= 5) {
      return { title: 'Greedy.', caption: 'Died chasing a x' + state.combo + ' combo.' };
    }
    if (state.player && state.player.dashCooldown > 0 && state.currentRule === 'DASH') {
      return { title: 'Impatient.', caption: 'Dash wasn\u2019t ready.' };
    }
    return { title: 'Ship Lost.', caption: "Reflexes fell out of hyperspace." };
  }

  function verticalGap(p, o) {
    if (p.y + PLAYER_SIZE < o.y) return o.y - (p.y + PLAYER_SIZE);
    if (p.y > o.y + o.h) return p.y - (o.y + o.h);
    return 0;
  }

  function triggerNearMiss(p, o) {
    state.combo = (state.combo || 0) + 1;
    state.bestCombo = Math.max(state.bestCombo || 0, state.combo);
    state.lastNearMissAt = state.time;
    const px = o.x;
    const py = o.y + o.h / 2;
    const comboColor = state.combo >= 10 ? COLORS.laser :
                       state.combo >= 5  ? COLORS.DASH  : '#ffffff';
    spawnParticles(px, py, 10, comboColor, 120, 0.35, 0);
    spawnFloatText(p.x + PLAYER_SIZE / 2, p.y - 8, '+' + state.combo, comboColor);
    addShake(2);
    comboLabel.textContent = 'x' + state.combo;
    comboLabel.classList.toggle('fire', state.combo >= 10);
    comboLabel.classList.add('bump');
    setTimeout(() => comboLabel.classList.remove('bump'), 160);
    if (window.BrainLagAudio) BrainLagAudio.nearMiss();
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function die() {
    state.phase = 'dying';
    state.deathFreezeTimer = 0.12;
    state.deathSequenceTimer = 0.9;
    state.deathFlash = 1;
    const oldBest = state.best;
    const isNewRecord = state.time > oldBest && state.time >= 5;
    if (state.time > state.best) {
      state.best = state.time;
      localStorage.setItem('brainlag_best', String(state.best));
    }
    const p = state.player;
    // bigger, longer-lived explosion
    spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 64,
      COLORS[state.currentRule], 420, 1.1, 380);
    spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 36,
      COLORS.laser, 300, 0.9, 380);
    spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 18,
      '#ffffff', 500, 0.6, 260);
    addShake(28);
    const failure = pickFailureMode();
    stats.totalTime += state.time;
    if (state.bestCombo > stats.bestCombo) stats.bestCombo = state.bestCombo;
    stats.fails[failure.title] = (stats.fails[failure.title] || 0) + 1;
    saveStats();

    if (state.isDaily && typeof daily !== 'undefined') {
      daily.runs += 1;
      if (state.time > daily.bestTime) daily.bestTime = state.time;
      if (state.bestCombo > daily.bestCombo) daily.bestCombo = state.bestCombo;
      saveDaily();
      if (typeof renderDailyMeta === 'function') renderDailyMeta();
    }
    deathScore.textContent = state.time.toFixed(1) + 's';
    deathCombo.textContent = 'Best combo · x' + state.bestCombo;
    deathBest.textContent = 'Best · ' + state.best.toFixed(1) + 's';
    deathTitle.textContent = failure.title;
    deathCaption.textContent = failure.caption;

    if (isNewRecord) {
      newRecordBadge.classList.add('visible');
      // Gold confetti pouring upward
      spawnParticles(W / 2, H * 0.6, 40, '#ffd166', 450, 1.4, 180);
      spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 24,
        '#ffd166', 300, 1.0, 140);
      if (window.BrainLagAudio) BrainLagAudio.newRecord();
    } else {
      newRecordBadge.classList.remove('visible');
    }

    // overlay shows AFTER the cinematic
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

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
    if (state.particles.length > 0 && state.particles[0].life <= 0) {
      state.particles = state.particles.filter(p => p.life > 0);
    } else if (state.particles.length > 400) {
      state.particles = state.particles.filter(p => p.life > 0);
    }

    for (const ft of state.floatTexts) {
      ft.y += ft.vy * dt;
      ft.vy += 40 * dt;
      ft.life -= dt;
    }
    state.floatTexts = state.floatTexts.filter(ft => ft.life > 0);

    if (state.shake > 0.01) {
      state.shake *= Math.pow(0.004, dt);
    } else {
      state.shake = 0;
    }
  }

  function setPaused(p) {
    if (state.phase !== 'playing' && !state.paused) return;
    if (state.paused === p) return;
    state.paused = p;
    pauseOverlay.classList.toggle('visible', p);
    if (window.BrainLagAudio) {
      if (p) BrainLagAudio.suspend();
      else   BrainLagAudio.resume();
    }
  }
  function togglePause() { setPaused(!state.paused); }

  function update(dt) {
    if (state.paused) return;

    // Complete freeze-frame on impact — 120ms of absolute stillness.
    if (state.deathFreezeTimer > 0) {
      state.deathFreezeTimer = Math.max(0, state.deathFreezeTimer - dt);
      return;
    }

    state.globalT += dt;
    updateStars(dt);
    updateParticles(dt);

    // Cinematic death sequence — explosion plays out, overlay waits.
    if (state.phase === 'dying') {
      state.deathSequenceTimer = Math.max(0, state.deathSequenceTimer - dt);
      if (state.deathFlash > 0) state.deathFlash = Math.max(0, state.deathFlash - dt * 2);
      if (state.deathSequenceTimer === 0) {
        state.phase = 'dead';
        deathOverlay.classList.add('visible');
      }
      return;
    }

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
    const wasOnSurface = p.onSurface;
    p.vy += GRAVITY_ACC * p.gravityDir * edt;
    if (p.vy > TERMINAL_VELOCITY) p.vy = TERMINAL_VELOCITY;
    if (p.vy < -TERMINAL_VELOCITY) p.vy = -TERMINAL_VELOCITY;
    p.y += p.vy * edt;

    const floorTop = FLOOR_Y - PLAYER_SIZE;
    const ceilTop = CEILING_Y;
    if (p.gravityDir === 1 && p.y >= floorTop) {
      p.y = floorTop; p.vy = 0; p.onSurface = true;
    } else if (p.gravityDir === -1 && p.y <= ceilTop) {
      p.y = ceilTop; p.vy = 0; p.onSurface = true;
    } else {
      p.onSurface = false;
    }

    // coyote time: if we just left the surface, keep a brief jump window
    if (wasOnSurface && !p.onSurface) p.coyoteTimer = COYOTE_TIME;
    if (!p.onSurface) p.coyoteTimer = Math.max(0, p.coyoteTimer - edt);

    // landing impact: squash + puff
    if (!wasOnSurface && p.onSurface) {
      p.squashY = 0.65;
      const footY = p.gravityDir === 1 ? p.y + PLAYER_SIZE : p.y;
      spawnParticles(p.x + PLAYER_SIZE / 2, footY, 5,
        COLORS[state.currentRule], 120, 0.35, 400 * p.gravityDir);

      // BOUNCE rule: auto-rebound on every landing (big if buffered, small otherwise)
      if (state.currentRule === 'BOUNCE') {
        if (p.bufferedJump > 0) {
          doBounce(p, BOUNCE_VELOCITY_HIGH, COLORS.BOUNCE);
          p.bufferedJump = 0;
          if (window.BrainLagAudio) BrainLagAudio.jump();
        } else {
          doBounce(p, BOUNCE_VELOCITY_LOW, COLORS.BOUNCE);
        }
      }
    }

    // JUMP rule: buffered jump fires on landing
    if (p.onSurface && p.bufferedJump > 0 && state.currentRule === 'JUMP') {
      doJump(p);
    }
    p.bufferedJump = Math.max(0, p.bufferedJump - edt);

    // squash/stretch — lerp back to 1 (auto-stretch while airborne too)
    let targetSquash = 1;
    if (!p.onSurface) {
      const v = Math.abs(p.vy);
      targetSquash = 1 + Math.min(0.25, v / 1600);
    }
    p.squashY += (targetSquash - p.squashY) * Math.min(1, 14 * dt);

    // rotation lerp
    p.visualRot += (p.rotTarget - p.visualRot) * Math.min(1, 16 * dt);

    // dash timers + afterimage trail
    p.dashTimer = Math.max(0, p.dashTimer - edt);
    p.dashCooldown = Math.max(0, p.dashCooldown - edt);
    if (p.dashTimer > 0 && Math.random() < 0.55) {
      spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 1,
        COLORS.DASH, 40, 0.3, 0);
    }

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

    if (state.adaptTimer === 0) {
      state.spawnCooldown -= edt;
      if (state.spawnCooldown <= 0) spawnObstacle();
    }

    const speed = state.speed + difficulty() * 200;     // 260 → 460 px/s
    for (const o of state.obstacles) {
      o.x -= speed * edt;
      if (o.kind === 'MOVING_LASER') {
        o.y += o.moveVy * edt;
        if (o.y < o.laneMin) { o.y = o.laneMin; o.moveVy *= -1; }
        else if (o.y + o.h > o.laneMax) { o.y = o.laneMax - o.h; o.moveVy *= -1; }
      }
    }
    state.obstacles = state.obstacles.filter(o => o.x + o.w > -20);

    // near-miss tracking: minimum vertical gap while horizontally overlapping
    const pRight = p.x + PLAYER_SIZE;
    for (const o of state.obstacles) {
      if (o.scored) continue;
      if (o.x <= pRight && o.x + o.w >= p.x) {
        const dy = verticalGap(p, o);
        if (dy < o.minDist) o.minDist = dy;
      }
      if (o.x + o.w < p.x) {
        o.scored = true;
        if (o.minDist > 0 && o.minDist < NEAR_MISS_THRESHOLD) {
          triggerNearMiss(p, o);
        }
      }
    }

    if (p.dashTimer <= 0) {
      const pBox = { x: p.x, y: p.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
      for (const o of state.obstacles) {
        if (rectsOverlap(pBox, o)) { die(); return; }
      }
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

      if (o.kind === 'WIDE_WALL') {
        // solid imperial-style wall
        ctx.shadowColor = COLORS.laser;
        ctx.shadowBlur = 26;
        ctx.fillStyle = `rgba(255, 45, 92, ${0.55 + pulse * 0.2})`;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = '#ffd6dd';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
        // warning stripes
        ctx.fillStyle = 'rgba(255, 214, 221, 0.5)';
        for (let yy = 8; yy < o.h - 8; yy += 16) {
          ctx.fillRect(o.x + 4, o.y + yy, o.w - 8, 3);
        }
      } else if (o.kind === 'MOVING_LASER') {
        // thin tracing beam
        ctx.shadowColor = COLORS.laser;
        ctx.shadowBlur = 30;
        const coreW = o.w;
        ctx.fillStyle = COLORS.laser;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(o.x, o.y, coreW, o.h);
        // long horizontal trail
        ctx.fillStyle = `rgba(255, 45, 92, 0.35)`;
        ctx.fillRect(o.x - 80, o.y + o.h / 2 - 1, 80, 2);
        ctx.fillRect(o.x + coreW, o.y + o.h / 2 - 1, W - o.x - coreW, 1);
        // bright core
        ctx.fillStyle = '#fff0f3';
        ctx.globalAlpha = pulse;
        ctx.fillRect(o.x + 1, o.y + 1, coreW - 2, o.h - 2);
      } else {
        ctx.shadowColor = COLORS.laser;
        ctx.shadowBlur = 22;
        ctx.fillStyle = `rgba(255, 45, 92, ${pulse * 0.35})`;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = COLORS.laser;
        ctx.lineWidth = 2;
        ctx.globalAlpha = pulse;
        ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
        ctx.fillStyle = '#ffd6dd';
        ctx.fillRect(o.x + o.w / 2 - 1, o.y + 2, 2, o.h - 4);
      }
      ctx.restore();
    }
  }

  function renderPlayer() {
    if (!state.player) return;
    if (state.phase === 'dying' || state.phase === 'dead') return;
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
    const cx = p.x + PLAYER_SIZE / 2;
    const cy = p.y + PLAYER_SIZE / 2;
    ctx.translate(cx, cy);
    ctx.rotate(p.visualRot);
    const sy = p.squashY;
    const sx = 1 / Math.sqrt(sy);
    ctx.scale(sx, sy);

    const glow = p.dashTimer > 0 ? 40 : 24;
    ctx.shadowColor = ruleColor;
    ctx.shadowBlur = glow;
    ctx.fillStyle = ruleColor;
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.shadowBlur = glow / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-PLAYER_SIZE / 2 + 5, -PLAYER_SIZE / 2 + 5, PLAYER_SIZE - 10, PLAYER_SIZE - 10);
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
    ctx.fillText(RULE_ICONS[state.currentRule] || '?', 0, 0);
    ctx.restore();
  }

  function renderParticles() {
    ctx.save();
    for (const p of state.particles) {
      const alpha = Math.min(1, (p.life / p.maxLife) * 1.4);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  function renderFloatTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 18px Orbitron, ui-monospace, monospace';
    for (const ft of state.floatTexts) {
      const alpha = Math.min(1, ft.life / ft.maxLife * 1.2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    renderStarfield();
    renderPlanet();

    // Shake only the gameplay layer; keep stars/planet stable (feels more space-y).
    const sx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const sy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.save();
    ctx.translate(sx, sy);
    renderRails();
    renderLaserGates();
    renderPlayer();
    renderParticles();
    renderFloatTexts();
    ctx.restore();

    renderHyperspaceStreak();

    if (state.deathFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.deathFlash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
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
  pauseOverlay.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    togglePause();
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      onInput();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMute();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      togglePause();
    }
  });

  // Auto-pause when the tab loses focus or visibility.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true);
  });
  window.addEventListener('blur', () => setPaused(true));

  // ——— Settings ———
  let wasPlayingBeforeSettings = false;
  function openSettings() {
    wasPlayingBeforeSettings = state.phase === 'playing' && !state.paused;
    if (wasPlayingBeforeSettings) setPaused(true);
    settingsOverlay.classList.add('visible');
  }
  function closeSettings() {
    settingsOverlay.classList.remove('visible');
    if (wasPlayingBeforeSettings) setPaused(false);
    wasPlayingBeforeSettings = false;
  }

  function loadSettings() {
    const mv = parseFloat(localStorage.getItem('brainlag_music_vol'));
    const sv = parseFloat(localStorage.getItem('brainlag_sfx_vol'));
    const music = isNaN(mv) ? 1 : Math.max(0, Math.min(1, mv));
    const sfx   = isNaN(sv) ? 1 : Math.max(0, Math.min(1, sv));
    musicVolInput.value = String(Math.round(music * 100));
    sfxVolInput.value   = String(Math.round(sfx * 100));
    musicValLabel.textContent = String(Math.round(music * 100));
    sfxValLabel.textContent   = String(Math.round(sfx * 100));
    reduceMotionInput.checked = reduceMotion;
    if (window.BrainLagAudio) {
      BrainLagAudio.setMusicVolume(music);
      BrainLagAudio.setSfxVolume(sfx);
    }
  }

  musicVolInput.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10) / 100;
    localStorage.setItem('brainlag_music_vol', String(v));
    musicValLabel.textContent = e.target.value;
    if (window.BrainLagAudio) BrainLagAudio.setMusicVolume(v);
  });
  sfxVolInput.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10) / 100;
    localStorage.setItem('brainlag_sfx_vol', String(v));
    sfxValLabel.textContent = e.target.value;
    if (window.BrainLagAudio) BrainLagAudio.setSfxVolume(v);
  });
  reduceMotionInput.addEventListener('change', e => {
    reduceMotion = e.target.checked;
    localStorage.setItem('brainlag_reduce_motion', reduceMotion ? '1' : '0');
  });
  settingsBtn.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    if (window.BrainLagAudio) BrainLagAudio.start();
    openSettings();
  });
  settingsClose.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault(); closeSettings();
  });
  settingsOverlay.addEventListener('pointerdown', e => {
    if (e.target === settingsOverlay) closeSettings();
  });
  // Prevent tap inside settings body from closing
  document.querySelector('.settings-body').addEventListener('pointerdown', e => e.stopPropagation());
  loadSettings();

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
