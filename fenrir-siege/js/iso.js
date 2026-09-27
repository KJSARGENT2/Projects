/* Fenrir Siege — isometric projection, camera, ground cache and sprite cache.
   World space = grid tiles (gx, gy). Iso space = pixels at zoom 1 (TW x TH diamonds).
   The camera maps iso space to the screen; all world drawing happens in iso space. */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U;
  const TW = 64, TH = 32, HW = TW / 2, HH = TH / 2;
  const I = FS.iso = { TW, TH, HW, HH, W: 400, H: 800, dpr: 1, cam: { x: 0, y: D.GRID * HH, z: 0.4 }, zMin: 0.2, zMax: 2 };

  I.rs = 1; // adaptive render scale (see main.js perf governor)
  I.setScale = function (rs) { rs = U.clamp(Math.round(rs * 100) / 100, 0.5, 1); if (rs === I.rs) return; I.rs = rs; I.resize(); };
  I.init = function (canvas) {
    I.canvas = canvas;
    I.ctx = canvas.getContext('2d');
    I.resize();
  };
  I.resize = function () {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.max(0.75, Math.min(2, window.devicePixelRatio || 1) * I.rs);
    I.W = W; I.H = H; I.dpr = dpr;
    I.canvas.width = Math.round(W * dpr); I.canvas.height = Math.round(H * dpr);
    I.canvas.style.width = W + 'px'; I.canvas.style.height = H + 'px';
    const G = D.GRID;
    I.zMin = Math.max(0.16, Math.min(W / (G * TW * 0.95), H / (G * TH * 1.05)));
    I.zMax = W < 700 ? 1.3 : 1.8;
    I.clamp();
  };
  I.defaultZoom = function () {
    const k = I.W < 700 ? 13 : 24;
    return U.clamp(Math.min(I.W / (k * TW), I.H / (k * TH * 0.95)), I.zMin, I.zMax);
  };

  // ---- projections ----
  I.toIso = (gx, gy) => ({ x: (gx - gy) * HW, y: (gx + gy) * HH });
  I.isoToGrid = (ix, iy) => ({ x: (ix / HW + iy / HH) / 2, y: (iy / HH - ix / HW) / 2 });
  I.screenToIso = (sx, sy) => ({ x: (sx - I.W / 2) / I.cam.z + I.cam.x, y: (sy - I.H / 2) / I.cam.z + I.cam.y });
  I.screenToGrid = (sx, sy) => { const p = I.screenToIso(sx, sy); return I.isoToGrid(p.x, p.y); };
  I.isoToScreen = (ix, iy) => ({ x: (ix - I.cam.x) * I.cam.z + I.W / 2, y: (iy - I.cam.y) * I.cam.z + I.H / 2 });
  I.gridToScreen = (gx, gy, z) => { const p = I.toIso(gx, gy); return I.isoToScreen(p.x, p.y - (z || 0)); };

  I.applyWorld = function (ctx, shakeX, shakeY) {
    const z = I.cam.z, d = I.dpr;
    ctx.setTransform(d * z, 0, 0, d * z, d * (I.W / 2 - I.cam.x * z + (shakeX || 0)), d * (I.H / 2 - I.cam.y * z + (shakeY || 0)));
  };
  I.applyScreen = function (ctx) { ctx.setTransform(I.dpr, 0, 0, I.dpr, 0, 0); };

  I.clamp = function () {
    const c = I.cam, G = D.GRID;
    c.z = U.clamp(c.z, I.zMin, I.zMax);
    const hwv = I.W / 2 / c.z, hhv = I.H / 2 / c.z;
    const minX = -G * HW - 2 * TW, maxX = G * HW + 2 * TW, minY = -2 * TH - 60, maxY = G * TH + 2 * TH;
    // keep the view inside the world bounds (or centred when the view is larger)
    c.x = (maxX - minX) <= hwv * 2 ? (minX + maxX) / 2 : U.clamp(c.x, minX + hwv, maxX - hwv);
    c.y = (maxY - minY) <= hhv * 2 ? (minY + maxY) / 2 : U.clamp(c.y, minY + hhv, maxY - hhv);
  };
  I.pan = function (dx, dy) { I.cam.x -= dx / I.cam.z; I.cam.y -= dy / I.cam.z; I.clamp(); };
  I.zoomAt = function (sx, sy, f) {
    const before = I.screenToIso(sx, sy);
    I.cam.z = U.clamp(I.cam.z * f, I.zMin, I.zMax);
    const after = I.screenToIso(sx, sy);
    I.cam.x += before.x - after.x; I.cam.y += before.y - after.y;
    I.clamp();
  };
  I.centerOn = function (gx, gy, z) {
    const p = I.toIso(gx, gy);
    I.cam.x = p.x; I.cam.y = p.y; if (z) I.cam.z = z;
    I.clamp();
  };
  // visible grid-rect (for culling), padded
  I.visible = function (ix, iy, pad) {
    const c = I.cam, hw = I.W / 2 / c.z + pad, hh = I.H / 2 / c.z + pad;
    return ix > c.x - hw && ix < c.x + hw && iy > c.y - hh && iy < c.y + hh;
  };

  // ---- sprite cache, resolution bucketed to the current zoom ----
  const BUCKETS = [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8];
  I.bucket = 1;
  I.sprites = new Map();
  I.updateBucket = function () {
    const want = I.cam.z * I.dpr;
    let b = BUCKETS[BUCKETS.length - 1];
    for (const v of BUCKETS) if (v >= want * 0.95) { b = v; break; }
    if (b !== I.bucket) { I.bucket = b; I.sprites.clear(); }
  };
  // Get/create a cached sprite. draw(g) paints in iso px with the anchor at (0,0).
  I.sprite = function (key, w, h, ax, ay, draw) {
    let s = I.sprites.get(key);
    if (s) return s;
    const k = I.bucket;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, ax * k, ay * k);
    g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g);
    s = { c, w, h, ax, ay };
    I.sprites.set(key, s);
    return s;
  };
  I.drawSprite = function (ctx, s, x, y, alpha) {
    if (alpha != null && alpha < 1) { const a = ctx.globalAlpha; ctx.globalAlpha = a * alpha; ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h); ctx.globalAlpha = a; }
    else ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
  };

  // ---- ground (cached once per theme) ----
  const BORDER = 5;
  I.ground = null;
  I.buildGround = function (theme) {
    const G = D.GRID, B = BORDER;
    const K = Math.min(1, Math.max(0.5, I.dpr * I.defaultZoom() * 1.6));
    const w = (G + 2 * B) * TW, h = (G + 2 * B) * TH + 80;
    const ox = w / 2, oy = B * TH + 40; // iso origin (grid 0,0 top corner) inside the canvas
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * K); c.height = Math.ceil(h * K);
    const g = c.getContext('2d');
    g.setTransform(K, 0, 0, K, ox * K, oy * K);
    const P = (x, y) => [(x - y) * HW, (x + y) * HH];
    const dia = (x, y, s) => { const a = P(x, y), b = P(x + s, y), cc = P(x + s, y + s), d = P(x, y + s); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath(); };
    const night = theme === 'enemy';
    // outer frozen forest floor
    for (let r = -B; r < G + B; r++) for (let q = -B; q < G + B; q++) {
      const inside = q >= 0 && r >= 0 && q < G && r < G;
      if (inside) continue;
      const n = U.hash(q + 99, r + 7);
      const edge = Math.max(-q, -r, q - G + 1, r - G + 1);
      const t = U.clamp(edge / B, 0, 1);
      g.fillStyle = U.mix(night ? '#c9d6e3' : '#d9e6ef', night ? '#6f8195' : '#7d93a6', t * 0.7 + n * 0.12);
      dia(q, r, 1); g.fill();
    }
    // playable grass
    for (let r = 0; r < G; r++) for (let q = 0; q < G; q++) {
      const n = U.hash(q, r), n2 = U.hash(q * 3 + 1, r * 5 + 2);
      const ed = Math.min(q, r, G - 1 - q, G - 1 - r);
      let col = (q + r) % 2 ? (night ? '#1e3a37' : '#21423d') : (night ? '#1b3533' : '#1e3d38');
      col = U.mix(col, night ? '#2a4a3c' : '#2c5244', n * 0.35);
      if (ed < 2) col = U.mix(col, '#cfdde6', (2 - ed) / 2 * 0.55 * (0.7 + n2 * 0.3));
      g.fillStyle = col; dia(q, r, 1); g.fill();
    }
    // faint tile grid
    g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= G; i++) { let a = P(i, 0), b = P(i, G); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); a = P(0, i); b = P(G, i); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
    // grass tufts, frost flowers, snow patches
    const rnd = U.rng(night ? 77 : 1234);
    for (let i = 0; i < 900; i++) {
      const x = rnd.range(0, G), y = rnd.range(0, G), [px, py] = P(x, y);
      const ed = Math.min(x, y, G - x, G - y);
      if (ed < 2.2) continue;
      const k = rnd();
      if (k < 0.62) { g.strokeStyle = rnd() < 0.5 ? '#2f5a48' : '#1a332e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px - 2, py); g.lineTo(px - 3, py - 4); g.moveTo(px, py); g.lineTo(px, py - 5); g.moveTo(px + 2, py); g.lineTo(px + 3, py - 4); g.stroke(); }
      else if (k < 0.72) { g.fillStyle = rnd() < 0.5 ? '#9af0ff88' : '#ffcf8a77'; g.beginPath(); g.arc(px, py, 1.4, 0, 6.283); g.fill(); }
      else if (k < 0.8) { g.fillStyle = 'rgba(225,238,245,0.18)'; g.beginPath(); g.ellipse(px, py, rnd.range(6, 16), rnd.range(3, 7), 0, 0, 6.283); g.fill(); }
      else { g.fillStyle = 'rgba(8,20,18,0.25)'; g.beginPath(); g.ellipse(px, py, rnd.range(5, 12), rnd.range(2.5, 5), 0, 0, 6.283); g.fill(); }
    }
    // map edge line
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; dia(0, 0, G); g.stroke();
    // pine forest ring around the map (drawn back to front)
    const trees = [];
    for (let i = 0; i < 520; i++) {
      const q = rnd.range(-B + 0.3, G + B - 0.3), r = rnd.range(-B + 0.3, G + B - 0.3);
      const inside = q > -0.6 && r > -0.6 && q < G + 0.6 && r < G + 0.6;
      if (inside) continue;
      trees.push([q, r, rnd.range(0.7, 1.25), rnd()]);
    }
    trees.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [q, r, s, v] of trees) {
      const [px, py] = P(q, r);
      g.fillStyle = 'rgba(20,30,40,0.25)'; g.beginPath(); g.ellipse(px + 4, py + 2, 12 * s, 5 * s, 0, 0, 6.283); g.fill();
      g.fillStyle = '#3a2a22'; g.fillRect(px - 1.5 * s, py - 8 * s, 3 * s, 8 * s);
      const body = v < 0.5 ? '#16322e' : '#1b3a33';
      for (let k = 0; k < 3; k++) {
        const ty = py - 6 * s - k * 11 * s, tw = (15 - k * 4) * s;
        g.fillStyle = body; g.beginPath(); g.moveTo(px - tw, ty); g.lineTo(px, ty - 18 * s); g.lineTo(px + tw, ty); g.closePath(); g.fill();
        g.fillStyle = '#e8f1f6'; g.beginPath(); g.moveTo(px - tw * 0.55, ty - 7 * s); g.lineTo(px, ty - 18 * s); g.lineTo(px + tw * 0.35, ty - 9 * s); g.closePath(); g.fill();
      }
    }
    I.ground = { c, w, h, ox, oy, theme };
  };
  I.drawGround = function (ctx) {
    const gr = I.ground;
    ctx.drawImage(gr.c, -gr.ox, -gr.oy, gr.w, gr.h);
  };
})(window.FS = window.FS || {});
