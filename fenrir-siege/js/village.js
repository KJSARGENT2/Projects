/* Fenrir Siege — home village model: buildings, placement, resources, builders,
   timers, production, obstacles, walls, XP and achievements. Rendering lives in
   villageView.js; this file is pure state + rules. */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U;
  const G = D.GRID;
  const V = FS.V = { st: null, occ: new Int32Array(G * G), index: new Map(), dirty: true };
  FS.fxq = [];                       // visual events for the renderer
  FS.toast = FS.toast || function () {};
  const fx = (e) => { FS.fxq.push(e); if (FS.fxq.length > 200) FS.fxq.shift(); };
  V.fx = fx;

  // ---------- new game ----------
  V.newGame = function (name) {
    const st = {
      v: 1, name: name || 'Wolfkin', created: Date.now(), lastSeen: Date.now(),
      xp: 0, plv: 1, trophies: 0, best: 0,
      gold: D.START.gold, mead: D.START.mead, rs: D.START.rs, gems: D.START.gems,
      nextId: 1, b: [], o: [],
      army: { wolf: 15 }, trainQ: [], trainProg: 0,
      spells: {}, brewQ: [], brewProg: 0,
      lab: { lv: {}, cur: null },
      hero: { lv: 0, hp: 0, up: null },
      shieldEnd: 0, log: [], logUnread: 0,
      stats: { wins: 0, stars: 0, lootGold: 0, lootMead: 0, cleared: 0, walls: 0, defWins: 0, trained: 0, raids: 0 },
      ach: {}, obstT: 0,
    };
    V.st = st;
    const add = (t, c, r) => { const b = { id: st.nextId++, t, lv: 1, c, r, bt: null, acc: 0 }; st.b.push(b); return b; };
    add('hall', 20, 20);
    add('ballista', 24, 16);
    add('builder', 17, 17);
    add('builder', 25, 21);
    add('goldmint', 15, 21).acc = 300;
    add('meadbrew', 19, 25).acc = 300;
    add('barracks', 23, 25);
    add('camp', 14, 26);
    V.recalc();
    const rng = U.rng(Date.now() >>> 0);
    for (let i = 0; i < 14; i++) V.spawnObstacle(rng, true);
    return st;
  };

  // ---------- indexing ----------
  V.recalc = function () {
    const st = V.st;
    V.occ.fill(0); V.index.clear();
    for (const b of st.b) { V.index.set(b.id, b); V.mark(b, b.id); }
    for (const o of st.o) { V.index.set(o.id, o); V.mark(o, o.id); }
    V.dirty = true;
  };
  V.size = (o) => (o.t in D.OBST ? D.OBST[o.t].size : D.B[o.t].size);
  V.isObst = (o) => o.t in D.OBST;
  V.mark = function (o, val) {
    const s = V.size(o);
    for (let y = o.r; y < o.r + s; y++) for (let x = o.c; x < o.c + s; x++) if (x >= 0 && y >= 0 && x < G && y < G) V.occ[y * G + x] = val;
  };
  V.at = function (c, r) { if (c < 0 || r < 0 || c >= G || r >= G) return null; const id = V.occ[r * G + c]; return id ? V.index.get(id) : null; };
  V.canPlace = function (size, c, r, ignoreId) {
    if (c < 1 || r < 1 || c + size > G - 1 || r + size > G - 1) return false;
    for (let y = r; y < r + size; y++) for (let x = c; x < c + size; x++) { const id = V.occ[y * G + x]; if (id && id !== ignoreId) return false; }
    return true;
  };

  // ---------- queries ----------
  V.hall = () => V.st.b.find((b) => b.t === 'hall');
  V.hallLv = () => { const h = V.hall(); return h ? Math.max(1, h.lv) : 1; };
  V.count = (type) => V.st.b.reduce((n, b) => n + (b.t === type ? 1 : 0), 0);
  V.maxCount = (type) => (type === 'builder' ? D.MAX_BUILDERS : D.maxCount(type, V.hallLv()));
  V.maxLevel = (type) => Math.min(D.levels(type), D.maxLevel(type, V.hallLv()));
  V.caps = function () {
    const cap = { gold: 0, mead: 0, rs: 0 };
    for (const b of V.st.b) {
      const st = D.B[b.t].store;
      if (!st || b.lv < 1) continue;
      for (const k in st) cap[k] += st[k][Math.min(st[k].length, b.lv) - 1];
    }
    return cap;
  };
  V.builders = function () {
    const st = V.st;
    const total = st.b.filter((b) => b.t === 'builder' && b.lv >= 1).length;
    let busy = st.b.filter((b) => b.bt).length + st.o.filter((o) => o.clr).length + (st.hero.up ? 1 : 0);
    return { total, busy, free: Math.max(0, total - busy) };
  };
  V.has = (res, n) => (V.st[res] || 0) >= n;
  V.spend = function (res, n) { if (!V.has(res, n)) return false; V.st[res] -= n; return true; };
  // add with storage caps; returns the amount actually stored
  V.add = function (res, n) {
    if (n <= 0) return 0;
    if (res === 'gems') { V.st.gems += n; return n; }
    const cap = V.caps()[res];
    const before = V.st[res];
    V.st[res] = Math.min(Math.max(cap, before), before + n);
    return V.st[res] - before;
  };
  V.costOf = function (b) { // cost of the next level of b
    const to = b.lv + 1;
    return { res: D.B[b.t].res, amt: D.bv(b.t, 'cost', to), time: D.btime(b.t, to), to };
  };
  V.buildCost = function (type) {
    if (type === 'builder') return { res: 'gems', amt: D.BUILDER_GEMS[Math.min(D.BUILDER_GEMS.length - 1, V.count('builder'))] || 0, time: 0 };
    return { res: D.B[type].res, amt: D.bv(type, 'cost', 1), time: D.btime(type, 1) };
  };
  V.lockReason = function (type) {
    const n = V.count(type), max = V.maxCount(type);
    if (max <= 0) { let h = 1; while (h <= D.MAX_HALL && D.maxCount(type, h) <= 0) h++; return 'Needs Great Hall ' + h; }
    if (n >= max) { if (type === 'builder') return 'All builders hired'; let h = V.hallLv() + 1; while (h <= D.MAX_HALL && D.maxCount(type, h) <= n) h++; return h > D.MAX_HALL ? 'Maximum reached' : 'Great Hall ' + h + ' for more'; }
    return '';
  };

  // ---------- XP / achievements ----------
  V.addXP = function (n) {
    const st = V.st;
    st.xp += n;
    while (st.xp >= D.xpNeed(st.plv)) {
      st.xp -= D.xpNeed(st.plv); st.plv++;
      st.gems += D.LEVEL_GEMS;
      FS.toast('Level ' + st.plv + '! +' + D.LEVEL_GEMS + ' gems', 'good');
    }
  };
  V.statValue = function (stat) {
    if (stat === 'hallLv') return V.hallLv();
    if (stat === 'heroLv') return V.st.hero.lv;
    return V.st.stats[stat] || 0;
  };
  V.achState = function (a) {
    const claimed = V.st.ach[a.id] || 0;
    const val = V.statValue(a.stat);
    const next = a.tiers[claimed];
    return { claimed, val, next, done: claimed >= a.tiers.length, ready: next != null && val >= next, gems: a.gems[claimed] };
  };
  V.claimAch = function (a) {
    const s = V.achState(a);
    if (!s.ready) return false;
    V.st.ach[a.id] = s.claimed + 1;
    V.st.gems += s.gems;
    FS.A.sfx('done');
    FS.toast(a.name + ' +' + s.gems + ' gems', 'good');
    return true;
  };
  V.achReady = () => D.ACH.reduce((n, a) => n + (V.achState(a).ready ? 1 : 0), 0);

  // ---------- construction ----------
  V.place = function (type, c, r) {
    const st = V.st;
    const size = D.B[type].size;
    if (V.lockReason(type)) return { ok: false, msg: V.lockReason(type) };
    if (!V.canPlace(size, c, r)) return { ok: false, msg: 'Something is in the way' };
    const cost = V.buildCost(type);
    if (!V.has(cost.res, cost.amt)) return { ok: false, msg: 'Not enough ' + D.RES[cost.res].name.toLowerCase(), need: cost };
    const instant = type === 'wall' || type === 'builder' || cost.time <= 0;
    if (!instant && V.builders().free <= 0) return { ok: false, msg: 'All builders are busy', builders: true };
    V.spend(cost.res, cost.amt);
    const b = { id: st.nextId++, t: type, lv: instant ? 1 : 0, c, r, bt: null, acc: 0, born: performance.now() };
    if (!instant) { const dur = cost.time * 1000; b.bt = { end: Date.now() + dur, dur, to: 1 }; }
    st.b.push(b);
    V.index.set(b.id, b); V.mark(b, b.id); V.dirty = true;
    if (type === 'wall') st.stats.walls = (st.stats.walls || 0) + 1;
    if (instant) { V.addXP(1); fx({ k: 'place', id: b.id }); }
    else fx({ k: 'place', id: b.id });
    FS.A.sfx(instant ? 'place' : 'build');
    return { ok: true, b };
  };
  V.upgrade = function (b) {
    if (b.bt) return { ok: false, msg: 'Already building' };
    const max = V.maxLevel(b.t);
    if (b.lv >= D.levels(b.t)) return { ok: false, msg: 'Maximum level' };
    if (b.lv >= max) return { ok: false, msg: 'Upgrade the Great Hall first' };
    if (b.t === 'forge' && V.st.lab.cur) return { ok: false, msg: 'Research in progress' };
    const cost = V.costOf(b);
    if (!V.has(cost.res, cost.amt)) return { ok: false, msg: 'Not enough ' + D.RES[cost.res].name.toLowerCase(), need: cost };
    if (b.t === 'wall') {
      if (V.builders().free <= 0) return { ok: false, msg: 'Walls need a free builder', builders: true };
      V.spend(cost.res, cost.amt); b.lv++; fx({ k: 'sparkle', id: b.id }); V.addXP(1); FS.A.sfx('place'); V.dirty = true;
      return { ok: true };
    }
    if (V.builders().free <= 0) return { ok: false, msg: 'All builders are busy', builders: true };
    V.spend(cost.res, cost.amt);
    const dur = cost.time * 1000;
    b.bt = { end: Date.now() + dur, dur, to: cost.to };
    FS.A.sfx('build');
    fx({ k: 'puff', id: b.id });
    return { ok: true };
  };
  V.finish = function (b) {
    const to = b.bt.to;
    const sec = b.bt.dur / 1000;
    b.lv = to; b.bt = null;
    V.addXP(D.xpFor(sec));
    fx({ k: 'sparkle', id: b.id });
    FS.A.sfx('done');
    FS.toast(D.B[b.t].name + (to > 1 ? ' reached level ' + to : ' built'), 'good');
    if (b.t === 'wolfden' && V.st.hero.lv < 1) { V.st.hero.lv = 1; V.st.hero.hp = D.HERO.hp(1); FS.toast('Fenrir has joined the clan!', 'good'); }
    V.dirty = true;
  };
  V.remaining = (b) => (b.bt ? Math.max(0, (b.bt.end - Date.now()) / 1000) : 0);
  V.speedUp = function (b) {
    const g = D.speedGems(V.remaining(b));
    if (!V.spend('gems', g)) return { ok: false, msg: 'Not enough gems' };
    b.bt.end = Date.now();
    V.finish(b);
    return { ok: true };
  };
  V.cancel = function (b) {
    if (!b.bt) return;
    const lvCost = D.bv(b.t, 'cost', b.bt.to), res = D.B[b.t].res;
    V.add(res, Math.floor(lvCost * 0.5));
    if (b.lv < 1) { V.remove(b); }
    b.bt = null;
    V.dirty = true;
    FS.toast('Cancelled — 50% refunded', 'info');
  };
  V.remove = function (o) {
    const st = V.st;
    V.mark(o, 0); V.index.delete(o.id);
    if (V.isObst(o)) st.o = st.o.filter((x) => x !== o); else st.b = st.b.filter((x) => x !== o);
    V.dirty = true;
  };
  V.move = function (o, c, r) {
    if (!V.canPlace(V.size(o), c, r, o.id)) return false;
    V.mark(o, 0); o.c = c; o.r = r; V.mark(o, o.id); V.dirty = true;
    fx({ k: 'place', id: o.id });
    FS.A.sfx('place');
    return true;
  };

  // ---------- collectors ----------
  V.collect = function (b) {
    const def = D.B[b.t];
    if (!def.prod || b.acc < 1) return 0;
    const got = V.add(def.prod, Math.floor(b.acc));
    if (got <= 0) { FS.toast(D.RES[def.prod].name + ' storage is full', 'bad'); return 0; }
    b.acc -= got;
    fx({ k: 'float', id: b.id, text: '+' + U.fmt(got), col: D.RES[def.prod].col, res: def.prod });
    FS.A.sfx('coin');
    return got;
  };
  V.collectAll = function () { let n = 0; for (const b of V.st.b) if (D.B[b.t].prod && b.acc >= 1) n += V.collect(b); return n; };

  // ---------- walls ----------
  V.wallRow = function (w) {
    const run = (dx, dy) => {
      const out = [];
      let c = w.c + dx, r = w.r + dy;
      for (;;) { const o = V.at(c, r); if (!o || o.t !== 'wall' || o.lv !== w.lv || o.bt) break; out.push(o); c += dx; r += dy; }
      return out;
    };
    const hx = run(1, 0).concat(run(-1, 0)), hy = run(0, 1).concat(run(0, -1));
    return [w].concat(hx.length >= hy.length ? hx : hy);
  };
  V.upgradeWalls = function (list) {
    const lv = list[0].lv;
    if (lv >= V.maxLevel('wall')) return { ok: false, msg: 'Upgrade the Great Hall first' };
    const per = D.bv('wall', 'cost', lv + 1), total = per * list.length;
    if (V.builders().free <= 0) return { ok: false, msg: 'Walls need a free builder', builders: true };
    if (!V.has('gold', total)) return { ok: false, msg: 'Not enough gold', need: { res: 'gold', amt: total } };
    V.spend('gold', total);
    for (const w of list) { w.lv++; fx({ k: 'sparkle', id: w.id }); }
    V.addXP(list.length);
    FS.A.sfx('done');
    V.dirty = true;
    return { ok: true };
  };

  // ---------- obstacles ----------
  V.spawnObstacle = function (rng, initial) {
    const st = V.st;
    const r0 = rng || Math.random;
    const R = typeof r0.range === 'function' ? r0 : Object.assign(() => Math.random(), { range: U.rand, int: U.randi });
    const t = D.OBST_TYPES[Math.floor(R() * D.OBST_TYPES.length)];
    const size = D.OBST[t].size;
    for (let i = 0; i < 60; i++) {
      const c = Math.floor(R() * (G - 4)) + 2, r = Math.floor(R() * (G - 4)) + 2;
      if (initial && Math.abs(c - 21) < 9 && Math.abs(r - 21) < 9) continue;
      if (!V.canPlace(size, c, r)) continue;
      const o = { id: st.nextId++, t, c, r, clr: null };
      st.o.push(o); V.index.set(o.id, o); V.mark(o, o.id); V.dirty = true;
      return o;
    }
    return null;
  };
  V.clear = function (o) {
    if (o.clr) return { ok: false, msg: 'Already clearing' };
    const d = D.OBST[o.t];
    if (V.builders().free <= 0) return { ok: false, msg: 'All builders are busy', builders: true };
    if (!V.has(d.res, d.cost)) return { ok: false, msg: 'Not enough ' + D.RES[d.res].name.toLowerCase(), need: { res: d.res, amt: d.cost } };
    V.spend(d.res, d.cost);
    const dur = d.time * D.TIME_SCALE * 1000;
    o.clr = { end: Date.now() + dur, dur };
    FS.A.sfx('build');
    return { ok: true };
  };
  function finishClear(o) {
    const d = D.OBST[o.t];
    const gems = U.randi(d.gems[0], d.gems[1]);
    fx({ k: 'puff', c: o.c + V.size(o) / 2, r: o.r + V.size(o) / 2, size: V.size(o) });
    if (gems > 0) { V.st.gems += gems; fx({ k: 'float', c: o.c + V.size(o) / 2, r: o.r + V.size(o) / 2, text: '+' + gems, col: D.RES.gems.col, res: 'gems' }); }
    V.st.stats.cleared = (V.st.stats.cleared || 0) + 1;
    V.addXP(1);
    V.remove(o);
    FS.A.sfx('coin');
  }

  // ---------- tick (real time; also used for offline catch-up) ----------
  V.tick = function (dt) {
    const st = V.st, now = Date.now();
    for (const b of st.b) {
      if (b.bt) { if (b.bt.end <= now) V.finish(b); continue; }
      const def = D.B[b.t];
      if (def.prod && b.lv >= 1) {
        const rate = D.bv(b.t, 'rate', b.lv) * D.PROD_SCALE / D.TIME_SCALE / 3600;
        const cap = D.bv(b.t, 'cap', b.lv);
        b.acc = Math.min(cap, (b.acc || 0) + rate * dt);
      }
    }
    for (const o of st.o.slice()) if (o.clr && o.clr.end <= now) finishClear(o);
    st.obstT = (st.obstT || 0) + dt;
    const every = D.OBSTACLE_EVERY * D.TIME_SCALE;
    let spawned = 0;
    while (st.obstT >= every) { st.obstT -= every; if (st.o.length < D.OBSTACLE_MAX && spawned < 8) { V.spawnObstacle(); spawned++; } }
    if (FS.army) FS.army.tick(dt, now);
    st.lastSeen = now;
  };
})(window.FS = window.FS || {});
