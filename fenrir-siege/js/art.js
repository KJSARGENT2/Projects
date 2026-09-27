/* Fenrir Siege — all procedural art. Restyle here: palette at the top, one draw
   function per building / troop. Buildings are drawn once per (type, level) into
   cached sprites (see iso.js); turrets, fires and troops are drawn live. */
(function (FS) {
  'use strict';
  const U = FS.U, I = FS.iso;
  const HW = 32, HH = 16;
  const ART = FS.art = {};

  const PAL = ART.PAL = {
    timber: '#4a3427', timberD: '#2e2019', plank: '#5c4232',
    stone: '#5d6675', stoneD: '#3f4652', stoneL: '#8a93a2',
    earth: '#2b2a26', snow: '#e6eff5', snowS: '#b9c9d6',
    glow: '#ffb75a', glowCore: '#ffe3ae',
    neon: '#00d9ff', ice: '#9af0ff', deep: '#1f6bff', danger: '#ff3d71',
    gold: '#ffcf8a', goldD: '#c8913f', mead: '#e7a93b', rune: '#8a5cff', iron: '#8e9aab',
    roofs: ['#5b3c2b', '#3a4d63', '#20505a', '#3a2e66'],
  };
  const TEAM = {
    ally: { main: '#00d9ff', light: '#9af0ff', deep: '#1f6bff', cloth: '#12465e', fur: '#9fb9c8', metal: '#b9c6d3' },
    enemy: { main: '#ff3d71', light: '#ffb0c4', deep: '#a3123f', cloth: '#5e1228', fur: '#b99a93', metal: '#c9b8b8' },
  };
  ART.TEAM = TEAM;
  const tier = (lv) => (lv <= 2 ? 0 : lv <= 4 ? 1 : lv <= 6 ? 2 : 3);

  // ---------- 3D-ish primitives (tile units x/y, pixel z) ----------
  const P = (x, y, z) => [(x - y) * HW, (x + y) * HH - (z || 0)];
  ART.P = P;
  function path(g, pts) { g.beginPath(); for (let i = 0; i < pts.length; i++) { const q = P(pts[i][0], pts[i][1], pts[i][2]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); } g.closePath(); }
  function poly(g, pts, fill, stroke, lw) {
    path(g, pts);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
  }
  const EDGE = 'rgba(8,10,14,0.45)';
  function box(g, x0, y0, x1, y1, z0, z1, col, o) {
    o = o || {};
    const L = o.left || col, R = o.right || U.shade(col, -0.32), T = o.top || U.shade(col, 0.16);
    poly(g, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], L, EDGE, 0.8);
    poly(g, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], R, EDGE, 0.8);
    if (!o.noTop) poly(g, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], T, EDGE, 0.8);
  }
  function gable(g, x0, y0, x1, y1, z, rh, col, axis, wall, snow) {
    const ov = 0.14;
    if (axis === 'y') {
      const cx = (x0 + x1) / 2;
      poly(g, [[x0 - ov, y0 - ov, z], [x0 - ov, y1 + ov, z], [cx, y1 + ov, z + rh], [cx, y0 - ov, z + rh]], U.shade(col, 0.12), EDGE);
      poly(g, [[x1 + ov, y0 - ov, z], [x1 + ov, y1 + ov, z], [cx, y1 + ov, z + rh], [cx, y0 - ov, z + rh]], U.shade(col, -0.3), EDGE);
      poly(g, [[x0, y1, z], [x1, y1, z], [cx, y1, z + rh]], wall || PAL.timberD, EDGE);
      if (snow) {
        poly(g, [[cx - (cx - x0 + ov) * 0.3, y0 - ov, z + rh * 0.7], [cx, y0 - ov, z + rh], [cx, y1 + ov, z + rh], [cx - (cx - x0 + ov) * 0.3, y1 + ov, z + rh * 0.7]], PAL.snow);
        poly(g, [[cx + (x1 + ov - cx) * 0.25, y0 - ov, z + rh * 0.75], [cx, y0 - ov, z + rh], [cx, y1 + ov, z + rh], [cx + (x1 + ov - cx) * 0.25, y1 + ov, z + rh * 0.75]], PAL.snowS);
      }
    } else {
      const cy = (y0 + y1) / 2;
      poly(g, [[x0 - ov, y0 - ov, z], [x1 + ov, y0 - ov, z], [x1 + ov, cy, z + rh], [x0 - ov, cy, z + rh]], U.shade(col, -0.18), EDGE);
      poly(g, [[x1, y0, z], [x1, y1, z], [x1, cy, z + rh]], wall || U.shade(PAL.timberD, -0.2), EDGE);
      poly(g, [[x0 - ov, y1 + ov, z], [x1 + ov, y1 + ov, z], [x1 + ov, cy, z + rh], [x0 - ov, cy, z + rh]], U.shade(col, 0.08), EDGE);
      if (snow) {
        poly(g, [[x0 - ov, cy + (y1 + ov - cy) * 0.3, z + rh * 0.7], [x1 + ov, cy + (y1 + ov - cy) * 0.3, z + rh * 0.7], [x1 + ov, cy, z + rh], [x0 - ov, cy, z + rh]], PAL.snow);
      }
    }
  }
  function pyramid(g, x0, y0, x1, y1, z, rh, col, snow) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ov = 0.1;
    x0 -= ov; y0 -= ov; x1 += ov; y1 += ov;
    const A = [cx, cy, z + rh];
    poly(g, [[x0, y0, z], [x0, y1, z], A], U.shade(col, 0.05), EDGE);
    poly(g, [[x0, y0, z], [x1, y0, z], A], U.shade(col, -0.1), EDGE);
    poly(g, [[x0, y1, z], [x1, y1, z], A], U.shade(col, 0.12), EDGE);
    poly(g, [[x1, y0, z], [x1, y1, z], A], U.shade(col, -0.3), EDGE);
    if (snow) {
      const k = 0.35, lx = (x) => cx + (x - cx) * k, ly = (y) => cy + (y - cy) * k, zz = z + rh * (1 - k);
      poly(g, [[lx(x0), ly(y1), zz], [lx(x1), ly(y1), zz], A], PAL.snow);
      poly(g, [[lx(x1), ly(y0), zz], [lx(x1), ly(y1), zz], A], PAL.snowS);
    }
  }
  function cyl(g, x, y, r, z0, z1, col, top) {
    const [cx, cy0] = P(x, y, z0), cy1 = cy0 - (z1 - z0);
    const rx = r * HW * 1.414, ry = r * HH * 1.414;
    const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
    gr.addColorStop(0, U.shade(col, 0.08)); gr.addColorStop(0.45, col); gr.addColorStop(1, U.shade(col, -0.4));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx - rx, cy1); g.lineTo(cx - rx, cy0); g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true); g.lineTo(cx + rx, cy1); g.closePath(); g.fill();
    g.strokeStyle = EDGE; g.lineWidth = 0.8; g.stroke();
    if (top !== false) { g.fillStyle = top || U.shade(col, 0.18); g.beginPath(); g.ellipse(cx, cy1, rx, ry, 0, 0, 6.283); g.fill(); g.stroke(); }
    return { cx, cy: cy1, rx, ry };
  }
  function cone(g, x, y, r, z0, h, col, snow) {
    const [cx, cy0] = P(x, y, z0);
    const rx = r * HW * 1.414, ry = r * HH * 1.414;
    const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
    gr.addColorStop(0, U.shade(col, 0.12)); gr.addColorStop(0.5, col); gr.addColorStop(1, U.shade(col, -0.42));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx - rx, cy0); g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true); g.lineTo(cx, cy0 - h); g.closePath(); g.fill();
    g.strokeStyle = EDGE; g.lineWidth = 0.8; g.stroke();
    if (snow) { g.fillStyle = PAL.snow; g.beginPath(); g.moveTo(cx, cy0 - h); g.lineTo(cx - rx * 0.32, cy0 - h * 0.66); g.quadraticCurveTo(cx, cy0 - h * 0.6, cx + rx * 0.3, cy0 - h * 0.68); g.closePath(); g.fill(); }
  }
  // quad on the plane y = const (left-front facing)
  function onY(g, y, xa, xb, za, zb, col, glow) {
    if (glow) { g.save(); g.shadowColor = col; g.shadowBlur = 8; }
    poly(g, [[xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb]], col);
    if (glow) g.restore();
  }
  // quad on the plane x = const (right-front facing)
  function onX(g, x, ya, yb, za, zb, col, glow) {
    if (glow) { g.save(); g.shadowColor = col; g.shadowBlur = 8; }
    poly(g, [[x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]], col);
    if (glow) g.restore();
  }
  function planks(g, x0, x1, y1, y0, z0, z1, n) {
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 0.8;
    g.beginPath();
    for (let i = 1; i < n; i++) { const x = x0 + (x1 - x0) * i / n; const a = P(x, y1, z0), b = P(x, y1, z1); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    for (let i = 1; i < n; i++) { const y = y0 + (y1 - y0) * i / n; const a = P(x1, y, z0), b = P(x1, y, z1); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
  }
  function plate(g, h, col) {
    const k = h - 0.08;
    poly(g, [[-k, -k, 0], [k, -k, 0], [k, k, 0], [-k, k, 0]], 'rgba(0,0,0,0.28)');
    const j = h - 0.18;
    poly(g, [[-j, j, 0], [j, j, 0], [j, j, 3], [-j, j, 3]], U.shade(col, -0.2));
    poly(g, [[j, -j, 0], [j, j, 0], [j, j, 3], [j, -j, 3]], U.shade(col, -0.45));
    poly(g, [[-j, -j, 3], [j, -j, 3], [j, j, 3], [-j, j, 3]], col);
  }
  function shadowBlob(g, h) { const [x, y] = P(0.25, 0.25, 0); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, h * HW * 1.25, h * HH * 1.25, 0, 0, 6.283); g.fill(); }
  function banner(g, x, y, z, hgt, col, mark) {
    const [bx, by] = P(x, y, z);
    g.strokeStyle = '#2a1d16'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - hgt); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(bx, by - hgt); g.lineTo(bx + 16, by - hgt + 3); g.lineTo(bx + 13, by - hgt + 8); g.lineTo(bx + 16, by - hgt + 13); g.lineTo(bx, by - hgt + 12); g.closePath(); g.fill();
    if (mark) { g.save(); g.translate(bx + 7, by - hgt + 6.5); g.scale(0.16, 0.16); wolfMark(g, '#05080d', 3); g.restore(); }
  }
  // Fenrir wolf mark (same as the title SVG), centred at 0,0 in a 64 box
  function wolfMark(g, col, lw) {
    g.save(); g.translate(-32, -32);
    g.strokeStyle = col; g.lineWidth = lw || 3; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(12, 6); g.lineTo(25, 21); g.lineTo(39, 21); g.lineTo(52, 6); g.lineTo(54, 32); g.lineTo(42, 46); g.lineTo(32, 58); g.lineTo(22, 46); g.lineTo(10, 32); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(21, 32); g.lineTo(27, 35); g.moveTo(43, 32); g.lineTo(37, 35); g.moveTo(28, 48); g.lineTo(36, 48); g.stroke();
    g.restore();
  }
  ART.wolfMark = wolfMark;
  function runeLines(g, x, y, z, col) {
    const [cx, cy] = P(x, y, z);
    g.save(); g.strokeStyle = col; g.lineWidth = 1.4; g.shadowColor = col; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(cx - 3, cy + 5); g.lineTo(cx - 3, cy - 5); g.lineTo(cx + 3, cy - 1); g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy + 4); g.stroke();
    g.restore();
  }
  function door(g, y, x, z, w, h, glow) {
    onY(g, y, x - w / 2, x + w / 2, z, z + h, '#170f0b');
    if (glow) onY(g, y, x - w / 2 + 0.05, x + w / 2 - 0.05, z, z + h * 0.7, U.rgba(PAL.glow, 0.55), true);
  }
  function barrel(g, x, y, z, s, col) {
    const c = cyl(g, x, y, 0.16 * s, z, z + 9 * s, col || '#6a4a32', U.shade(col || '#6a4a32', 0.2));
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 1; g.beginPath(); g.ellipse(c.cx, c.cy + 3 * s, c.rx, c.ry, 0, 0, Math.PI); g.stroke();
  }
  function coinPile(g, x, y, z, s) {
    const [cx, cy] = P(x, y, z);
    g.fillStyle = PAL.goldD; g.beginPath(); g.ellipse(cx, cy, 12 * s, 6 * s, 0, 0, 6.283); g.fill();
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, rr = (i % 3) * 3.5 * s;
      g.fillStyle = i % 2 ? PAL.gold : '#ffe2b0';
      g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy - 3 * s - (2 - (i % 3)) * 2.5 * s + Math.sin(a) * rr * 0.4, 3.2 * s, 1.8 * s, 0, 0, 6.283); g.fill();
    }
  }
  function crystal(g, x, y, z, h, w, col) {
    const [cx, cy] = P(x, y, z);
    g.save(); g.shadowColor = col; g.shadowBlur = 10;
    g.fillStyle = U.shade(col, 0.25); g.beginPath(); g.moveTo(cx, cy - h); g.lineTo(cx - w, cy - h * 0.35); g.lineTo(cx, cy); g.closePath(); g.fill();
    g.fillStyle = U.shade(col, -0.25); g.beginPath(); g.moveTo(cx, cy - h); g.lineTo(cx + w, cy - h * 0.35); g.lineTo(cx, cy); g.closePath(); g.fill();
    g.restore();
  }
  function flame(g, cx, cy, s) {
    g.save(); g.shadowColor = PAL.glow; g.shadowBlur = 10;
    g.fillStyle = '#ff8a3a'; g.beginPath(); g.moveTo(cx - 5 * s, cy); g.quadraticCurveTo(cx, cy - 16 * s, cx + 5 * s, cy); g.closePath(); g.fill();
    g.fillStyle = PAL.glowCore; g.beginPath(); g.moveTo(cx - 2.5 * s, cy); g.quadraticCurveTo(cx, cy - 9 * s, cx + 2.5 * s, cy); g.closePath(); g.fill();
    g.restore();
  }

  // ---------- buildings ----------
  const B = {};
  B.hall = function (g, lv) {
    const t = tier(lv), roof = PAL.roofs[t];
    shadowBlob(g, 2); plate(g, 2, '#34363a');
    const baseH = 8 + t * 5;
    box(g, -1.75, -1.75, 1.75, 1.75, 3, baseH, PAL.stone);
    if (t >= 2) { // rear tower
      box(g, -1.6, -1.6, -0.7, -0.7, baseH, baseH + 58, PAL.stoneD);
      pyramid(g, -1.6, -1.6, -0.7, -0.7, baseH + 58, 26, roof, true);
      onY(g, -0.7, -1.3, -1.0, baseH + 38, baseH + 48, PAL.glow, true);
    }
    box(g, -1.5, -1.05, 1.5, 1.05, baseH, baseH + 30, PAL.timber);
    planks(g, -1.5, 1.5, 1.05, -1.05, baseH, baseH + 30, 9);
    gable(g, -1.5, -1.05, 1.5, 1.05, baseH + 30, 34, roof, 'x', PAL.timberD, true);
    // crossed gable horns
    const [hx, hy] = P(1.64, 0, baseH + 64);
    g.strokeStyle = PAL.timberD; g.lineWidth = 3;
    g.beginPath(); g.moveTo(hx - 8, hy - 10); g.quadraticCurveTo(hx, hy + 2, hx + 9, hy - 12); g.stroke();
    const [kx, ky] = P(-1.64, 0, baseH + 64);
    g.beginPath(); g.moveTo(kx - 9, ky - 12); g.quadraticCurveTo(kx, ky + 2, kx + 8, ky - 10); g.stroke();
    door(g, 1.05, 0, baseH, 0.7, 18, true);
    for (const x of [-1.05, 0.95]) onY(g, 1.05, x, x + 0.22, baseH + 14, baseH + 22, PAL.glow, true);
    for (const y of [-0.6, 0.4]) onX(g, 1.5, y, y + 0.22, baseH + 14, baseH + 22, PAL.glow, true);
    if (t >= 1) { // braziers
      for (const [x, y] of [[-1.7, 1.7], [1.7, 1.7]]) { const c = cyl(g, x, y, 0.12, baseH - 2, baseH + 6, PAL.iron); flame(g, c.cx, c.cy, 0.7); }
    }
    if (t >= 3) for (const x of [-1.1, -0.1, 0.9]) runeLines(g, x, 1.06, baseH + 5, PAL.neon);
    banner(g, 1.35, -1.35, baseH, 70 + t * 8, PAL.neon, true);
  };
  B.builder = function (g) {
    shadowBlob(g, 1); plate(g, 1, '#3a3530');
    box(g, -0.6, -0.6, 0.6, 0.6, 3, 20, PAL.timber);
    planks(g, -0.6, 0.6, 0.6, -0.6, 3, 20, 4);
    pyramid(g, -0.6, -0.6, 0.6, 0.6, 20, 20, '#5b3c2b', true);
    door(g, 0.6, 0, 3, 0.36, 11, true);
    // hammer sign
    const [x, y] = P(0.75, 0.2, 18);
    g.strokeStyle = '#2a1d16'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y - 7); g.stroke();
    g.fillStyle = PAL.iron; g.fillRect(x + 4, y - 11, 8, 5);
    g.fillStyle = PAL.neon; g.beginPath(); g.arc(x - 12, y + 2, 2, 0, 6.283); g.fill();
  };
  B.goldmint = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#3b3833');
    box(g, -1.3, -1.3, 0.3, 0.2, 3, 22 + t * 3, PAL.stone);
    gable(g, -1.3, -1.3, 0.3, 0.2, 22 + t * 3, 18, PAL.roofs[t], 'y', PAL.stoneD, true);
    door(g, 0.2, -0.5, 3, 0.45, 12, true);
    // press frame
    const z0 = 3;
    box(g, 0.55, -1.2, 0.72, -1.03, z0, 40, PAL.timberD);
    box(g, 0.55, -0.1, 0.72, 0.07, z0, 40, PAL.timberD);
    box(g, 0.5, -1.2, 0.77, 0.07, 40, 45, PAL.timber);
    const c = cyl(g, 0.64, -0.55, 0.28, 16, 26, PAL.iron);
    g.fillStyle = PAL.gold; g.beginPath(); g.ellipse(c.cx, c.cy, c.rx * 0.5, c.ry * 0.5, 0, 0, 6.283); g.fill();
    coinPile(g, 0.6, 0.85, 3, 1 + t * 0.12);
    if (t >= 2) coinPile(g, -0.7, 0.9, 3, 0.8);
  };
  B.meadbrew = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#3b3530');
    box(g, -1.3, -1.3, 0.1, 0.3, 3, 22, PAL.timber);
    planks(g, -1.3, 0.1, 0.3, -1.3, 3, 22, 6);
    gable(g, -1.3, -1.3, 0.1, 0.3, 22, 18, PAL.roofs[t], 'x', PAL.timberD, true);
    door(g, 0.3, -0.6, 3, 0.4, 12, true);
    const v = cyl(g, 0.6, -0.4, 0.55 + t * 0.03, 3, 30 + t * 3, '#6d4a2f');
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.5;
    for (const k of [0.3, 0.7]) { g.beginPath(); g.ellipse(v.cx, v.cy + (27 + t * 3) * k, v.rx, v.ry, 0, 0, Math.PI); g.stroke(); }
    g.save(); g.shadowColor = PAL.mead; g.shadowBlur = 8; g.fillStyle = PAL.mead; g.beginPath(); g.ellipse(v.cx, v.cy, v.rx * 0.82, v.ry * 0.82, 0, 0, 6.283); g.fill(); g.restore();
    g.fillStyle = '#ffe0a0'; g.beginPath(); g.ellipse(v.cx - 4, v.cy - 1, 3, 1.3, 0, 0, 6.283); g.fill();
    barrel(g, 0.9, 0.9, 3, 1); barrel(g, 0.35, 1.05, 3, 1);
  };
  B.rsdrill = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#302f36');
    cyl(g, 0, 0, 0.95, 3, 10, PAL.stoneD);
    const [cx, cy] = P(0, 0, 10);
    g.save(); g.shadowColor = PAL.rune; g.shadowBlur = 14; g.fillStyle = '#1a1030'; g.beginPath(); g.ellipse(cx, cy, 30, 15, 0, 0, 6.283); g.fill(); g.restore();
    crystal(g, -0.35, 0.1, 10, 26 + t * 4, 8, PAL.rune);
    crystal(g, 0.35, -0.2, 10, 20 + t * 3, 7, '#b29bff');
    // derrick
    g.strokeStyle = PAL.timberD; g.lineWidth = 3;
    const top = P(0, 0, 70 + t * 5);
    for (const [x, y] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) { const b = P(x, y, 8); g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(top[0], top[1]); g.stroke(); }
    g.fillStyle = PAL.iron; g.fillRect(top[0] - 5, top[1] - 4, 10, 6);
    g.strokeStyle = PAL.iron; g.lineWidth = 2; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(cx, cy - 6); g.stroke();
  };
  B.goldvault = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#35343a');
    box(g, -1.2, -1.2, 1.2, 1.2, 3, 22 + t * 3, PAL.stone);
    g.strokeStyle = '#2b2f36'; g.lineWidth = 2.2;
    for (const k of [0.33, 0.66]) {
      const z = 3 + (19 + t * 3) * k;
      const a = P(-1.2, 1.2, z), b = P(1.2, 1.2, z), c = P(1.2, -1.2, z);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
    }
    pyramid(g, -1.2, -1.2, 1.2, 1.2, 22 + t * 3, 14, PAL.roofs[t], true);
    door(g, 1.2, 0, 3, 0.6, 14, false);
    const [dx, dy] = P(0, 1.2, 10); g.fillStyle = PAL.gold; g.beginPath(); g.arc(dx, dy, 2.2, 0, 6.283); g.fill();
    // gold bars
    for (let i = 0; i < 3 + t; i++) { const x = 0.55 + (i % 2) * 0.35, y = -0.75 + Math.floor(i / 2) * 0.32; box(g, x, y + 1.35, x + 0.28, y + 1.5, 3, 7 + (i % 2) * 4, PAL.gold); }
  };
  B.meadcellar = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#2f3a2f');
    // earthen mound
    const [cx, cy] = P(-0.1, -0.1, 3);
    const gr = g.createRadialGradient(cx - 10, cy - 20, 4, cx, cy - 6, 50);
    gr.addColorStop(0, '#4b6b4a'); gr.addColorStop(1, '#1e2e22');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy - 4, 46, 30 + t * 2, 0, Math.PI, 0); g.ellipse(cx, cy - 4, 46, 16, 0, 0, Math.PI); g.fill();
    g.fillStyle = PAL.snow; g.beginPath(); g.ellipse(cx - 6, cy - 26 - t * 2, 20, 7, -0.1, 0, 6.283); g.fill();
    // stone door frame
    box(g, -0.4, 0.85, 0.5, 1.1, 3, 22, PAL.stone);
    door(g, 1.1, 0.05, 3, 0.55, 15, true);
    barrel(g, 1.05, 0.2, 3, 1.1, '#7a5233'); barrel(g, 1.1, -0.3, 3, 1.1, '#7a5233'); barrel(g, 1.05, 0.2, 13, 1.0, '#8a5d38');
    if (t >= 1) barrel(g, -0.9, 1.1, 3, 1.0);
  };
  B.rsvault = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1); plate(g, 1, '#2b2934');
    box(g, -0.75, -0.75, 0.75, 0.75, 3, 24, '#3a3548');
    box(g, -0.8, -0.8, 0.8, 0.8, 24, 30, '#2a2636');
    for (const x of [-0.3, 0.3]) runeLines(g, x, 0.76, 10, PAL.rune);
    runeLines(g, 0.76, 0, 10, PAL.rune);
    crystal(g, 0, 0, 30, 18 + t * 4, 6, PAL.rune);
  };
  B.barracks = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#38342f');
    box(g, -1.25, -1.0, 1.25, 1.0, 3, 24 + t * 3, PAL.timber);
    planks(g, -1.25, 1.25, 1.0, -1.0, 3, 24 + t * 3, 8);
    gable(g, -1.25, -1.0, 1.25, 1.0, 24 + t * 3, 24, PAL.roofs[t], 'x', PAL.timberD, true);
    door(g, 1.0, 0, 3, 0.55, 15, true);
    // shields on wall
    for (const [x, c] of [[-0.8, PAL.neon], [0.8, '#c3ccd8']]) {
      const [sx, sy] = P(x, 1.0, 14);
      g.fillStyle = c; g.beginPath(); g.ellipse(sx, sy, 5, 5.5, 0, 0, 6.283); g.fill();
      g.fillStyle = '#12161c'; g.beginPath(); g.arc(sx, sy, 1.8, 0, 6.283); g.fill();
    }
    // crossed axes on the gable
    const [ax, ay] = P(1.26, 0, 34 + t * 3);
    g.strokeStyle = PAL.iron; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ax - 6, ay + 6); g.lineTo(ax + 6, ay - 6); g.moveTo(ax - 6, ay - 6); g.lineTo(ax + 6, ay + 6); g.stroke();
    banner(g, -1.2, 1.2, 3, 44 + t * 6, PAL.neon, true);
  };
  B.camp = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.6);
    poly(g, [[-1.85, -1.85, 0], [1.85, -1.85, 0], [1.85, 1.85, 0], [-1.85, 1.85, 0]], 'rgba(40,36,30,0.55)');
    // stone ring
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * 6.283, x = Math.cos(a) * 1.55, y = Math.sin(a) * 1.55;
      const [sx, sy] = P(x, y, 0);
      g.fillStyle = i % 2 ? PAL.stone : PAL.stoneD; g.beginPath(); g.ellipse(sx, sy - 2, 5, 3.3, 0, 0, 6.283); g.fill();
    }
    // tents
    for (const [x, y] of [[-1.05, -0.95], [0.95, -1.05], [-1.1, 0.8]]) cone(g, x, y, 0.42, 0, 26 + t * 3, t >= 2 ? '#274f5c' : '#6b5745', true);
    // weapon rack
    box(g, 0.9, 0.7, 1.4, 0.8, 0, 12, PAL.timberD);
    // fire pit
    const [fx, fy] = P(0, 0, 0);
    g.fillStyle = '#1b1612'; g.beginPath(); g.ellipse(fx, fy, 13, 6.5, 0, 0, 6.283); g.fill();
    g.strokeStyle = PAL.stoneD; g.lineWidth = 3; g.stroke();
  };
  B.forge = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#34322f');
    box(g, -1.25, -1.25, 0.6, 0.6, 3, 26, PAL.stone);
    pyramid(g, -1.25, -1.25, 0.6, 0.6, 26, 16, PAL.roofs[t], true);
    box(g, -1.1, -1.1, -0.65, -0.65, 26, 58, PAL.stoneD);
    door(g, 0.6, -0.3, 3, 0.55, 14, false);
    onY(g, 0.6, -0.5, -0.1, 3, 13, U.rgba(PAL.rune, 0.8), true);
    // anvil
    box(g, 0.75, 0.55, 1.15, 0.8, 3, 9, '#2c3036');
    box(g, 0.65, 0.5, 1.25, 0.85, 9, 13, '#454c56');
    runeLines(g, 0.61, -0.9, 12, PAL.rune);
    if (t >= 2) runeLines(g, 0.61, 0.1, 18, PAL.neon);
  };
  B.seidr = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#2e3530');
    cyl(g, -0.2, -0.2, 0.95, 3, 24, '#5a4634', false);
    cone(g, -0.2, -0.2, 1.15, 24, 40 + t * 4, '#4b5a3c', true);
    const [dx, dy] = P(-0.2, 0.75, 3);
    g.fillStyle = '#140f0b'; g.beginPath(); g.ellipse(dx, dy - 7, 6, 8, 0, 0, 6.283); g.fill();
    // cauldron
    const c = cyl(g, 0.9, 0.9, 0.3, 3, 12, '#23272d');
    g.save(); g.shadowColor = PAL.ice; g.shadowBlur = 12; g.fillStyle = t >= 2 ? '#b29bff' : PAL.ice; g.beginPath(); g.ellipse(c.cx, c.cy, c.rx * 0.8, c.ry * 0.8, 0, 0, 6.283); g.fill(); g.restore();
    // staff with rune stone
    const [sx, sy] = P(1.1, -0.6, 3);
    g.strokeStyle = PAL.timberD; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 36); g.stroke();
    g.save(); g.shadowColor = PAL.neon; g.shadowBlur = 10; g.fillStyle = PAL.neon; g.beginPath(); g.arc(sx, sy - 38, 3, 0, 6.283); g.fill(); g.restore();
  };
  B.wolfden = function (g) {
    shadowBlob(g, 1.5);
    const rocks = [[-0.8, -0.8, 24, '#4a5260'], [0.4, -1.0, 18, '#565f6d'], [-1.0, 0.3, 16, '#4f5765'], [-0.2, -0.2, 34, '#5b6472'], [0.8, 0.2, 14, '#4a5260'], [0.3, 0.8, 10, '#565f6d']];
    for (const [x, y, h, c] of rocks) {
      const [rx, ry] = P(x, y, 0);
      g.fillStyle = c; g.beginPath(); g.moveTo(rx - 26, ry); g.lineTo(rx - 18, ry - h); g.lineTo(rx + 2, ry - h - 8); g.lineTo(rx + 22, ry - h * 0.6); g.lineTo(rx + 26, ry); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(rx + 2, ry - h - 8); g.lineTo(rx + 22, ry - h * 0.6); g.lineTo(rx + 26, ry); g.lineTo(rx + 4, ry); g.closePath(); g.fill();
      g.fillStyle = PAL.snow; g.beginPath(); g.moveTo(rx - 18, ry - h); g.lineTo(rx + 2, ry - h - 8); g.lineTo(rx + 12, ry - h - 3); g.lineTo(rx - 8, ry - h + 2); g.closePath(); g.fill();
    }
    const [cx, cy] = P(0.45, 0.55, 0);
    g.fillStyle = '#07090c'; g.beginPath(); g.ellipse(cx, cy - 10, 17, 13, 0, Math.PI, 0); g.lineTo(cx + 17, cy); g.lineTo(cx - 17, cy); g.fill();
    g.save(); g.shadowColor = PAL.neon; g.shadowBlur = 8; g.fillStyle = PAL.neon;
    g.beginPath(); g.arc(cx - 5, cy - 11, 1.8, 0, 6.283); g.arc(cx + 5, cy - 11, 1.8, 0, 6.283); g.fill(); g.restore();
    // bones + chain
    g.strokeStyle = '#d9d2c3'; g.lineWidth = 2;
    const [bx, by] = P(1.1, 1.0, 0); g.beginPath(); g.moveTo(bx - 6, by); g.lineTo(bx + 6, by - 3); g.stroke();
    g.strokeStyle = PAL.iron; g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(cx - 24 + i * 5, cy + 4 + (i % 2), 2.6, 1.6, 0, 0, 6.283); g.stroke(); }
  };
  B.arrow = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#37352f');
    box(g, -0.95, -0.95, 0.95, 0.95, 3, 20, PAL.stone);
    const top = 58 + t * 6;
    for (const [x, y] of [[-0.75, -0.75], [0.6, -0.75], [0.6, 0.6], [-0.75, 0.6]]) box(g, x, y, x + 0.16, y + 0.16, 20, top, PAL.timberD);
    // cross braces
    g.strokeStyle = PAL.timber; g.lineWidth = 2;
    for (const [a, b] of [[[-0.7, 0.76, 22], [0.68, 0.76, top - 4]], [[0.68, 0.76, 22], [-0.7, 0.76, top - 4]], [[0.76, -0.7, 22], [0.76, 0.68, top - 4]], [[0.76, 0.68, 22], [0.76, -0.7, top - 4]]]) {
      const p1 = P(a[0], a[1], a[2]), p2 = P(b[0], b[1], b[2]); g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
    }
    box(g, -1.0, -1.0, 1.0, 1.0, top, top + 7, t >= 2 ? PAL.stoneD : PAL.plank);
    // crenellation posts
    for (const [x, y] of [[-1.0, 0.8], [0.8, 0.8], [0.8, -1.0]]) box(g, x, y, x + 0.2, y + 0.2, top + 7, top + 14, U.shade(PAL.plank, 0.1));
    if (t >= 3) runeLines(g, 0.96, 0, 10, PAL.neon);
  };
  B.ballista = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#37352f');
    box(g, -1.15, -1.15, 1.15, 1.15, 3, 16 + t * 2, PAL.stone);
    for (const [x, y] of [[-1.15, 0.85], [-0.35, 0.85], [0.45, 0.85], [0.85, 0.05], [0.85, -0.75]]) box(g, x, y, x + 0.3, y + 0.3, 16 + t * 2, 22 + t * 2, PAL.stoneL);
    if (t >= 2) runeLines(g, 1.16, 0, 8, PAL.neon);
  };
  B.catapult = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5);
    const ring = cyl(g, 0, 0, 1.25, 0, 12 + t * 2, t >= 2 ? PAL.stoneD : '#6c5b45', '#2a2622');
    g.fillStyle = '#1b1814'; g.beginPath(); g.ellipse(ring.cx, ring.cy, ring.rx * 0.8, ring.ry * 0.8, 0, 0, 6.283); g.fill();
    // boulders
    for (const [x, y] of [[0.75, 0.9], [1.0, 0.65]]) { const [bx, by] = P(x, y, 12); g.fillStyle = '#6f7682'; g.beginPath(); g.arc(bx, by - 3, 4, 0, 6.283); g.fill(); }
  };
  B.frost = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1); plate(g, 1, '#2d3440');
    box(g, -0.55, -0.55, 0.55, 0.55, 3, 14, PAL.stoneD);
    crystal(g, 0, 0, 14, 62 + t * 6, 11, '#9ad8ff');
    crystal(g, -0.35, 0.3, 12, 26, 6, PAL.ice);
    crystal(g, 0.35, 0.2, 12, 20, 5, '#c7f5ff');
  };
  B.storm = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1); plate(g, 1, '#2c2f36');
    const h = 56 + t * 6;
    cyl(g, 0, 0, 0.3, 3, h, '#4a3a2c');
    for (let i = 0; i < 3; i++) {
      const [fx, fy] = P(0, 0.3, 12 + i * 15);
      g.fillStyle = i % 2 ? PAL.neon : '#2a1d16';
      g.fillRect(fx - 5, fy - 3, 3, 2); g.fillRect(fx + 2, fy - 3, 3, 2);
      g.fillStyle = '#20150f'; g.fillRect(fx - 4, fy + 2, 8, 2);
    }
    const [wx, wy] = P(0, 0, h - 6);
    g.strokeStyle = PAL.timberD; g.lineWidth = 3;
    g.beginPath(); g.moveTo(wx - 18, wy + 4); g.lineTo(wx, wy - 2); g.lineTo(wx + 18, wy + 4); g.stroke();
  };
  B.harpoon = function (g, lv) {
    const t = tier(lv);
    shadowBlob(g, 1.5); plate(g, 1.5, '#33352f');
    box(g, -1.1, -1.1, 1.1, 1.1, 3, 10, PAL.stoneD);
    box(g, -0.8, -0.8, 0.8, 0.8, 10, 18 + t * 2, PAL.timber);
    for (const [x, y] of [[-1.0, 0.95], [0.95, -1.0]]) { const [rx, ry] = P(x, y, 10); g.strokeStyle = '#b9b0a0'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(rx, ry - 2, 7, 3.5, 0, 0, 6.283); g.stroke(); g.beginPath(); g.ellipse(rx, ry - 4, 5, 2.5, 0, 0, 6.283); g.stroke(); }
    if (t >= 2) runeLines(g, 0.81, 0, 12, PAL.neon);
  };
  B.runemine = function (g, lv) {
    const [cx, cy] = P(0, 0, 0);
    g.save(); g.shadowColor = PAL.danger; g.shadowBlur = 6;
    g.strokeStyle = U.rgba(PAL.danger, 0.8); g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(cx, cy, 13, 6.5, 0, 0, 6.283); g.stroke();
    g.beginPath(); g.moveTo(cx - 4, cy - 3); g.lineTo(cx + 2, cy); g.lineTo(cx - 2, cy + 1); g.lineTo(cx + 4, cy + 3); g.stroke();
    g.restore();
  };
  B.pitfall = function (g) {
    const [cx, cy] = P(0, 0, 0);
    g.fillStyle = 'rgba(10,8,6,0.7)'; g.beginPath(); g.ellipse(cx, cy, 13, 6.5, 0, 0, 6.283); g.fill();
    g.strokeStyle = '#8e7a5a'; g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 4, cy + 2); g.lineTo(cx + i * 4 + 1, cy - 5); g.stroke(); }
  };
  B.skysnare = function (g) {
    const [cx, cy] = P(0, 0, 0);
    box(g, -0.25, -0.25, 0.25, 0.25, 0, 6, '#3c3f45');
    g.strokeStyle = U.rgba(PAL.danger, 0.8); g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx - 8 + i * 5, cy - 14); g.lineTo(cx - 6 + i * 4, cy - 6); g.stroke(); }
    g.beginPath(); g.arc(cx, cy - 14, 9, Math.PI, 0); g.stroke();
  };

  // extra height per type for sprite canvas size
  const TOP = { hall: 200, arrow: 110, harpoon: 70, storm: 110, frost: 110, rsdrill: 110, forge: 90, barracks: 90, seidr: 90, camp: 70, goldmint: 70 };
  ART.buildingSprite = function (type, lv) {
    const key = 'b:' + type + ':' + lv;
    const size = FS.D.B[type].size, w = size * 64 + 40, top = (TOP[type] || 70) + 16, h = size * 32 + top + 12;
    return I.sprite(key, w, h, w / 2, top + size * 16, (g) => { (B[type] || B.builder)(g, lv); });
  };
  ART.rubbleSprite = function (size) {
    const key = 'rubble:' + size;
    const w = size * 64 + 20, h = size * 32 + 30;
    return I.sprite(key, w, h, w / 2, 20 + size * 16, (g) => {
      const hh = size / 2 - 0.1;
      poly(g, [[-hh, -hh, 0], [hh, -hh, 0], [hh, hh, 0], [-hh, hh, 0]], 'rgba(20,18,16,0.7)');
      const r = U.rng(size * 97);
      for (let i = 0; i < 6 + size * 5; i++) {
        const [x, y] = P(r.range(-hh, hh), r.range(-hh, hh), 0), s = r.range(2, 3 + size * 1.5);
        g.fillStyle = r() < 0.5 ? '#3d3833' : '#57504a'; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 0.3, y - s * 0.9); g.lineTo(x + s, y - s * 0.3); g.lineTo(x + s * 0.6, y + s * 0.3); g.closePath(); g.fill();
      }
      g.strokeStyle = '#2a1d16'; g.lineWidth = 2;
      for (let i = 0; i < size; i++) { const [x, y] = P(r.range(-hh, hh), r.range(-hh, hh), 0); g.beginPath(); g.moveTo(x - 6, y - 2); g.lineTo(x + 6, y + 1); g.stroke(); }
    });
  };
  // foundation for a building under first construction
  ART.foundationSprite = function (size) {
    return I.sprite('found:' + size, size * 64 + 20, size * 32 + 30, size * 32 + 10, 20 + size * 16, (g) => {
      const h = size / 2;
      plate(g, h, '#4a3c2e');
      g.strokeStyle = 'rgba(255,207,138,0.35)'; g.lineWidth = 1;
      for (let i = 1; i < size * 2; i++) { const k = -h + i * 0.5; const a = P(k, -h + 0.2, 3), b = P(k, h - 0.2, 3); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    });
  };

  // ---------- walls ----------
  const WALL_COL = ['#6b4e36', '#7a5a3e', '#6c7380', '#7b8390', '#58616e', '#66707e', '#3d3656', '#463e63'];
  ART.wallSprite = function (lv, mask) { // mask bit1 = neighbour at +x, bit2 = neighbour at +y
    const key = 'w:' + lv + ':' + mask;
    return I.sprite(key, 110, 90, 55, 56, (g) => {
      const col = WALL_COL[Math.max(0, Math.min(7, lv - 1))], H = 16 + Math.min(lv, 8) * 1.2;
      const m = lv <= 2 ? 'wood' : lv <= 4 ? 'stone' : lv <= 6 ? 'iron' : 'rune';
      const seg = (x0, y0, x1, y1) => {
        box(g, x0, y0, x1, y1, 0, H, col);
        if (m === 'wood') { // pointed stakes
          const [px, py] = P(x1, y1, H);
          g.fillStyle = U.shade(col, 0.25); g.beginPath(); g.moveTo(px - 3, py); g.lineTo(px, py - 5); g.lineTo(px + 3, py); g.fill();
        } else if (m === 'iron') {
          g.strokeStyle = '#2e333b'; g.lineWidth = 1; const a = P(x0, y1, H * 0.5), b = P(x1, y1, H * 0.5); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        } else if (m === 'rune') {
          const [cx, cy] = P((x0 + x1) / 2, y1, H * 0.45); g.save(); g.shadowColor = PAL.rune; g.shadowBlur = 5; g.fillStyle = '#b29bff'; g.fillRect(cx - 1, cy - 3, 2, 6); g.restore();
        }
      };
      const a = 0.26;
      if (mask & 1) seg(0, -a * 0.8, 1, a * 0.8);
      if (mask & 2) seg(-a * 0.8, 0, a * 0.8, 1);
      seg(-a, -a, a, a);
      if (m === 'stone' || m === 'rune') { const [cx, cy] = P(0, 0, H); g.fillStyle = PAL.snow; g.beginPath(); g.ellipse(cx, cy, 6, 3, 0, 0, 6.283); g.fill(); }
    });
  };

  // ---------- obstacles ----------
  ART.obstacleSprite = function (type) {
    const size = FS.D.OBST[type].size;
    return I.sprite('o:' + type, size * 64 + 40, size * 32 + 110, size * 32 + 20, 100 + size * 16, (g) => {
      const [cx, cy] = P(0, 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx + 4, cy + 2, size * 22, size * 10, 0, 0, 6.283); g.fill();
      if (type === 'pine' || type === 'fir') {
        const s = type === 'fir' ? 1.15 : 1;
        g.fillStyle = '#3a2a22'; g.fillRect(cx - 3, cy - 12, 6, 12);
        for (let k = 0; k < 4; k++) {
          const ty = cy - 8 - k * 17 * s, tw = (28 - k * 6) * s;
          g.fillStyle = k % 2 ? '#1a3c35' : '#17342e'; g.beginPath(); g.moveTo(cx - tw, ty); g.lineTo(cx, ty - 26 * s); g.lineTo(cx + tw, ty); g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(cx, ty - 26 * s); g.lineTo(cx + tw, ty); g.lineTo(cx + tw * 0.2, ty); g.closePath(); g.fill();
          if (type === 'fir' || k >= 2) { g.fillStyle = PAL.snow; g.beginPath(); g.moveTo(cx - tw * 0.6, ty - 9 * s); g.lineTo(cx, ty - 26 * s); g.lineTo(cx + tw * 0.45, ty - 11 * s); g.quadraticCurveTo(cx, ty - 6 * s, cx - tw * 0.6, ty - 9 * s); g.fill(); }
        }
      } else if (type === 'rock' || type === 'stone') {
        const s = type === 'rock' ? 1 : 0.55;
        g.fillStyle = '#5a6270'; g.beginPath(); g.moveTo(cx - 30 * s, cy); g.lineTo(cx - 22 * s, cy - 22 * s); g.lineTo(cx + 2 * s, cy - 32 * s); g.lineTo(cx + 26 * s, cy - 16 * s); g.lineTo(cx + 30 * s, cy); g.closePath(); g.fill();
        g.fillStyle = '#434a56'; g.beginPath(); g.moveTo(cx + 2 * s, cy - 32 * s); g.lineTo(cx + 26 * s, cy - 16 * s); g.lineTo(cx + 30 * s, cy); g.lineTo(cx + 6 * s, cy); g.closePath(); g.fill();
        g.fillStyle = type === 'stone' ? '#3f6b4c' : PAL.snow; g.beginPath(); g.moveTo(cx - 22 * s, cy - 22 * s); g.lineTo(cx + 2 * s, cy - 32 * s); g.lineTo(cx + 14 * s, cy - 24 * s); g.lineTo(cx - 10 * s, cy - 18 * s); g.closePath(); g.fill();
      } else {
        for (const [ox, oy, r] of [[-8, -6, 9], [7, -7, 8], [0, -12, 9]]) { g.fillStyle = '#2c4a40'; g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, 6.283); g.fill(); }
        g.fillStyle = '#d5e6ee'; for (const [ox, oy] of [[-8, -11], [4, -17], [8, -9]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 3, 0, 6.283); g.fill(); }
        g.fillStyle = PAL.ice; g.beginPath(); g.arc(cx - 2, cy - 8, 1.6, 0, 6.283); g.fill();
      }
    });
  };

  // ---------- turrets & live parts (drawn every frame, iso px at building centre) ----------
  const isoDir = (a) => { const dx = Math.cos(a), dy = Math.sin(a); const x = dx - dy, y = (dx + dy) / 2; const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  ART.isoDir = isoDir;
  const TURRET_Z = { arrow: (lv) => 72 + tier(lv) * 6, ballista: (lv) => 22 + tier(lv) * 2, catapult: (lv) => 12 + tier(lv) * 2, harpoon: (lv) => 18 + tier(lv) * 2, storm: (lv) => 58 + tier(lv) * 6, frost: (lv) => 60 + tier(lv) * 6 };
  ART.turretZ = (type, lv) => (TURRET_Z[type] ? TURRET_Z[type](lv) : 30);
  ART.turret = function (ctx, type, lv, x, y, aim, fire, t, team) {
    const z = ART.turretZ(type, lv);
    const cx = x, cy = y - z;
    const [dx, dy] = isoDir(aim);
    const px = -dy, py = dx;
    const hot = team === 'enemy' ? PAL.danger : PAL.danger;
    if (type === 'arrow') {
      ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.ellipse(cx, cy, 9, 4.5, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#d7c7a8'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(cx - dx * 4, cy - dy * 4 - 4); ctx.lineTo(cx + dx * 13, cy + dy * 13 - 4); ctx.stroke();
      ctx.strokeStyle = PAL.timber; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(cx + px * 10 + dx * 3, cy + py * 10 + dy * 3 - 4); ctx.quadraticCurveTo(cx + dx * 11, cy + dy * 11 - 4, cx - px * 10 + dx * 3, cy - py * 10 + dy * 3 - 4); ctx.stroke();
      ctx.fillStyle = fire > 0 ? '#fff' : hot; ctx.beginPath(); ctx.arc(cx + dx * 13, cy + dy * 13 - 4, 2, 0, 6.283); ctx.fill();
    } else if (type === 'ballista') {
      ctx.fillStyle = '#2b2622'; ctx.beginPath(); ctx.ellipse(cx, cy, 16, 8, 0, 0, 6.283); ctx.fill();
      const rec = fire > 0 ? -4 : 0;
      ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(cx - dx * 14 + dx * rec, cy - dy * 14 - 6 + dy * rec); ctx.lineTo(cx + dx * 18 + dx * rec, cy + dy * 18 - 6 + dy * rec); ctx.stroke();
      ctx.strokeStyle = '#8f7a5e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + px * 17 + dx * 6, cy + py * 17 + dy * 6 - 6); ctx.quadraticCurveTo(cx + dx * 16, cy + dy * 16 - 6, cx - px * 17 + dx * 6, cy - py * 17 + dy * 6 - 6); ctx.stroke();
      ctx.strokeStyle = '#d9d2c3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + px * 17 + dx * 6, cy + py * 17 + dy * 6 - 6); ctx.lineTo(cx - dx * 6, cy - dy * 6 - 6); ctx.lineTo(cx - px * 17 + dx * 6, cy - py * 17 + dy * 6 - 6); ctx.stroke();
      ctx.fillStyle = fire > 0 ? '#fff' : PAL.iron; ctx.beginPath(); ctx.arc(cx + dx * 20, cy + dy * 20 - 6, 2.6, 0, 6.283); ctx.fill();
    } else if (type === 'catapult') {
      const pull = fire > 0 ? 1 : 0;
      ctx.fillStyle = '#4a3527'; ctx.fillRect(cx - 10, cy - 6, 20, 8);
      ctx.strokeStyle = '#6b4c34'; ctx.lineWidth = 4;
      const ax = cx + dx * (pull ? 14 : -12), ay = cy + dy * (pull ? 14 : -12) - (pull ? 26 : 14);
      ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(ax, ay); ctx.stroke();
      if (!pull) { ctx.fillStyle = '#6f7682'; ctx.beginPath(); ctx.arc(ax, ay - 3, 4.5, 0, 6.283); ctx.fill(); }
    } else if (type === 'harpoon') {
      ctx.fillStyle = '#2b2622'; ctx.beginPath(); ctx.ellipse(cx, cy, 12, 6, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#51402f'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(cx - dx * 6, cy - dy * 6 - 2); ctx.lineTo(cx + dx * 12, cy + dy * 12 - 20); ctx.stroke();
      if (fire <= 0) { ctx.strokeStyle = '#c8ced6'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx + dx * 8, cy + dy * 8 - 14); ctx.lineTo(cx + dx * 18, cy + dy * 18 - 27); ctx.stroke(); }
    } else if (type === 'storm') {
      const r = 6 + Math.sin(t * 9) * 1.2 + (fire > 0 ? 3 : 0);
      ctx.save(); ctx.shadowColor = PAL.neon; ctx.shadowBlur = 14;
      ctx.fillStyle = fire > 0 ? '#ffffff' : PAL.ice; ctx.beginPath(); ctx.arc(cx, cy - 6, r, 0, 6.283); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = U.rgba(PAL.neon, 0.7); ctx.lineWidth = 1;
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.moveTo(cx + Math.cos(a) * r, cy - 6 + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * (r + 5), cy - 6 + Math.sin(a) * (r + 5)); } ctx.stroke();
    } else if (type === 'frost') {
      const a = 0.35 + 0.25 * Math.sin(t * 3) + (fire > 0 ? 0.4 : 0);
      ctx.fillStyle = U.rgba(PAL.ice, Math.min(1, a)); ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 6.283); ctx.fill();
    }
  };
  // camp fire flicker + builder hammer + forge smoke are drawn live
  ART.campFire = function (ctx, x, y, t) {
    const s = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.08;
    flame(ctx, x, y - 1, s);
    ctx.fillStyle = U.rgba(PAL.glow, 0.12); ctx.beginPath(); ctx.ellipse(x, y, 34, 17, 0, 0, 6.283); ctx.fill();
  };
  ART.scaffold = function (ctx, x, y, size, t) {
    const h = size / 2 - 0.05, H = 26 + size * 6;
    ctx.strokeStyle = 'rgba(214,178,120,0.95)'; ctx.lineWidth = 1.6;
    const cs = [[-h, -h], [h, -h], [h, h], [-h, h]];
    ctx.beginPath();
    for (const [gx, gy] of cs) { const a = P(gx, gy, 0), b = P(gx, gy, H); ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + b[0], y + b[1]); }
    for (const z of [H * 0.45, H]) {
      const p = cs.map(([gx, gy]) => P(gx, gy, z));
      ctx.moveTo(x + p[3][0], y + p[3][1]); ctx.lineTo(x + p[2][0], y + p[2][1]); ctx.lineTo(x + p[1][0], y + p[1][1]);
    }
    const a = P(-h, h, 0), b = P(h, h, H * 0.45); ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + b[0], y + b[1]);
    ctx.stroke();
    // bouncing hammer
    const [hx, hy] = P(h, h, H + 8);
    const bob = Math.abs(Math.sin(t * 8)) * 6;
    ctx.save(); ctx.translate(x + hx, y + hy - bob); ctx.rotate(-0.6 + Math.sin(t * 8) * 0.6);
    ctx.strokeStyle = '#6b4c34'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 11); ctx.stroke();
    ctx.fillStyle = '#c8ced6'; ctx.fillRect(-5, -2, 10, 5);
    ctx.restore();
  };

  // ---------- troops ----------
  // (x, y) = feet in iso px; s = scale; face = 1 right / -1 left; ph = animation phase
  const SKIN = '#e5c3a5';
  function legs(ctx, x, y, s, ph, col) {
    const k = Math.sin(ph) * 3 * s;
    ctx.strokeStyle = col; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.moveTo(x - 1.5 * s, y - 7 * s); ctx.lineTo(x - 1.5 * s + k, y); ctx.moveTo(x + 1.5 * s, y - 7 * s); ctx.lineTo(x + 1.5 * s - k, y); ctx.stroke();
  }
  function torso(ctx, x, y, s, w, h, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * s, y); ctx.lineTo(x + w * s, y); ctx.lineTo(x + w * 0.8 * s, y - h * s); ctx.lineTo(x - w * 0.8 * s, y - h * s); ctx.closePath(); ctx.fill(); }
  function head(ctx, x, y, s, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * s, 0, 6.283); ctx.fill(); }
  const TR = {};
  TR.wolf = function (ctx, x, y, s, f, ph, T, big) {
    const b = big || 1, S = s * b;
    const k = Math.sin(ph) * 2.2 * S;
    ctx.strokeStyle = U.shade(T.fur, -0.35); ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(x - 5 * S * f, y - 5 * S); ctx.lineTo(x - 5 * S * f + k, y);
    ctx.moveTo(x - 3 * S * f, y - 5 * S); ctx.lineTo(x - 3 * S * f - k, y);
    ctx.moveTo(x + 4 * S * f, y - 5 * S); ctx.lineTo(x + 4 * S * f - k, y);
    ctx.moveTo(x + 6 * S * f, y - 5 * S); ctx.lineTo(x + 6 * S * f + k, y);
    ctx.stroke();
    ctx.fillStyle = T.fur; ctx.beginPath(); ctx.ellipse(x, y - 7 * S, 8 * S, 4 * S, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = T.fur; ctx.lineWidth = 2.4 * S; ctx.beginPath(); ctx.moveTo(x - 7 * S * f, y - 8 * S); ctx.quadraticCurveTo(x - 11 * S * f, y - 12 * S + k * 0.5, x - 13 * S * f, y - 9 * S); ctx.stroke();
    const hx = x + 8 * S * f, hy = y - 10 * S;
    ctx.fillStyle = U.shade(T.fur, 0.1); ctx.beginPath(); ctx.moveTo(hx - 3 * S * f, hy - 3 * S); ctx.lineTo(hx + 6 * S * f, hy + 1 * S); ctx.lineTo(hx - 2 * S * f, hy + 4 * S); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy, 3.4 * S, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - 2 * S * f, hy - 2 * S); ctx.lineTo(hx - 1 * S * f, hy - 7 * S); ctx.lineTo(hx + 1.5 * S * f, hy - 2.5 * S); ctx.fill();
    ctx.fillStyle = T.main; ctx.fillRect(hx + 0.5 * S * f - 0.8 * S, hy - 1.2 * S, 1.6 * S, 1.6 * S);
    ctx.strokeStyle = T.main; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(x + 4 * S * f, y - 10.5 * S); ctx.lineTo(x + 5 * S * f, y - 4 * S); ctx.stroke();
  };
  TR.huntress = function (ctx, x, y, s, f, ph, T) {
    legs(ctx, x, y, s, ph, '#2b2f36');
    torso(ctx, x, y - 7 * s, s, 3.6, 8, T.cloth);
    ctx.fillStyle = T.main; ctx.fillRect(x - 3 * s, y - 10 * s, 6 * s, 1.5 * s);
    head(ctx, x, y - 18 * s, s, 3.2, SKIN);
    ctx.fillStyle = '#e8d38a'; ctx.beginPath(); ctx.moveTo(x - 3 * s * f, y - 20 * s); ctx.quadraticCurveTo(x - 7 * s * f, y - 14 * s, x - 5 * s * f, y - 9 * s); ctx.lineTo(x - 2.5 * s * f, y - 16 * s); ctx.fill();
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.arc(x + 4 * s * f, y - 13 * s, 7 * s, -1.3, 1.3); ctx.stroke();
    ctx.strokeStyle = T.light; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(x + 5.5 * s * f, y - 19.8 * s); ctx.lineTo(x + 5.5 * s * f, y - 6.2 * s); ctx.stroke();
  };
  TR.jotunn = function (ctx, x, y, s, f, ph, T) {
    const S = s * 1.8;
    legs(ctx, x, y, S, ph, '#4a5a6a');
    torso(ctx, x, y - 7 * S, S, 5, 9, '#8fb0c8');
    ctx.fillStyle = T.cloth; ctx.fillRect(x - 5 * S, y - 9 * S, 10 * S, 3 * S);
    head(ctx, x + 0.5 * S * f, y - 18.5 * S, S, 3, '#a7c4d8');
    ctx.fillStyle = '#e6eff5'; ctx.beginPath(); ctx.moveTo(x - 2 * S, y - 17 * S); ctx.lineTo(x + 3 * S, y - 17 * S); ctx.lineTo(x + 0.5 * S, y - 12 * S); ctx.fill();
    ctx.fillStyle = T.main; ctx.fillRect(x + 1.2 * S * f - 0.6 * S, y - 19.5 * S, 1.2 * S, 1 * S);
    // club
    const sw = Math.sin(ph * 0.5) * 0.3;
    ctx.save(); ctx.translate(x + 5 * S * f, y - 13 * S); ctx.rotate((0.5 + sw) * f);
    ctx.fillStyle = '#5a4130'; ctx.fillRect(-1.3 * S, -10 * S, 2.6 * S, 12 * S); ctx.fillStyle = '#6f5a44'; ctx.beginPath(); ctx.arc(0, -10 * S, 3 * S, 0, 6.283); ctx.fill();
    ctx.restore();
  };
  TR.sapper = function (ctx, x, y, s, f, ph, T, _b, t) {
    legs(ctx, x, y, s, ph * 1.3, '#2b2f36');
    torso(ctx, x, y - 7 * s, s, 3.2, 7, T.cloth);
    head(ctx, x, y - 16.5 * s, s, 3, SKIN);
    ctx.fillStyle = '#6a4a32'; ctx.beginPath(); ctx.ellipse(x + 2 * s * f, y - 19 * s, 5 * s, 4 * s, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#3a2a1f'; ctx.fillRect(x + 2 * s * f - 5 * s, y - 20 * s, 10 * s, 1.2 * s);
    ctx.fillStyle = (Math.sin((t || 0) * 18) > 0) ? '#fff' : T.main; ctx.beginPath(); ctx.arc(x + 5 * s * f, y - 24 * s, 1.6 * s, 0, 6.283); ctx.fill();
  };
  TR.raven = function (ctx, x, y, s, f, ph, T) {
    const S = s * 1.3, fl = Math.sin(ph * 1.6);
    ctx.fillStyle = '#1c2230';
    ctx.beginPath(); ctx.moveTo(x - 2 * S, y); ctx.lineTo(x - 12 * S, y - 7 * S * fl - 2 * S); ctx.lineTo(x - 5 * S, y + 2 * S); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2 * S, y); ctx.lineTo(x + 12 * S, y - 7 * S * fl - 2 * S); ctx.lineTo(x + 5 * S, y + 2 * S); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, 5 * S, 3 * S, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4 * S * f, y - 2 * S, 2.6 * S, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#e0b35a'; ctx.beginPath(); ctx.moveTo(x + 6 * S * f, y - 2.6 * S); ctx.lineTo(x + 9 * S * f, y - 1.6 * S); ctx.lineTo(x + 6 * S * f, y - 1 * S); ctx.fill();
    ctx.fillStyle = T.main; ctx.fillRect(x + 4.5 * S * f - 0.6 * S, y - 3 * S, 1.2 * S, 1.2 * S);
    ctx.strokeStyle = T.main; ctx.lineWidth = 1 * S; ctx.beginPath(); ctx.moveTo(x - 10 * S, y - 6 * S * fl - 1.5 * S); ctx.lineTo(x - 4 * S, y - 0.5 * S); ctx.moveTo(x + 10 * S, y - 6 * S * fl - 1.5 * S); ctx.lineTo(x + 4 * S, y - 0.5 * S); ctx.stroke();
  };
  TR.berserker = function (ctx, x, y, s, f, ph, T) {
    const S = s * 1.25;
    legs(ctx, x, y, S, ph * 1.2, '#3b2c22');
    torso(ctx, x, y - 7 * S, S, 4.2, 8.5, '#c48f6e');
    ctx.fillStyle = '#3b3b3b'; ctx.beginPath(); ctx.ellipse(x, y - 13 * S, 5 * S, 2.6 * S, 0, 0, 6.283); ctx.fill(); // bear pelt
    ctx.fillStyle = T.cloth; ctx.fillRect(x - 4.2 * S, y - 8.5 * S, 8.4 * S, 2.5 * S);
    head(ctx, x, y - 18 * S, S, 3.2, SKIN);
    ctx.fillStyle = '#b5562e'; ctx.beginPath(); ctx.moveTo(x - 3 * S, y - 17 * S); ctx.lineTo(x + 3 * S, y - 17 * S); ctx.lineTo(x, y - 12.5 * S); ctx.fill();
    for (const side of [1, -1]) {
      const sw = Math.sin(ph + (side > 0 ? 0 : 3)) * 0.8;
      ctx.save(); ctx.translate(x + 4.5 * S * side, y - 12 * S); ctx.rotate(side * (0.6 + sw));
      ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(0, 2 * S); ctx.lineTo(0, -8 * S); ctx.stroke();
      ctx.fillStyle = T.light; ctx.beginPath(); ctx.moveTo(0, -8 * S); ctx.lineTo(3.5 * S * side, -9.5 * S); ctx.lineTo(3.5 * S * side, -4.5 * S); ctx.lineTo(0, -6 * S); ctx.fill();
      ctx.restore();
    }
  };
  TR.draugr = function (ctx, x, y, s, f, ph, T, big) {
    const S = s * (big ? 1.7 : 1.1);
    legs(ctx, x, y, S, ph * 0.7, '#3b4038');
    torso(ctx, x, y - 7 * S, S, 4.8, 9, '#55604e');
    ctx.fillStyle = '#2d3329'; ctx.fillRect(x - 4.8 * S, y - 9.5 * S, 9.6 * S, 2 * S);
    head(ctx, x, y - 18.5 * S, S, 3.2, '#7e8a73');
    ctx.fillStyle = '#6d7680'; ctx.beginPath(); ctx.arc(x, y - 19.5 * S, 3.6 * S, Math.PI, 0); ctx.fill();
    ctx.save(); ctx.shadowColor = PAL.rune; ctx.shadowBlur = 6; ctx.fillStyle = '#c3adff';
    ctx.fillRect(x - 2 * S, y - 19 * S, 1.3 * S, 1.3 * S); ctx.fillRect(x + 0.8 * S, y - 19 * S, 1.3 * S, 1.3 * S); ctx.restore();
    ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 1.8 * S; ctx.beginPath(); ctx.moveTo(x + 4 * S * f, y - 6 * S); ctx.lineTo(x + 7 * S * f, y - 20 * S); ctx.stroke();
    ctx.fillStyle = T.main; ctx.fillRect(x - 1 * S, y - 12 * S, 2 * S, 2 * S);
  };
  TR.draugrling = function (ctx, x, y, s, f, ph, T) { TR.draugr(ctx, x, y, s * 0.72, f, ph, T, false); };
  TR.volva = function (ctx, x, y, s, f, ph, T) {
    const S = s * 1.2;
    ctx.save(); ctx.globalAlpha *= 0.35; ctx.fillStyle = T.light; ctx.beginPath(); ctx.arc(x, y - 10 * S, 11 * S, 0, 6.283); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.moveTo(x - 5 * S, y); ctx.quadraticCurveTo(x, y - 3 * S + Math.sin(ph) * S, x + 5 * S, y); ctx.lineTo(x + 3 * S, y - 12 * S); ctx.lineTo(x - 3 * S, y - 12 * S); ctx.fill();
    ctx.fillStyle = T.cloth; ctx.beginPath(); ctx.moveTo(x - 4 * S, y - 12 * S); ctx.lineTo(x + 4 * S, y - 12 * S); ctx.lineTo(x, y - 4 * S); ctx.fill();
    head(ctx, x, y - 15 * S, S, 3, SKIN);
    ctx.fillStyle = '#f0f3f7'; ctx.beginPath(); ctx.arc(x, y - 16 * S, 3.4 * S, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1.4 * S; ctx.beginPath(); ctx.moveTo(x + 5 * S * f, y - 2 * S); ctx.lineTo(x + 5 * S * f, y - 22 * S); ctx.stroke();
    ctx.save(); ctx.shadowColor = T.main; ctx.shadowBlur = 8; ctx.fillStyle = T.light; ctx.beginPath(); ctx.arc(x + 5 * S * f, y - 23 * S, 2.4 * S, 0, 6.283); ctx.fill(); ctx.restore();
  };
  TR.stormrider = function (ctx, x, y, s, f, ph, T) {
    const S = s * 1.3, fl = Math.sin(ph * 1.2);
    ctx.fillStyle = '#2d3a48';
    ctx.beginPath(); ctx.moveTo(x - 3 * S, y - 4 * S); ctx.lineTo(x - 16 * S, y - 12 * S * fl - 6 * S); ctx.lineTo(x - 8 * S, y - 1 * S); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 3 * S, y - 4 * S); ctx.lineTo(x + 16 * S, y - 12 * S * fl - 6 * S); ctx.lineTo(x + 8 * S, y - 1 * S); ctx.fill();
    ctx.fillStyle = '#5b6b7c'; ctx.beginPath(); ctx.ellipse(x, y - 3 * S, 8 * S, 3.6 * S, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 8 * S * f, y - 5 * S, 3 * S, 0, 6.283); ctx.fill();
    torso(ctx, x - 1 * S * f, y - 5 * S, S, 2.5, 7, T.cloth);
    head(ctx, x - 1 * S * f, y - 14 * S, S, 2.6, SKIN);
    ctx.fillStyle = PAL.iron; ctx.beginPath(); ctx.arc(x - 1 * S * f, y - 15 * S, 2.8 * S, Math.PI, 0); ctx.fill();
    ctx.save(); ctx.shadowColor = T.main; ctx.shadowBlur = 8; ctx.strokeStyle = T.light; ctx.lineWidth = 1.3 * S;
    ctx.beginPath(); ctx.moveTo(x + 3 * S * f, y - 18 * S); ctx.lineTo(x + 5 * S * f, y - 13 * S); ctx.lineTo(x + 3.5 * S * f, y - 13 * S); ctx.lineTo(x + 6 * S * f, y - 8 * S); ctx.stroke(); ctx.restore();
  };
  TR.hero = function (ctx, x, y, s, f, ph, T, _b, t) {
    const S = s * 2.1;
    ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillStyle = U.rgba(T.main, 0.35); ctx.beginPath(); ctx.ellipse(x, y - 8 * S, 13 * S, 8 * S, 0, 0, 6.283); ctx.fill(); ctx.restore();
    TR.wolf(ctx, x, y, s, f, ph, { fur: T === TEAM.ally ? '#c8d8e4' : '#b8a09c', main: T.main }, 2.1);
    // broken chain on the neck
    ctx.strokeStyle = '#8e9aab'; ctx.lineWidth = 1.2 * s;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + (4 - i * 3.5) * S * f * 0.5, y - 6 * S + i * 1.5 * S, 2.2 * s, 1.4 * s, 0.4, 0, 6.283); ctx.stroke(); }
    ctx.save(); ctx.shadowColor = T.main; ctx.shadowBlur = 10; ctx.fillStyle = T.main;
    ctx.beginPath(); ctx.arc(x + 8.5 * S * f, y - 10.5 * S, 1.4 * s, 0, 6.283); ctx.fill(); ctx.restore();
  };
  ART.troopHeight = { wolf: 16, huntress: 22, jotunn: 40, sapper: 24, raven: 14, berserker: 28, draugr: 38, draugrling: 26, volva: 30, stormrider: 26, hero: 34 };
  ART.troop = function (ctx, key, x, y, s, face, ph, team, t) {
    const T = TEAM[team] || TEAM.ally;
    (TR[key] || TR.wolf)(ctx, x, y, s, face, ph, T, key === 'draugr', t);
  };
  // small icon renderer used by the UI (troops, spells, hero)
  ART.icon = function (canvas, kind, key, team) {
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    const sc = w / 48;
    g.save(); g.scale(sc, sc);
    if (kind === 'troop' || kind === 'hero') {
      const hgt = ART.troopHeight[key] || 20;
      const s = Math.min(1.5, 34 / (hgt * 1.2));
      const fly = ['raven', 'volva', 'stormrider'].includes(key);
      ART.troop(g, key, 24, fly ? 34 : 42, s * (key === 'hero' ? 0.72 : 1), 1, 0.6, team || 'ally', 0);
    } else if (kind === 'spell') {
      const col = { lightning: '#9af0ff', heal: '#7dffb0', rage: '#00d9ff', frostveil: '#c7f5ff' }[key] || '#9af0ff';
      const gr = g.createRadialGradient(24, 24, 2, 24, 24, 20); gr.addColorStop(0, U.rgba(col, 0.9)); gr.addColorStop(1, U.rgba(col, 0.05));
      g.fillStyle = gr; g.beginPath(); g.arc(24, 24, 20, 0, 6.283); g.fill();
      g.strokeStyle = '#05080d'; g.lineWidth = 3; g.fillStyle = '#05080d';
      g.beginPath();
      if (key === 'lightning') { g.moveTo(27, 8); g.lineTo(17, 26); g.lineTo(24, 26); g.lineTo(20, 40); g.lineTo(32, 20); g.lineTo(25, 20); g.closePath(); g.fill(); }
      else if (key === 'heal') { g.fillRect(21, 12, 6, 24); g.fillRect(12, 21, 24, 6); }
      else if (key === 'rage') { g.moveTo(12, 34); g.lineTo(18, 14); g.lineTo(24, 26); g.lineTo(30, 14); g.lineTo(36, 34); g.stroke(); }
      else { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.moveTo(24 + Math.cos(a) * 13, 24 + Math.sin(a) * 13); g.lineTo(24 - Math.cos(a) * 13, 24 - Math.sin(a) * 13); } g.stroke(); }
    }
    g.restore();
  };
  // building thumbnail for the shop
  ART.thumb = function (canvas, type, lv) {
    const g = canvas.getContext('2d');
    const size = FS.D.B[type].size;
    const w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    const top = (TOP[type] || 70) + 16;
    const sw = size * 64 + 40, sh = size * 32 + top + 12;
    const k = Math.min(w / sw, h / sh) * 0.98;
    g.save(); g.translate(w / 2, (h - sh * k) / 2 + (top + size * 16) * k); g.scale(k, k);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (type === 'wall') {
      g.translate(0, 0); (function () { const s = ART.wallSprite(Math.max(1, lv), 3); g.drawImage(s.c, -s.ax - 20, -s.ay + 10, s.w * 1.6, s.h * 1.6); })();
    } else (B[type] || B.builder)(g, lv || 1);
    g.restore();
  };
})(window.FS = window.FS || {});
