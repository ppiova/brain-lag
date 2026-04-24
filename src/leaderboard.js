/* Brain Lag — Local Leaderboard + Friend Challenges
 * Client-only: name + history + top-10 in localStorage, invite via URL hash.
 * No backend, no auth. Ranking is per-device.
 */

(() => {
  'use strict';

  const NAME_KEY = 'brainlag_name';
  const HIST_KEY = 'brainlag_history';
  const HIST_MAX = 50;

  // ——— Player name ———

  function randomCallsign() {
    return 'PILOT-' + String(Math.floor(Math.random() * 9000) + 1000);
  }

  function getName() {
    let n = localStorage.getItem(NAME_KEY);
    if (!n) {
      n = randomCallsign();
      try { localStorage.setItem(NAME_KEY, n); } catch (e) {}
    }
    return n;
  }

  function setName(name) {
    const cleaned = (name || '').trim().slice(0, 16);
    if (!cleaned) return false;
    try { localStorage.setItem(NAME_KEY, cleaned); } catch (e) {}
    return true;
  }

  // ——— Run history ———

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveHistory(arr) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function recordRun(run) {
    if (!run || typeof run.time !== 'number' || run.time < 2) return;
    const history = loadHistory();
    history.push({
      name: getName(),
      time: Math.round(run.time * 10) / 10,
      combo: run.combo | 0,
      level: (run.level | 0) || 1,
      mode: run.mode || 'free',
      failureMode: run.failureMode || null,
      date: Date.now(),
    });
    // Cap history to prevent localStorage bloat; keep most recent.
    while (history.length > HIST_MAX) history.shift();
    saveHistory(history);
  }

  function getTop10() {
    const hist = loadHistory();
    return hist
      .slice()
      .sort((a, b) => b.time - a.time || b.combo - a.combo)
      .slice(0, 10);
  }

  function getHistory() { return loadHistory(); }

  function clearHistory() {
    try { localStorage.removeItem(HIST_KEY); } catch (e) {}
  }

  // ——— Friend challenges via URL hash ———

  function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    const pad = str.length % 4;
    const padded = str + (pad ? '='.repeat(4 - pad) : '');
    return decodeURIComponent(escape(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))));
  }

  function buildChallengeURL(run) {
    const payload = {
      n: (run && run.name) || getName(),
      t: (run && run.time) || 0,
      c: (run && run.combo) | 0,
      l: (run && run.level) || 1,
    };
    const token = b64urlEncode(JSON.stringify(payload));
    return location.origin + location.pathname + '#c=' + token;
  }

  function parseChallengeFromURL() {
    const hash = location.hash || '';
    const m = hash.match(/[#&]c=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
      const obj = JSON.parse(b64urlDecode(m[1]));
      if (typeof obj.t !== 'number' || obj.t <= 0) return null;
      return {
        name: String(obj.n || 'FRIEND').slice(0, 16),
        time: obj.t,
        combo: obj.c | 0,
        level: obj.l || 1,
      };
    } catch (e) { return null; }
  }

  function clearChallengeFromURL() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  // ——— Time formatting ———

  function formatTimeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 45) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 30) return d + 'd ago';
    const mo = Math.floor(d / 30);
    return mo + 'mo ago';
  }

  window.BrainLagLeaderboard = {
    getName, setName, randomCallsign,
    recordRun, getTop10, getHistory, clearHistory,
    buildChallengeURL, parseChallengeFromURL, clearChallengeFromURL,
    formatTimeAgo,
  };
})();
