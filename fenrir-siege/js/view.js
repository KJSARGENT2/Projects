/* Fenrir Siege — shared particles + the home-village renderer and village input
   (select, move by drag, shop placement ghost, wall painting, collect bubbles). */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U, I = FS.iso, V = FS.V, ART = FS.art;
  const G = D.GRID;

  // ---------- particles (iso space) ----------
  const P = FS.P = { parts: [], floats: [], rings: [] };
  P.clear = () => { P.parts.length = 0; P.floats.length = 0; P.rings.length = 0; };
  P.burst = function (x, y, col, n, spd, up, grav) {
    for (let i = 0; i < n && P.parts.length < 420; i++) {
      const a = Math.random() * 6.283, v = U.rand(0.3, 1) * spd;
      P.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - (up || 0), life: U.rand(0.35, 0.8), max: 0.8, col, s: U.rand(2, 4), g: grav || 0 });
    }
  };
  P.puff = function (x, y, size) {
    for (let i = 0; i < 10 + size * 4 && P.parts.length < 420; i++) {
      const a = Math.random() * 6.283, v = U.rand(20, 45) * size;
      P.parts.push({ x: x + Math.cos(a) * size * 14, y: y + Math.sin(a) * size * 7, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 10, life: U.rand(0.5, 0.9), max: 0.9, col: 'rgba(214,200,180,0.55)', s: U.rand(5, 10), g: -5, dust: true });
    }
  };
  P.sparkle = function (x, y, size) {
    for (let i = 0; i < 18 + size * 4 && P.parts.length < 420; i++) {
      P.parts.push({ x: x + U.rand(-size * 20, size * 20), y: y + U.rand(-size * 10, size * 6), vx: U.rand(-10, 10), vy: U.rand(-70, -30), life: U.rand(0.6, 1.2), max: 1.2, col: Math.random() < 0.5 ? '#9af0ff' : '#ffffff', s: U.rand(2, 3.5), g: 20, star: true });
    }
    P.rings.push({ x, y, t: 0.6, max: 0.6, r: size * 24, col: '#00d9ff' });
  };
  P.float = function (x, y, text, col, big) { P.floats.push({ x, y, text, col, life: 1.3, max: 1.3, big }); if (P.floats.length > 40) P.floats.shift(); };
  P.update = function (dt) {
    for (const p of P.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + p.g * dt; p.life -= dt; }
    P.parts = P.parts.filter((p) => p.life > 0);
    for (const f of P.floats) { f.y -= 34 * dt / Math.max(0.5, I.cam.z); f.life -= dt; }
    P.floats = P.floats.filter((f) => f.life > 0);
    for (const r of P.rings) r.t -= dt;
    P.rings = P.rings.filter((r) => r.t > 0);
  };
  P.draw = function (ctx) {
    for (const r of P.rings) {
      const k = r.t / r.max;
      ctx.strokeStyle = r.col; ctx.globalAlpha = k * 0.8; ctx.lineWidth = 2 / Math.max(0.4, I.cam.z) * 0.6;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * (1.4 - k * 0.6), r.r * 0.5 * (1.4 - k * 0.6), 0, 0, 6.283); ctx.stroke();
    }
    for (const p of P.parts) {
      ctx.globalAlpha = U.clamp(p.life / (p.max * 0.6), 0, 1);
      ctx.fillStyle = p.col;
      if (p.dust) { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.5 - p.life / p.max * 0.5), 0, 6.283); ctx.fill(); }
      else if (p.star) { ctx.fillRect(p.x - p.s / 2, p.y - p.s * 1.2, p.s, p.s * 2.4); ctx.fillRect(p.x - p.s * 1.2, p.y - p.s / 2, p.s * 2.4, p.s); }
      else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    const z = Math.max(0.35, I.cam.z);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of P.floats) {
      const k = f.life / f.max;
      ctx.globalAlpha = U.clamp(k / 0.3, 0, 1);
      const sz = (f.big ? 22 : 16) / z * (1 + Math.max(0, k - 0.85) * 2);
      ctx.font = `800 ${sz}px ${FS.FONT_DISPLAY}`;
      ctx.lineWidth = 4 / z; ctx.strokeStyle = 'rgba(5,8,13,0.85)'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  };

  // ---------- village view ----------
  const VV = FS.VV = { sel: null, ghost: null, move: null, list: [], t: 0, bubbles: [], snow: [] };
  const center = (o) => { const s = V.size(o); return I.toIso(o.c + s / 2, o.r + s / 2); };
  VV.center = center;

  function rebuildList() {
    const L = [];
    for (const b of V.st.b) L.push({ o: b, d: b.c + b.r + D.B[b.t].size, obs: false });
    for (const o of V.st.o) L.push({ o, d: o.c + o.r + D.OBST[o.t].size, obs: true });
    L.sort((a, b) => a.d - b.d);
    VV.list = L;
    V.dirty = false;
  }
  function wallMask(w) {
    const nx = V.at(w.c + 1, w.r), ny = V.at(w.c, w.r + 1);
    return (nx && nx.t === 'wall' && nx.lv >= 1 ? 1 : 0) | (ny && ny.t === 'wall' && ny.lv >= 1 ? 2 : 0);
  }
  VV.consumeFx = function () {
    for (const e of FS.fxq) {
      const o = e.id != null ? V.index.get(e.id) : null;
      let x, y, size = 1;
      if (o) { const c = center(o); x = c.x; y = c.y; size = V.size(o); } else { const c = I.toIso(e.c, e.r); x = c.x; y = c.y; size = e.size || 1; }
      if (e.k === 'place') { if (o) o.pop = VV.t; P.puff(x, y, size); }
      else if (e.k === 'puff') P.puff(x, y, size);
      else if (e.k === 'sparkle') { P.sparkle(x, y - 10, size); if (o) o.pop = VV.t; }
      else if (e.k === 'float') P.float(x, y - 40 - size * 8, e.text, e.col, true);
      else if (e.k === 'storm') { P.burst(x, y - 20, '#ff3d71', 26, 120, 40); P.burst(x, y - 20, '#ffffff', 10, 90, 30); if (o) o.hit = VV.t; }
    }
    FS.fxq.length = 0;
  };

  function drawFootprint(ctx, c, r, s, fill, stroke, lw) {
    const a = I.toIso(c, r), b = I.toIso(c + s, r), cc = I.toIso(c + s, r + s), d = I.toIso(c, r + s);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  VV.drawFootprint = drawFootprint;
  function drawRange(ctx, o) {
    const def = D.B[o.t];
    if (!def.range) return;
    const s = V.size(o), c = I.toIso(o.c + s / 2, o.r + s / 2);
    const rx = def.range * I.HW * 1.414, ry = def.range * I.HH * 1.414;
    ctx.fillStyle = 'rgba(0,217,255,0.07)'; ctx.strokeStyle = 'rgba(0,217,255,0.55)'; ctx.lineWidth = 1.5 / I.cam.z;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    if (def.min) { ctx.strokeStyle = 'rgba(255,61,113,0.5)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, def.min * I.HW * 1.414, def.min * I.HH * 1.414, 0, 0, 6.283); ctx.stroke(); }
  }

  function drawObj(ctx, it) {
    const o = it.o;
    const s = V.size(o);
    const c = center(o);
    if (!I.visible(c.x, c.y - 60, 200)) return;
    const moving = VV.move && VV.move.o === o;
    if (moving) { ctx.globalAlpha = 0.35; }
    if (it.obs) {
      I.drawSprite(ctx, ART.obstacleSprite(o.t), c.x, c.y);
      if (o.clr) ART.scaffold(ctx, c.x, c.y, s, VV.t);
      ctx.globalAlpha = 1;
      return;
    }
    let sx = 1, sy = 1;
    if (o.pop != null) {
      const k = (VV.t - o.pop) / 0.55;
      if (k < 1) { const e = Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.18; sx = 1 - e * 0.6; sy = 1 + e; } else o.pop = null;
    }
    const drawSpr = (spr) => {
      if (sx === 1 && sy === 1) I.drawSprite(ctx, spr, c.x, c.y);
      else { ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sx, sy); I.drawSprite(ctx, spr, 0, 0); ctx.restore(); }
    };
    if (o.t === 'wall') {
      if (o.lv < 1) drawSpr(ART.foundationSprite(1)); else drawSpr(ART.wallSprite(o.lv, wallMask(o)));
    } else if (o.lv < 1) {
      drawSpr(ART.foundationSprite(s));
    } else {
      drawSpr(ART.buildingSprite(o.t, o.lv));
      const def = D.B[o.t];
      if (def.cat === 'def') ART.turret(ctx, o.t, o.lv, c.x, c.y, 0.8 + Math.sin(VV.t * 0.3 + o.id) * 0.9, 0, VV.t);
      if (o.t === 'camp') drawCamp(ctx, o, c);
      if (o.t === 'wolfden') drawDenHero(ctx, o, c);
      if (o.t === 'forge' && !o.bt) smoke(ctx, o, c);
      if (o.hit != null && VV.t - o.hit < 0.5) { ctx.globalAlpha = 0.5 * (1 - (VV.t - o.hit) / 0.5); drawFootprint(ctx, o.c, o.r, s, '#ff3d71'); ctx.globalAlpha = 1; }
    }
    if (o.bt) ART.scaffold(ctx, c.x, c.y, s, VV.t + o.id);
    ctx.globalAlpha = 1;
  }
  function smoke(ctx, o, c) {
    const t = VV.t;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.35 + i / 3) % 1);
      const p = ART.P(-0.9, -0.9, 60 + k * 50);
      ctx.fillStyle = `rgba(160,170,185,${0.28 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(c.x + p[0] + Math.sin(t + i) * 6 * k, c.y + p[1], 5 + k * 10, 0, 6.283); ctx.fill();
    }
  }
  function drawCamp(ctx, o, c) {
    ART.campFire(ctx, c.x, c.y, VV.t + o.id);
    const camps = V.st.b.filter((b) => b.t === 'camp' && b.lv >= 1);
    const idx = camps.indexOf(o);
    const figures = [];
    for (const k of D.TROOP_ORDER) { const n = V.st.army[k] || 0; for (let i = 0; i < n; i++) figures.push(k); }
    const per = Math.ceil(figures.length / Math.max(1, camps.length));
    const mine = figures.slice(idx * per, idx * per + per).slice(0, 14);
    mine.forEach((k, i) => {
      const a = (i / Math.max(1, mine.length)) * 6.283 + 0.4;
      const rr = 0.9 + (i % 2) * 0.35;
      const p = ART.P(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      const fly = D.TROOPS[k].fly;
      ART.troop(ctx, k, c.x + p[0], c.y + p[1] - (fly ? 14 + Math.sin(VV.t * 3 + i) * 3 : 0), 0.9, Math.cos(a) > 0 ? -1 : 1, VV.t * 2 + i, 'ally', VV.t);
    });
  }
  function drawDenHero(ctx, o, c) {
    const h = V.st.hero;
    if (h.lv < 1 || h.up) return;
    const p = ART.P(0.9, 1.1, 0);
    ART.troop(ctx, 'hero', c.x + p[0], c.y + p[1], 0.85, -1, VV.t * 0.7, 'ally', VV.t);
    if (h.hp < FS.army.heroMax() - 0.5) {
      ctx.fillStyle = '#9af0ff'; ctx.font = `700 ${10 / Math.max(0.4, I.cam.z)}px ${FS.FONT_DISPLAY}`; ctx.textAlign = 'center';
      ctx.fillText('z', c.x + p[0] + 10, c.y + p[1] - 36 - (VV.t * 10 % 10));
    }
  }

  // snowfall (screen space, cheap)
  function snow(ctx, dt) {
    if (VV.snow.length < 46) for (let i = VV.snow.length; i < 46; i++) VV.snow.push({ x: Math.random() * I.W, y: Math.random() * I.H, v: U.rand(12, 30), s: U.rand(1, 2.4), p: Math.random() * 6 });
    ctx.fillStyle = 'rgba(230,240,248,0.55)';
    for (const f of VV.snow) {
      f.y += f.v * dt; f.p += dt; f.x += Math.sin(f.p) * 8 * dt;
      if (f.y > I.H + 4) { f.y = -4; f.x = Math.random() * I.W; }
      ctx.fillRect(f.x, f.y, f.s, f.s);
    }
  }
  VV.snowFx = snow;
  VV.vignette = function (ctx) {
    if (!VV.vig || VV.vig.w !== I.W || VV.vig.h !== I.H) {
      const g = ctx.createRadialGradient(I.W / 2, I.H / 2, Math.min(I.W, I.H) * 0.35, I.W / 2, I.H / 2, Math.max(I.W, I.H) * 0.75);
      g.addColorStop(0, 'rgba(5,10,20,0)'); g.addColorStop(1, 'rgba(5,10,20,0.55)');
      VV.vig = { g, w: I.W, h: I.H };
    }
    ctx.fillStyle = VV.vig.g; ctx.fillRect(0, 0, I.W, I.H);
  };

  VV.render = function (ctx, dt) {
    VV.t += dt;
    VV.consumeFx();
    P.update(dt);
    if (V.dirty) rebuildList();
    I.updateBucket();
    I.applyScreen(ctx);
    ctx.fillStyle = '#0b1418'; ctx.fillRect(0, 0, I.W, I.H);
    const sk = (FS.game && FS.game.shake) || 0;
    I.applyWorld(ctx, sk ? U.rand(-sk, sk) : 0, sk ? U.rand(-sk, sk) : 0);
    if (!I.ground || I.ground.theme !== 'home') I.buildGround('home');
    I.drawGround(ctx);
    // ground overlays
    if (VV.sel && !VV.move) {
      const o = VV.sel, s = V.size(o);
      drawFootprint(ctx, o.c, o.r, s, 'rgba(0,217,255,0.12)', 'rgba(0,217,255,0.85)', 2 / I.cam.z);
      if (!V.isObst(o) && o.lv >= 1) drawRange(ctx, o);
      if (VV.sel.t === 'wall' && VV.rowSel) for (const w of VV.rowSel) drawFootprint(ctx, w.c, w.r, 1, 'rgba(0,217,255,0.18)', 'rgba(0,217,255,0.7)', 1.5 / I.cam.z);
    }
    const gh = VV.ghost || VV.move;
    if (gh) {
      const s = gh.o ? V.size(gh.o) : D.B[gh.type].size;
      const ok = gh.o ? V.canPlace(s, gh.c, gh.r, gh.o.id) : V.canPlace(s, gh.c, gh.r);
      gh.ok = ok;
      drawFootprint(ctx, gh.c - 0.5, gh.r - 0.5, s + 1, ok ? 'rgba(80,255,160,0.10)' : 'rgba(255,61,113,0.12)');
      drawFootprint(ctx, gh.c, gh.r, s, ok ? 'rgba(80,255,160,0.35)' : 'rgba(255,61,113,0.45)', ok ? '#50ffa0' : '#ff3d71', 2 / I.cam.z);
    }
    for (const it of VV.list) drawObj(ctx, it);
    if (gh) {
      const type = gh.o ? gh.o.t : gh.type;
      const s = gh.o ? V.size(gh.o) : D.B[type].size;
      const c = I.toIso(gh.c + s / 2, gh.r + s / 2);
      const bob = Math.sin(VV.t * 5) * 2;
      let spr;
      if (gh.o && V.isObst(gh.o)) spr = ART.obstacleSprite(type);
      else if (type === 'wall') spr = ART.wallSprite(gh.o ? gh.o.lv : 1, 0);
      else spr = ART.buildingSprite(type, gh.o ? Math.max(1, gh.o.lv) : 1);
      I.drawSprite(ctx, spr, c.x, c.y - 6 + bob, 0.8);
      if (!V.isObst(gh.o || {}) && D.B[type].range) drawRange(ctx, { t: type, c: gh.c, r: gh.r, lv: 1 });
    }
    P.draw(ctx);
    // ----- screen space -----
    I.applyScreen(ctx);
    snow(ctx, dt);
    VV.vignette(ctx);
    drawTimers(ctx);
  };

  function bar(ctx, x, y, w, frac, col, text) {
    ctx.fillStyle = 'rgba(5,8,13,0.85)'; rr(ctx, x - w / 2 - 2, y - 2, w + 4, 10, 5); ctx.fill();
    ctx.fillStyle = col; rr(ctx, x - w / 2, y, Math.max(4, w * frac), 6, 3); ctx.fill();
    if (text) {
      ctx.font = `700 12px ${FS.FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,13,0.9)'; ctx.strokeText(text, x, y - 5);
      ctx.fillStyle = '#e8f6ff'; ctx.fillText(text, x, y - 5);
    }
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  FS.rr = rr;
  const RES_ICON = { gold: '#ffcf8a', mead: '#e7a93b', rs: '#8a5cff' };
  function drawTimers(ctx) {
    const now = Date.now();
    VV.bubbles.length = 0;
    const z = I.cam.z;
    for (const b of V.st.b) {
      const s = D.B[b.t].size;
      if (b.bt) {
        const p = I.gridToScreen(b.c + s / 2, b.r + s / 2, 40 + s * 14);
        if (p.x < -50 || p.x > I.W + 50 || p.y < -30 || p.y > I.H + 30) continue;
        const frac = 1 - (b.bt.end - now) / b.bt.dur;
        bar(ctx, p.x, p.y, Math.max(44, s * 20), U.clamp(frac, 0, 1), '#00d9ff', U.fmtTime((b.bt.end - now) / 1000));
      } else if (D.B[b.t].prod && b.lv >= 1) {
        const cap = D.bv(b.t, 'cap', b.lv);
        if (b.acc >= Math.max(5, cap * 0.04)) {
          const p = I.gridToScreen(b.c + s / 2, b.r + s / 2, 50 + s * 10);
          const bob = Math.sin(VV.t * 3 + b.id) * 3;
          const full = b.acc >= cap - 0.5;
          const R = 13;
          ctx.fillStyle = 'rgba(10,15,22,0.92)'; ctx.beginPath(); ctx.arc(p.x, p.y + bob, R + 3, 0, 6.283); ctx.fill();
          ctx.strokeStyle = full ? '#ff3d71' : 'rgba(0,217,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.x - 5, p.y + bob + R + 1); ctx.lineTo(p.x, p.y + bob + R + 9); ctx.lineTo(p.x + 5, p.y + bob + R + 1); ctx.fillStyle = 'rgba(10,15,22,0.92)'; ctx.fill();
          FS.UI && FS.UI.resIcon(ctx, D.B[b.t].prod, p.x, p.y + bob, R);
          VV.bubbles.push({ b, x: p.x, y: p.y + bob, r: R + 8 });
        }
      } else if (b.t === 'forge' && V.st.lab.cur && b.lv >= 1) {
        const c = V.st.lab.cur;
        const p = I.gridToScreen(b.c + s / 2, b.r + s / 2, 40 + s * 14);
        bar(ctx, p.x, p.y, 48, U.clamp(1 - (c.end - now) / c.dur, 0, 1), '#8a5cff', U.fmtTime((c.end - now) / 1000));
      } else if (b.t === 'wolfden' && V.st.hero.up) {
        const h = V.st.hero.up;
        const p = I.gridToScreen(b.c + s / 2, b.r + s / 2, 40 + s * 14);
        bar(ctx, p.x, p.y, 48, U.clamp(1 - (h.end - now) / h.dur, 0, 1), '#8a5cff', U.fmtTime((h.end - now) / 1000));
      } else if (b.t === 'barracks' && V.st.trainQ.length && b.lv >= 1 && z > 0.25) {
        const q = V.st.trainQ[0];
        const p = I.gridToScreen(b.c + s / 2, b.r + s / 2, 36 + s * 14);
        bar(ctx, p.x, p.y, 40, U.clamp(V.st.trainProg / (D.TROOPS[q.k].time * D.TIME_SCALE), 0, 1), '#9af0ff', '');
      }
    }
    for (const o of V.st.o) {
      if (!o.clr) continue;
      const s = D.OBST[o.t].size;
      const p = I.gridToScreen(o.c + s / 2, o.r + s / 2, 50 + s * 10);
      bar(ctx, p.x, p.y, 40, U.clamp(1 - (o.clr.end - now) / o.clr.dur, 0, 1), '#ffcf8a', U.fmtTime((o.clr.end - now) / 1000));
    }
  }

  // ---------- picking ----------
  VV.pick = function (sx, sy) {
    for (const bb of VV.bubbles) if (Math.hypot(sx - bb.x, sy - bb.y) <= bb.r) return { bubble: bb.b };
    const g = I.screenToGrid(sx, sy);
    const o = V.at(Math.floor(g.x), Math.floor(g.y));
    if (o) return { o };
    // tall sprites: test the upper part of front-most buildings
    for (let i = VV.list.length - 1; i >= 0; i--) {
      const it = VV.list[i], ob = it.o, s = V.size(ob);
      if (s < 2) continue;
      const c = I.gridToScreen(ob.c + s / 2, ob.r + s / 2, 0);
      const hw = s * I.HW * I.cam.z * 0.7, top = (s * 18 + 40) * I.cam.z;
      if (sx > c.x - hw && sx < c.x + hw && sy < c.y && sy > c.y - top) return { o: ob };
    }
    return null;
  };

  // ---------- selection / placement API used by UI + input ----------
  VV.select = function (o) {
    VV.sel = o; VV.rowSel = null;
    if (o) FS.A.sfx('tap');
    FS.UI && FS.UI.onSelect(o);
  };
  VV.startPlace = function (type) {
    VV.select(null);
    const s = D.B[type].size;
    const g = I.screenToGrid(I.W / 2, I.H * 0.45);
    let c = Math.round(g.x - s / 2), r = Math.round(g.y - s / 2);
    // search a free spot near the view centre
    let best = null;
    for (let rad = 0; rad < 18 && !best; rad++) {
      for (let dy = -rad; dy <= rad && !best; dy++) for (let dx = -rad; dx <= rad && !best; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        if (V.canPlace(s, c + dx, r + dy)) best = { c: c + dx, r: r + dy };
      }
    }
    if (best) { c = best.c; r = best.r; }
    VV.ghost = { type, c, r, ok: false };
    FS.UI && FS.UI.onPlacing(true);
  };
  VV.confirmPlace = function () {
    const g = VV.ghost; if (!g) return;
    const res = V.place(g.type, g.c, g.r);
    if (!res.ok) { FS.UI.fail(res); return; }
    if (g.type === 'wall' && !V.lockReason('wall')) {
      // keep placing: move ghost one tile along
      const dir = VV.wallDir || [1, 0];
      g.c += dir[0]; g.r += dir[1];
      return;
    }
    VV.ghost = null;
    FS.UI.onPlacing(false);
    VV.select(res.b);
  };
  VV.cancelPlace = function () { VV.ghost = null; FS.UI && FS.UI.onPlacing(false); };
  VV.ghostScreen = function () {
    const g = VV.ghost || VV.move; if (!g) return null;
    const s = g.o ? V.size(g.o) : D.B[g.type].size;
    return I.gridToScreen(g.c + s / 2, g.r + s / 2, 30 + s * 16);
  };

  // ---------- input (called from main.js) ----------
  const ptrs = new Map();
  let drag = null; // {mode:'pan'|'ghost'|'move'|'wall', sx, sy, moved, ...}
  let pinch = null;
  VV.down = function (e) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: I.cam.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      if (drag && drag.mode === 'move') { VV.move = null; }
      drag = null;
      return;
    }
    const sx = e.clientX, sy = e.clientY;
    const g = I.screenToGrid(sx, sy);
    drag = { mode: 'pan', sx, sy, lx: sx, ly: sy, moved: false, t: performance.now() };
    if (VV.ghost) {
      const s = D.B[VV.ghost.type].size;
      if (g.x >= VV.ghost.c - 0.6 && g.x < VV.ghost.c + s + 0.6 && g.y >= VV.ghost.r - 0.6 && g.y < VV.ghost.r + s + 0.6) {
        drag.mode = VV.ghost.type === 'wall' ? 'wall' : 'ghost';
        drag.ox = g.x - VV.ghost.c; drag.oy = g.y - VV.ghost.r;
        drag.lastTile = VV.ghost.c + ',' + VV.ghost.r;
      }
    } else if (VV.sel) {
      const s = V.size(VV.sel);
      if (g.x >= VV.sel.c && g.x < VV.sel.c + s && g.y >= VV.sel.r && g.y < VV.sel.r + s) {
        drag.mode = 'move'; drag.ox = g.x - VV.sel.c; drag.oy = g.y - VV.sel.r;
      }
    }
  };
  VV.movePtr = function (e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      I.zoomAt(cx, cy, (pinch.z * d / pinch.d) / I.cam.z);
      I.pan(cx - pinch.cx, cy - pinch.cy);
      pinch.cx = cx; pinch.cy = cy;
      return;
    }
    if (!drag) return;
    const sx = e.clientX, sy = e.clientY;
    if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) > 8) drag.moved = true;
    if (!drag.moved) return;
    const g = I.screenToGrid(sx, sy);
    if (drag.mode === 'pan') { I.pan(sx - drag.lx, sy - drag.ly); }
    else if (drag.mode === 'ghost') { VV.ghost.c = Math.round(g.x - drag.ox); VV.ghost.r = Math.round(g.y - drag.oy); }
    else if (drag.mode === 'wall') {
      const c = Math.floor(g.x), r = Math.floor(g.y), key = c + ',' + r;
      if (key !== drag.lastTile) {
        const [pc, pr] = drag.lastTile.split(',').map(Number);
        // walk tile by tile along the dominant axis, painting walls
        const dc = Math.sign(c - pc), dr = Math.sign(r - pr);
        let cc = pc, rr2 = pr, guard = 0;
        while ((cc !== c || rr2 !== r) && guard++ < 50) {
          if (cc !== c && (Math.abs(c - cc) >= Math.abs(r - rr2) || rr2 === r)) cc += dc; else rr2 += dr;
          VV.wallDir = [cc - VV.ghost.c, rr2 - VV.ghost.r];
          VV.ghost.c = cc; VV.ghost.r = rr2;
          if (V.canPlace(1, cc, rr2) && !V.lockReason('wall')) {
            const res = V.place('wall', cc, rr2);
            if (!res.ok) { FS.UI.fail(res); drag.mode = 'ghost'; break; }
          }
        }
        drag.lastTile = key;
      }
    } else if (drag.mode === 'move') {
      if (!VV.move) VV.move = { o: VV.sel, c: VV.sel.c, r: VV.sel.r };
      VV.move.c = Math.round(g.x - drag.ox); VV.move.r = Math.round(g.y - drag.oy);
    }
    drag.lx = sx; drag.ly = sy;
  };
  VV.up = function (e) {
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'move' && VV.move) {
      const m = VV.move; VV.move = null;
      if (m.c !== m.o.c || m.r !== m.o.r) { if (!V.move(m.o, m.c, m.r)) { FS.A.sfx('no'); } }
      return;
    }
    if (d.moved) return;
    // tap
    if (VV.ghost) {
      if (d.mode === 'ghost' || d.mode === 'wall') return;
      const g = I.screenToGrid(d.sx, d.sy); const s = D.B[VV.ghost.type].size;
      VV.ghost.c = Math.floor(g.x - s / 2 + 0.5); VV.ghost.r = Math.floor(g.y - s / 2 + 0.5);
      return;
    }
    const hit = VV.pick(d.sx, d.sy);
    if (hit && hit.bubble) { V.collect(hit.bubble); VV.select(hit.bubble); return; }
    if (hit && hit.o) {
      if (!V.isObst(hit.o) && D.B[hit.o.t].prod && hit.o.acc >= 1 && !hit.o.bt) V.collect(hit.o);
      VV.select(hit.o);
    } else VV.select(null);
  };
  VV.cancelPtr = function (e) { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; drag = null; VV.move = null; };
  VV.wheel = function (e) { I.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); };
})(window.FS = window.FS || {});
