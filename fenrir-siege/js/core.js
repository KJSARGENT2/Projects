/* Fenrir Siege — shared helpers: math, formatting, storage, seeded RNG, audio. */
(function (FS) {
  'use strict';
  const U = FS.U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.now = () => Date.now();
  U.easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  // mulberry32 — deterministic PRNG for battles, replays and village generation
  U.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (a0, b0) => a0 + f() * (b0 - a0);
    f.int = (a0, b0) => Math.floor(a0 + f() * (b0 - a0 + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t0 = arr[i]; arr[i] = arr[j]; arr[j] = t0; } return arr; };
    return f;
  };
  U.seed = () => (Math.random() * 4294967295) >>> 0;
  U.hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  U.fmt = (n) => {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString('en-US');
  };
  U.fmtFull = (n) => Math.floor(n).toLocaleString('en-US');
  U.fmtTime = (sec) => {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + 'm' + (s ? ' ' + String(s).padStart(2, '0') + 's' : '');
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return h + 'h' + (mm ? ' ' + String(mm).padStart(2, '0') + 'm' : '');
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  };
  U.fmtClock = (sec) => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  U.ago = (ms) => { const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; return U.fmtTime(s) + ' ago'; };

  // colour helpers for procedural art
  U.hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  U.shade = (h, f) => {
    const [r, g, b] = U.hex(h);
    const m = (c) => U.clamp(Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f)), 0, 255);
    return '#' + [m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
  };
  U.mix = (h1, h2, t) => { const a = U.hex(h1), b = U.hex(h2); return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * t).toString(16).padStart(2, '0')).join(''); };
  U.rgba = (h, a) => { const [r, g, b] = U.hex(h); return `rgba(${r},${g},${b},${a})`; };

  // ---------- storage (every access guarded) ----------
  U.store = {
    get(k, d) { try { const v = localStorage.getItem('fenrir-siege-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fenrir-siege-' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem('fenrir-siege-' + k); } catch (e) { /* ignore */ } },
  };

  // ---------- audio (tiny synth, no files) ----------
  const A = FS.A = { on: U.store.get('sound', true), ctx: null, last: {} };
  A.ensure = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) { /* ignore */ } } return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { A.ctx = null; }
  };
  function tone(freq, dur, type, vol, slide, delay) {
    const c = A.ctx; if (!c || !A.on) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  A.sfx = function (name) {
    if (!A.ctx || !A.on) return;
    const now = performance.now();
    const gap = { hit: 70, shoot: 90, drop: 40, zap: 80, coin: 60, boom: 90 }[name] || 30;
    if (A.last[name] && now - A.last[name] < gap) return;
    A.last[name] = now;
    switch (name) {
      case 'drop': tone(520, 0.07, 'triangle', 0.05, 1.6); break;
      case 'hit': tone(140, 0.06, 'square', 0.022, 0.7); break;
      case 'shoot': tone(900, 0.05, 'triangle', 0.018, 0.6); break;
      case 'boom': tone(90, 0.35, 'sawtooth', 0.06, 0.4); break;
      case 'big': tone(70, 0.6, 'sawtooth', 0.09, 0.3); tone(180, 0.4, 'square', 0.04, 0.5); break;
      case 'star': tone(660, 0.12, 'sine', 0.08); tone(990, 0.2, 'sine', 0.08, 0, 0.11); break;
      case 'good': tone(600, 0.1, 'sine', 0.06, 1.5); break;
      case 'bad': tone(300, 0.18, 'square', 0.05, 0.6); break;
      case 'zap': tone(1400, 0.08, 'sawtooth', 0.03, 0.3); break;
      case 'tick': tone(760, 0.06, 'sine', 0.05); break;
      case 'tap': tone(420, 0.05, 'triangle', 0.04, 1.2); break;
      case 'coin': tone(1180, 0.07, 'triangle', 0.05, 1.3); tone(1560, 0.09, 'triangle', 0.04, 1.2, 0.05); break;
      case 'place': tone(220, 0.12, 'triangle', 0.08, 0.6); tone(330, 0.08, 'sine', 0.04, 1, 0.05); break;
      case 'build': tone(300, 0.06, 'square', 0.03, 1.1); tone(420, 0.06, 'square', 0.03, 1.1, 0.08); break;
      case 'done': tone(523, 0.1, 'sine', 0.07); tone(659, 0.1, 'sine', 0.07, 0, 0.09); tone(784, 0.18, 'sine', 0.07, 0, 0.18); break;
      case 'go': tone(1040, 0.2, 'sine', 0.08); break;
      case 'no': tone(200, 0.08, 'square', 0.03); break;
      case 'howl': tone(300, 0.7, 'sine', 0.06, 2.2); tone(290, 0.8, 'triangle', 0.03, 2.1, 0.05); break;
    }
  };
  A.toggle = function () { A.on = !A.on; U.store.set('sound', A.on); return A.on; };
})(window.FS = window.FS || {});
