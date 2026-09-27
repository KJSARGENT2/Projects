/* Fenrir Siege — battle: AI village generation, matchmaking, the raid engine
   (ported from the original single-file game to grid space + iso rendering),
   deterministic fixed-step simulation (used for live raids, headless AI raids on
   the home village and their replays), deploy input and battle rendering. */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U, I = FS.iso, ART = FS.art, P = FS.P;
  const G = D.GRID, N = G * G;
  const BT = FS.battle = { cur: null };
  const idx = (c, r) => r * G + c;
  const inMap = (c, r) => c >= 0 && r >= 0 && c < G && r < G;

  // =====================================================================
  // Village generation (seeded)
  // =====================================================================
  BT.villageName = (rng) => rng.pick(D.NAME_A) + rng.pick(D.NAME_B);
  BT.genVillage = function (hall, seed) {
    const rng = U.rng(seed);
    const occ = new Int32Array(N);
    const out = [];
    const H = hall;
    const lvOf = (t) => Math.max(1, D.maxLevel(t, H) - rng.int(t === 'hall' ? 0 : H <= 2 ? 1 : 0, t === 'hall' ? 0 : 2));
    const fits = (s, c, r, pad) => {
      for (let y = r - pad; y < r + s + pad; y++) for (let x = c - pad; x < c + s + pad; x++) {
        if (x < 2 || y < 2 || x >= G - 2 || y >= G - 2) return false;
        if (occ[idx(x, y)]) return false;
      }
      return true;
    };
    const put = (t, c, r, lv) => {
      const s = D.B[t].size; const id = out.length + 1;
      for (let y = r; y < r + s; y++) for (let x = c; x < c + s; x++) occ[idx(x, y)] = id;
      const b = { t, lv: lv || lvOf(t), c, r }; out.push(b); return b;
    };
    const CX = 22, CY = 22;
    const spiral = (t, minR, avoid, pad) => {
      const s = D.B[t].size;
      for (let rad = minR; rad < 22; rad++) {
        const cand = [];
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === rad) cand.push([dx, dy]);
        rng.shuffle(cand);
        for (const [dx, dy] of cand) {
          const c = Math.round(CX + dx - s / 2), r = Math.round(CY + dy - s / 2);
          if (avoid && c + s > avoid.c0 - 1 && c < avoid.c1 + 2 && r + s > avoid.r0 - 1 && r < avoid.r1 + 2) continue;
          if (fits(s, c, r, pad)) return put(t, c, r);
        }
      }
      return null;
    };
    put('hall', CX - 2, CY - 2, H);
    const many = (t) => D.maxCount(t, H);
    const defs = [], stor = [], outer = [];
    // young villages are a little under-built so new chieftains can win their first raids
    const trim = H <= 2 ? 1 : 0;
    const nDef = (t) => Math.max(t === 'ballista' ? 1 : 0, many(t) - (trim ? rng.int(0, trim) : 0));
    for (const t of ['catapult', 'storm', 'harpoon', 'frost']) for (let i = 0; i < nDef(t); i++) defs.push(t);
    for (const t of ['arrow', 'ballista']) for (let i = 0; i < nDef(t); i++) (rng() < 0.55 ? defs : outer).push(t);
    for (const t of ['goldvault', 'meadcellar', 'rsvault']) for (let i = 0; i < many(t); i++) stor.push(t);
    for (const t of ['goldmint', 'meadbrew', 'rsdrill']) for (let i = 0; i < Math.max(1, many(t) - rng.int(0, 1)); i++) if (many(t) > 0) outer.push(t);
    for (const t of ['barracks', 'camp', 'forge', 'seidr', 'wolfden']) for (let i = 0; i < many(t); i++) outer.push(t);
    for (let i = 0; i < rng.int(2, Math.min(4, 1 + H)); i++) outer.push('builder');
    const core = rng.shuffle(defs.concat(stor));
    const pad = H <= 2 ? 0 : 0;
    for (const t of core) spiral(t, 1, null, pad);
    // bbox of core → wall ring
    let c0 = 99, r0 = 99, c1 = -1, r1 = -1;
    for (const b of out) { const s = D.B[b.t].size; c0 = Math.min(c0, b.c); r0 = Math.min(r0, b.r); c1 = Math.max(c1, b.c + s - 1); r1 = Math.max(r1, b.r + s - 1); }
    let walls = D.maxCount('wall', H);
    const wlv = Math.max(1, D.maxLevel('wall', H) - rng.int(0, 1));
    const ring = (R, budget) => {
      // walk the rectangle perimeter in order so openings are contiguous
      const tiles = [];
      for (let c = R.c0; c <= R.c1; c++) tiles.push([c, R.r0]);
      for (let r = R.r0 + 1; r <= R.r1; r++) tiles.push([R.c1, r]);
      for (let c = R.c1 - 1; c >= R.c0; c--) tiles.push([c, R.r1]);
      for (let r = R.r1 - 1; r > R.r0; r--) tiles.push([R.c0, r]);
      const free = tiles.filter(([c, r]) => inMap(c, r) && !occ[idx(c, r)]);
      if (!free.length || budget < 8) return 0;
      const missing = Math.max(0, free.length - budget);
      const nOpen = missing > 0 ? U.clamp(Math.ceil(missing / 7), 1, 4) : (H <= 3 ? 1 : 0);
      const skip = new Set();
      if (nOpen) {
        let left = Math.max(missing, nOpen);
        const start = rng.int(0, free.length - 1);
        for (let k = 0; k < nOpen; k++) {
          const size = k === nOpen - 1 ? left : Math.max(1, Math.round(left / (nOpen - k)));
          left -= size;
          const at = (start + Math.floor(k * free.length / nOpen)) % free.length;
          for (let j = 0; j < size; j++) skip.add((at + j) % free.length);
        }
      }
      let used = 0;
      for (let i = 0; i < free.length && used < budget; i++) { if (skip.has(i)) continue; put('wall', free[i][0], free[i][1], wlv); used++; }
      return used;
    };
    const gap = rng() < 0.5 ? 1 : 2;
    const R1 = { c0: c0 - gap, r0: r0 - gap, c1: c1 + gap, r1: r1 + gap };
    if (walls > 0) walls -= ring(R1, walls);
    for (const t of rng.shuffle(outer)) spiral(t, 2, R1, rng() < 0.5 ? 1 : 0) || spiral(t, 2, null, 0);
    if (H >= 4 && walls > 40) {
      let a0 = 99, b0 = 99, a1 = -1, b1 = -1;
      for (const b of out) { const s = D.B[b.t].size; a0 = Math.min(a0, b.c); b0 = Math.min(b0, b.r); a1 = Math.max(a1, b.c + s - 1); b1 = Math.max(b1, b.r + s - 1); }
      ring({ c0: a0 - 1, r0: b0 - 1, c1: a1 + 1, r1: b1 + 1 }, walls);
    }
    // traps inside the ring area
    const traps = [];
    for (const t of ['runemine', 'pitfall', 'skysnare']) for (let i = 0; i < many(t); i++) traps.push(t);
    for (const t of traps) {
      for (let k = 0; k < 80; k++) {
        const c = rng.int(R1.c0 - 3, R1.c1 + 3), r = rng.int(R1.r0 - 3, R1.r1 + 3);
        if (fits(1, c, r, 0)) { put(t, c, r); break; }
      }
    }
    return out;
  };

  BT.genMatch = function (player) {
    const seed = U.seed();
    const rng = U.rng(seed);
    const ph = player.hall;
    let hall = U.clamp(ph + rng.pick([-1, 0, 0, 0, 1]), 1, D.MAX_HALL);
    if (player.trophies < 60 && hall > ph) hall = ph;
    const layout = BT.genVillage(hall, seed ^ 0x9e3779b9);
    const H = D.hallIdx(hall);
    // resources in the enemy's storages
    const lootPct = D.LOOT_STORAGE[H];
    const tot = { gold: 0, mead: 0, rs: 0 };
    const hallB = layout.find((b) => b.t === 'hall');
    const vaults = { gold: [], mead: [], rs: [] };
    for (const b of layout) {
      const st = D.B[b.t].store;
      if (st) for (const k in st) { const cap = st[k][Math.min(st[k].length, b.lv) - 1]; if (cap > 0) { const fill = rng.range(0.35, 0.95) * cap; tot[k] += fill; if (b.t !== 'hall') vaults[k].push(b); } }
    }
    for (const k of ['gold', 'mead', 'rs']) {
      const lootable = tot[k] * lootPct;
      if (lootable <= 0) continue;
      const hallShare = vaults[k].length ? D.LOOT_HALL_SHARE : 1;
      hallB.loot = hallB.loot || {}; hallB.loot[k] = Math.round(lootable * hallShare);
      for (const v of vaults[k]) { v.loot = v.loot || {}; v.loot[k] = Math.round(lootable * (1 - hallShare) / vaults[k].length); }
    }
    for (const b of layout) {
      const def = D.B[b.t];
      if (def.prod) { const cap = D.bv(b.t, 'cap', b.lv); b.loot = { [def.prod]: Math.round(cap * rng.range(0.2, 1) * D.LOOT_COLLECTOR) }; }
    }
    const lootTotal = { gold: 0, mead: 0, rs: 0 };
    for (const b of layout) if (b.loot) for (const k in b.loot) lootTotal[k] += b.loot[k];
    const trophies = Math.max(0, player.trophies + rng.int(-90, 110));
    const diff = trophies - player.trophies;
    const offer = { win: U.clamp(Math.round(26 + diff / 14), 8, 45), lose: U.clamp(Math.round(18 - diff / 18), 5, 35) };
    return { seed, name: BT.villageName(rng), chief: rng.pick(D.CHIEF), hall, trophies, layout, lootTotal, offer };
  };

  // the player's own village as a defender layout (for AI raids / replays)
  BT.playerLayout = function () {
    const V = FS.V, st = V.st, H = D.hallIdx(V.hallLv());
    const out = [];
    const lootPct = D.LOOT_STORAGE[H];
    const vaults = { gold: [], mead: [], rs: [] };
    for (const b of st.b) {
      if (b.lv < 1) continue;
      const e = { t: b.t, lv: b.lv, c: b.c, r: b.r, id: b.id, up: !!b.bt };
      out.push(e);
      const s = D.B[b.t].store;
      if (s && b.t !== 'hall') for (const k in s) vaults[k].push(e);
      if (D.B[b.t].prod) e.loot = { [D.B[b.t].prod]: Math.floor((b.acc || 0) * D.LOOT_COLLECTOR) };
    }
    const hallE = out.find((e) => e.t === 'hall');
    for (const k of ['gold', 'mead', 'rs']) {
      const lootable = Math.floor(st[k] * lootPct);
      if (lootable <= 0) continue;
      const hs = vaults[k].length ? D.LOOT_HALL_SHARE : 1;
      if (hallE) { hallE.loot = hallE.loot || {}; hallE.loot[k] = Math.floor(lootable * hs); }
      for (const v of vaults[k]) { v.loot = v.loot || {}; v.loot[k] = Math.floor(lootable * (1 - hs) / vaults[k].length); }
    }
    return out;
  };

  // =====================================================================
  // Battle state
  // =====================================================================
  BT.create = function (o) {
    const bt = {
      mode: o.mode, vis: o.mode !== 'sim', seed: o.seed >>> 0, rng: U.rng(o.seed >>> 0),
      t: 0, timeLeft: D.BATTLE_TIME, over: false, result: null, acc: 0, speed: 1,
      S: [], occ: new Int16Array(N), ver: 1, exVer: 0, ex: new Float32Array(N),
      units: [], proj: [], zaps: [], zones: [], bolts: [],
      total: 0, destroyed: 0, hallDown: false, stars: [false, false, false], starT: [0, 0, 0],
      lootAvail: { gold: 0, mead: 0, rs: 0 }, lootGot: { gold: 0, mead: 0, rs: 0 },
      tray: [], sel: 0, used: {}, spellsUsed: {}, deployed: 0, heroUnit: null, heroUsed: false, abilityUsed: false,
      forbid: new Uint8Array(N), forbidVer: -1, forbidPath: null, forbidEdge: null, noFlash: 0,
      endGrace: -1, rageT: 0, shake: 0, plan: o.plan || null, planI: 0,
      team: o.mode === 'attack' ? 'ally' : 'enemy', info: o.info || {}, unitId: 1,
      troopLv: o.troopLv || {}, spellLv: o.spellLv || {}, heroLv: o.heroLv || 0,
      theme: o.theme || 'enemy', owned: !!o.owned, startDelay: 0,
    };
    for (const b of o.layout) addStruct(bt, b);
    bt.total = bt.S.filter((s) => s.counts).length;
    for (const s of bt.S) if (s.loot) for (const k in s.loot) bt.lootAvail[k] += s.loot[k];
    bt.lootStart = Object.assign({}, bt.lootAvail);
    bt.draw = bt.S.slice().sort((a, b) => (a.c + a.r + a.w) - (b.c + b.r + b.w));
    if (o.army) {
      for (const k of D.TROOP_ORDER) if (o.army[k] > 0) bt.tray.push({ kind: 'troop', k, n: o.army[k] });
      if (o.hero) bt.tray.push({ kind: 'hero', k: 'hero', n: 1, hp: o.hero.hp, lv: o.hero.lv });
      if (o.spells) for (const k of D.SPELL_ORDER) if (o.spells[k] > 0) bt.tray.push({ kind: 'spell', k, n: o.spells[k] });
    }
    bt.sel = 0;
    computeForbid(bt);
    return bt;
  };
  function addStruct(bt, b) {
    const d = D.B[b.t];
    const w = d.size;
    const s = {
      id: bt.S.length, t: b.t, lv: b.lv, c: b.c, r: b.r, w, cx: b.c + w / 2, cy: b.r + w / 2, d, kind: d.cat,
      hp: D.bv(b.t, 'hp', b.lv), max: D.bv(b.t, 'hp', b.lv), dead: false, flash: 0, dieT: 0,
      cd: 0.3 + (bt.S.length % 7) * 0.1, aim: (bt.S.length * 1.7) % 6.28, tgt: null, fire: 0, frozen: 0,
      hidden: d.cat === 'trap', counts: d.cat !== 'wall' && d.cat !== 'trap', ff: null, ffv: 0,
      inactive: !!b.up && d.cat === 'def', srcId: b.id,
      loot: b.loot ? Object.assign({}, b.loot) : null, lootMax: b.loot ? Object.assign({}, b.loot) : null,
    };
    if (d.cat === 'def') { s.dps = D.bv(b.t, 'dps', b.lv); s.range = d.range; }
    bt.S.push(s);
    if (d.cat !== 'trap') for (let y = s.r; y < s.r + w; y++) for (let x = s.c; x < s.c + w; x++) if (inMap(x, y)) bt.occ[idx(x, y)] = s.id + 1;
    return s;
  }
  function computeForbid(bt) {
    const F = bt.forbid; F.fill(0);
    for (const s of bt.S) {
      if (s.dead || s.kind === 'trap') continue;
      for (let y = s.r - 1; y <= s.r + s.w; y++) for (let x = s.c - 1; x <= s.c + s.w; x++) if (inMap(x, y)) F[idx(x, y)] = 1;
    }
    bt.forbidVer = bt.ver;
    if (!bt.vis) return;
    const fill = new Path2D(), edge = new Path2D();
    const HWp = I.HW, HHp = I.HH;
    const pt = (c, r) => [(c - r) * HWp, (c + r) * HHp];
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      if (!F[idx(c, r)]) continue;
      const a = pt(c, r), b = pt(c + 1, r), cc = pt(c + 1, r + 1), d = pt(c, r + 1);
      fill.moveTo(a[0], a[1]); fill.lineTo(b[0], b[1]); fill.lineTo(cc[0], cc[1]); fill.lineTo(d[0], d[1]); fill.closePath();
      if (r === 0 || !F[idx(c, r - 1)]) { edge.moveTo(a[0], a[1]); edge.lineTo(b[0], b[1]); }
      if (c === G - 1 || !F[idx(c + 1, r)]) { edge.moveTo(b[0], b[1]); edge.lineTo(cc[0], cc[1]); }
      if (r === G - 1 || !F[idx(c, r + 1)]) { edge.moveTo(d[0], d[1]); edge.lineTo(cc[0], cc[1]); }
      if (c === 0 || !F[idx(c - 1, r)]) { edge.moveTo(a[0], a[1]); edge.lineTo(d[0], d[1]); }
    }
    bt.forbidPath = fill; bt.forbidEdge = edge;
  }
  BT.canDeploy = (bt, gx, gy) => gx >= 0.2 && gy >= 0.2 && gx < G - 0.2 && gy < G - 0.2 && !bt.forbid[idx(Math.floor(gx), Math.floor(gy))];

  // =====================================================================
  // Engine
  // =====================================================================
  function distRect(x, y, s) {
    const dx = Math.max(s.c - x, 0, x - (s.c + s.w)), dy = Math.max(s.r - y, 0, y - (s.r + s.w));
    return Math.hypot(dx, dy);
  }
  function exArr(bt) {
    if (bt.exVer === bt.ver) return bt.ex;
    const ex = bt.ex;
    for (let i = 0; i < N; i++) {
      const o = bt.occ[i];
      if (!o) { ex[i] = 0; continue; }
      const s = bt.S[o - 1];
      ex[i] = (!s || s.dead) ? 0 : s.kind === 'wall' ? 10 + Math.min(10, s.max / 300) : 18;
    }
    bt.exVer = bt.ver;
    return ex;
  }
  const heapI = new Int32Array(N * 8), heapD = new Float32Array(N * 8);
  function field(bt, s) {
    if (s.ff && s.ffv === bt.ver) return s.ff;
    const Dd = s.ff || new Float32Array(N);
    Dd.fill(1e9);
    const ex = exArr(bt);
    const own = (c, r) => c >= s.c && c < s.c + s.w && r >= s.r && r < s.r + s.w;
    let hn = 0, popD = 0;
    const push = (i, d) => {
      let k = hn++;
      while (k > 0) { const p = (k - 1) >> 1; if (heapD[p] <= d) break; heapI[k] = heapI[p]; heapD[k] = heapD[p]; k = p; }
      heapI[k] = i; heapD[k] = d;
    };
    const pop = () => {
      const top = heapI[0], td = heapD[0];
      const li = heapI[--hn], ld = heapD[hn];
      let k = 0;
      for (;;) {
        let ch = 2 * k + 1; if (ch >= hn) break;
        if (ch + 1 < hn && heapD[ch + 1] < heapD[ch]) ch++;
        if (heapD[ch] >= ld) break;
        heapI[k] = heapI[ch]; heapD[k] = heapD[ch]; k = ch;
      }
      heapI[k] = li; heapD[k] = ld; popD = td; return top;
    };
    for (let r = s.r - 1; r <= s.r + s.w; r++) for (let c = s.c - 1; c <= s.c + s.w; c++) {
      if (!inMap(c, r) || own(c, r)) continue;
      const i = idx(c, r);
      const e = ex[i];
      if (e < Dd[i]) { Dd[i] = e; push(i, e); }
    }
    while (hn > 0) {
      const v = pop();
      if (popD > Dd[v]) continue;
      const vc = v % G, vr = (v / G) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const uc = vc + dx, ur = vr + dy;
        if (!inMap(uc, ur) || own(uc, ur)) continue;
        const u = idx(uc, ur);
        let step = 1;
        if (dx && dy) { if (ex[idx(uc, vr)] > 0 || ex[idx(vc, ur)] > 0) continue; step = 1.414; }
        const total = Dd[v] + step + ex[u];
        if (total < Dd[u]) { Dd[u] = total; push(u, total); }
      }
    }
    s.ff = Dd; s.ffv = bt.ver;
    return Dd;
  }

  function spawnUnit(bt, k, x, y, opts) {
    if (bt.units.length >= D.MAX_UNITS) return null;
    opts = opts || {};
    const isHero = k === 'hero';
    const t = isHero ? null : D.TROOPS[k];
    const lv = isHero ? (opts.lv || 1) : (bt.troopLv[k] || opts.lv || 1);
    const u = {
      id: bt.unitId++, k, x, y, lv, hero: isHero,
      hp: isHero ? opts.hp || D.HERO.hp(lv) : D.tv(k, 'hp', lv), max: isHero ? D.HERO.hp(lv) : D.tv(k, 'hp', lv),
      dps: isHero ? D.HERO.dps(lv) : D.tv(k, 'dps', lv),
      speed: isHero ? D.HERO.speed : t.speed, range: isHero ? D.HERO.range : t.range,
      pref: isHero ? 'any' : t.pref, fly: !isHero && !!t.fly, ranged: !isHero && !!t.ranged, healer: !isHero && !!t.healer,
      splash: !isHero && t.splash, hs: isHero ? 0 : t.hs, team: opts.team || bt.team,
      tgt: null, cd: bt.rng.range(0.1, 0.5), ox: bt.rng.range(-0.28, 0.28), oy: bt.rng.range(-0.28, 0.28),
      slowT: 0, flash: 0, face: 1, ph: bt.rng.range(0, 6), dead: false, age: 0, boost: 1, boostT: 0, heroBoost: 1, retarget: 0,
    };
    bt.units.push(u);
    if (bt.vis) { const p = I.toIso(x, y); P.rings.push({ x: p.x, y: p.y, t: 0.4, max: 0.4, r: 18, col: u.team === 'ally' ? '#00d9ff' : '#ff3d71' }); }
    return u;
  }
  function pickTarget(bt, u) {
    let best = null, bd = 1e9;
    const consider = (fn) => {
      for (const s of bt.S) {
        if (s.dead || s.hidden || s.kind === 'trap' || !fn(s)) continue;
        const d = distRect(u.x, u.y, s);
        if (d < bd) { bd = d; best = s; }
      }
    };
    if (u.pref === 'def') consider((s) => s.kind === 'def');
    else if (u.pref === 'wall') consider((s) => s.kind === 'wall');
    if (!best) consider((s) => s.kind !== 'wall');
    if (!best) consider(() => true);
    return best;
  }
  function unitMult(bt, u) { return Math.max(u.boost, u.heroBoost, bt.rageT > 0 ? 1.5 : 1); }
  function troopAttack(bt, u, s) {
    face(u, s.cx - u.x, s.cy - u.y);
    if (u.cd > 0) return;
    const m = unitMult(bt, u);
    const rate = 1;
    u.cd = rate;
    if (u.k === 'sapper') { explodeSapper(bt, u); return; }
    const dmg = u.dps * rate * m;
    if (u.ranged || u.k === 'stormrider' || u.k === 'raven') {
      bt.proj.push({ k: u.k === 'stormrider' ? 'storm' : u.k === 'raven' ? 'peck' : 'uarrow', x: u.x, y: u.y, z: u.fly ? 1 : 0.4, tgt: s, tx: s.cx, ty: s.cy, sp: u.k === 'raven' ? 9 : 12, dmg, splash: u.splash || 0, team: u.team });
    } else {
      damage(bt, s, dmg, u.x, u.y);
      if (bt.vis && (u.k === 'jotunn' || u.hero || u.k === 'draugr')) bt.shake = Math.max(bt.shake, u.hero ? 2 : 1.5);
    }
  }
  function explodeSapper(bt, u) {
    u.dead = true;
    const R = D.TROOPS.sapper.blast;
    for (const s of bt.S) {
      if (s.dead || s.hidden) continue;
      if (distRect(u.x, u.y, s) <= R) damage(bt, s, s.kind === 'wall' ? u.dps * unitMult(bt, u) : u.dps * 0.1, u.x, u.y);
    }
    if (bt.vis) { const p = I.toIso(u.x, u.y); P.burst(p.x, p.y - 6, '#ffcf8a', 16, 90, 30); P.burst(p.x, p.y - 6, '#ffffff', 6, 60, 20); bt.shake = Math.max(bt.shake, 4); FS.A.sfx('boom'); }
  }
  function face(u, dx, dy) { const sx = dx - dy; if (Math.abs(sx) > 0.05) u.face = sx > 0 ? 1 : -1; }
  function moveToward(u, x, y, sp, dt) {
    const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
    if (d < 0.001) return;
    const st = Math.min(d, sp * dt);
    u.x += (dx / d) * st; u.y += (dy / d) * st;
    face(u, dx, dy);
    u.ph += st * 5;
  }
  function hurt(bt, u, d) {
    if (u.dead) return;
    u.hp -= d; u.flash = 0.1;
    if (u.hp <= 0) {
      u.dead = true;
      if (bt.vis) { const p = I.toIso(u.x, u.y); P.burst(p.x, p.y - 8, u.team === 'ally' ? '#9af0ff' : '#ff3d71', 8, 60, 20); }
      if (u.k === 'draugr') {
        const n = D.TROOPS.draugr.split;
        for (let i = 0; i < n; i++) { const c = spawnUnit(bt, 'draugrling', u.x + (i ? 0.4 : -0.4), u.y + (i ? -0.3 : 0.3), { lv: u.lv, team: u.team }); if (c) c.cd = 0.6; }
      }
    }
  }
  function updateHealer(bt, u, dt) {
    let best = null, bd = 1e9;
    for (const v of bt.units) {
      if (v.dead || v.fly || v === u || v.team !== u.team) continue;
      const hurtK = v.hp < v.max ? 0 : 6;
      const d = Math.hypot(v.x - u.x, v.y - u.y) + hurtK;
      if (d < bd) { bd = d; best = v; }
    }
    if (!best) return;
    const d = Math.hypot(best.x - u.x, best.y - u.y);
    if (d > u.range * 0.8) moveToward(u, best.x, best.y, u.speed * (u.slowT > 0 ? 0.55 : 1), dt);
    const R = D.TROOPS.volva.healR;
    u.healing = false;
    for (const v of bt.units) {
      if (v.dead || v.fly || v.team !== u.team || v.hp >= v.max) continue;
      if (Math.hypot(v.x - best.x, v.y - best.y) <= R && d <= u.range) { v.hp = Math.min(v.max, v.hp + u.dps * dt * (v.hero ? 0.5 : 1)); u.healing = true; }
    }
    u.healX = best.x; u.healY = best.y;
  }
  function updateUnit(bt, u, dt) {
    u.flash = Math.max(0, u.flash - dt);
    u.slowT = Math.max(0, u.slowT - dt);
    u.cd -= dt; u.age += dt;
    if (u.boostT > 0) { u.boostT -= dt; if (u.boostT <= 0) u.heroBoost = 1; }
    if (u.healer) { updateHealer(bt, u, dt); return; }
    if (!u.tgt || u.tgt.dead || u.tgt.hidden) { u.tgt = pickTarget(bt, u); }
    const s = u.tgt;
    if (!s) return;
    const sp = u.speed * unitMult(bt, u) * (u.slowT > 0 ? 0.5 : 1);
    const dT = distRect(u.x, u.y, s);
    if (dT <= u.range) { troopAttack(bt, u, s); return; }
    if (u.fly) { moveToward(u, U.clamp(u.x, s.c, s.c + s.w), U.clamp(u.y, s.r, s.r + s.w), sp, dt); return; }
    const Dd = field(bt, s);
    const c = U.clamp(Math.floor(u.x), 0, G - 1), r = U.clamp(Math.floor(u.y), 0, G - 1), cur = idx(c, r);
    let bestV = -1, bestScore = 1e9;
    const ex = exArr(bt);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nc = c + dx, nr = r + dy;
      if (!inMap(nc, nr)) continue;
      if (nc >= s.c && nc < s.c + s.w && nr >= s.r && nr < s.r + s.w) continue;
      const v = idx(nc, nr);
      let step = 1;
      if (dx && dy) { if (ex[idx(nc, r)] > 0 || ex[idx(c, nr)] > 0) continue; step = 1.414; }
      const sc = Dd[v] + step;
      if (sc < bestScore) { bestScore = sc; bestV = v; }
    }
    if (bestV < 0 || bestScore > Dd[cur] + 0.01 || Dd[cur] >= 1e9) {
      moveToward(u, U.clamp(u.x, s.c, s.c + s.w), U.clamp(u.y, s.r, s.r + s.w), sp, dt);
      return;
    }
    const ob = bt.occ[bestV] ? bt.S[bt.occ[bestV] - 1] : null;
    if (ob && !ob.dead && ob !== s) {
      if (distRect(u.x, u.y, ob) <= Math.max(u.range, 0.9)) { troopAttack(bt, u, ob); return; }
    }
    const vc = bestV % G, vr = (bestV / G) | 0;
    moveToward(u, vc + 0.5 + u.ox, vr + 0.5 + u.oy, sp, dt);
  }

  function damage(bt, s, d, fx, fy) {
    if (s.dead) return;
    const real = Math.min(d, s.hp);
    s.hp -= d; s.flash = 0.1; s.hitT = bt.t;
    if (s.loot) giveLoot(bt, s, real / s.max);
    if (bt.vis) {
      if (bt.rng && Math.random() < 0.3) { const p = I.toIso(fx != null ? (fx + s.cx) / 2 : s.cx, fy != null ? (fy + s.cy) / 2 : s.cy); P.burst(p.x, p.y - 12, '#a8b3c2', 2, 40, 20); }
      FS.A.sfx('hit');
    }
    if (s.hp <= 0) destroy(bt, s);
  }
  function giveLoot(bt, s, frac) {
    for (const k in s.loot) {
      const amt = Math.min(s.loot[k], s.lootMax[k] * frac);
      s.loot[k] -= amt; bt.lootGot[k] += amt; bt.lootAvail[k] -= amt;
    }
  }
  function destroy(bt, s) {
    s.dead = true; s.hp = 0; s.dieT = 0.45;
    if (s.loot) { for (const k in s.loot) { bt.lootGot[k] += s.loot[k]; bt.lootAvail[k] -= s.loot[k]; } }
    if (s.kind !== 'trap') for (let y = s.r; y < s.r + s.w; y++) for (let x = s.c; x < s.c + s.w; x++) if (inMap(x, y) && bt.occ[idx(x, y)] === s.id + 1) bt.occ[idx(x, y)] = 0;
    bt.ver++;
    if (s.counts) bt.destroyed++;
    if (s.kind === 'hall') bt.hallDown = true;
    if (bt.vis) {
      const p = I.toIso(s.cx, s.cy);
      if (s.kind !== 'wall') {
        P.burst(p.x, p.y - 20, '#a8b3c2', 18, 120, 40); P.burst(p.x, p.y - 20, '#ff3d71', 6, 90, 30); P.puff(p.x, p.y, s.w);
        bt.shake = Math.max(bt.shake, s.kind === 'hall' ? 9 : 4);
        FS.A.sfx(s.kind === 'hall' ? 'big' : 'boom');
        if (s.lootMax) {
          let txt = '';
          for (const k in s.lootMax) if (s.lootMax[k] >= 1) { txt = '+' + U.fmt(s.lootMax[k]); P.float(p.x, p.y - 40, txt, D.RES[k].col); }
        }
      } else P.burst(p.x, p.y - 8, '#6c7380', 6, 60, 20);
    }
    checkStars(bt);
  }
  BT.pct = (bt) => (bt.total ? Math.floor(bt.destroyed / bt.total * 100) : 0);
  function checkStars(bt) {
    const p = BT.pct(bt);
    const want = [p >= 50, bt.hallDown, p >= 100];
    for (let i = 0; i < 3; i++) if (want[i] && !bt.stars[i]) {
      bt.stars[i] = true; bt.starT[i] = bt.t;
      if (bt.vis) { FS.A.sfx('star'); FS.UI && FS.UI.starPop(i); }
    }
    if (p >= 100 && !bt.over && bt.endGrace < 0) bt.endGrace = 1.2;
  }

  // ---------- defenses ----------
  function defOK(s, u) {
    if (u.dead) return false;
    if (u.fly ? !s.d.air : !s.d.ground) return false;
    const d = Math.hypot(u.x - s.cx, u.y - s.cy);
    return d <= s.range + s.w * 0.35 && (!s.d.min || d >= s.d.min);
  }
  function updateStruct(bt, s, dt) {
    s.flash = Math.max(0, s.flash - dt);
    if (s.fire > 0) s.fire -= dt;
    if (s.dead) { s.dieT = Math.max(0, s.dieT - dt); return; }
    if (s.kind === 'trap') { updateTrap(bt, s); return; }
    if (s.kind !== 'def' || s.inactive) return;
    if (s.frozen > 0) { s.frozen -= dt; return; }
    s.cd -= dt;
    if (!s.tgt || !defOK(s, s.tgt)) {
      s.tgt = null; let bd = 1e9;
      for (const u of bt.units) {
        if (!defOK(s, u)) continue;
        const d = (u.x - s.cx) ** 2 + (u.y - s.cy) ** 2;
        if (d < bd) { bd = d; s.tgt = u; }
      }
    }
    const u = s.tgt;
    if (!u) return;
    const want = Math.atan2(u.y - s.cy, u.x - s.cx);
    let da = want - s.aim; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
    s.aim += da * Math.min(1, dt * 10);
    if (s.cd > 0) return;
    s.cd = s.d.rate; s.fire = 0.15;
    const dmg = s.dps * s.d.rate;
    const z0 = ART.turretZ(s.t, s.lv) / 16;
    if (s.t === 'arrow') { bt.proj.push({ k: 'arrow', x: s.cx, y: s.cy, z: z0, u, tx: u.x, ty: u.y, sp: 14, dmg }); if (bt.vis) FS.A.sfx('shoot'); }
    else if (s.t === 'ballista') { bt.proj.push({ k: 'bolt', x: s.cx, y: s.cy, z: z0, u, tx: u.x, ty: u.y, sp: 16, dmg }); if (bt.vis) FS.A.sfx('shoot'); }
    else if (s.t === 'frost') { bt.proj.push({ k: 'shard', x: s.cx, y: s.cy, z: z0, u, tx: u.x, ty: u.y, sp: 10, dmg, slow: s.d.slowT }); if (bt.vis) FS.A.sfx('shoot'); }
    else if (s.t === 'harpoon') { bt.proj.push({ k: 'harpoon', x: s.cx, y: s.cy, z: z0, u, tx: u.x, ty: u.y, sp: 13, dmg }); if (bt.vis) FS.A.sfx('shoot'); }
    else if (s.t === 'catapult') { bt.proj.push({ k: 'stone', sx: s.cx, sy: s.cy, tx: u.x, ty: u.y, t: 0, T: 1.1, dmg, x: s.cx, y: s.cy, z: 0, splash: s.d.splash }); }
    else if (s.t === 'storm') {
      let cur = u, prev = { x: s.cx, y: s.cy, z: z0 + 0.5 }, d = dmg;
      const hit = new Set();
      for (let i = 0; i < s.d.chain && cur; i++) {
        hit.add(cur);
        if (bt.vis) bt.zaps.push({ x1: prev.x, y1: prev.y, z1: prev.z || 0, x2: cur.x, y2: cur.y, z2: cur.fly ? 1.6 : 0.5, t: 0.2 });
        hurt(bt, cur, d);
        prev = { x: cur.x, y: cur.y, z: cur.fly ? 1.6 : 0.5 };
        d *= 0.8;
        let nx = null, nd = s.d.chainR * s.d.chainR;
        for (const v of bt.units) { if (v.dead || hit.has(v)) continue; const q = (v.x - cur.x) ** 2 + (v.y - cur.y) ** 2; if (q < nd) { nd = q; nx = v; } }
        cur = nx;
      }
      if (bt.vis) FS.A.sfx('zap');
    }
  }
  function updateTrap(bt, s) {
    if (!s.hidden) return;
    const d = s.d;
    let trig = null;
    for (const u of bt.units) {
      if (u.dead || (u.fly ? !d.air : !d.ground)) continue;
      if (Math.hypot(u.x - s.cx, u.y - s.cy) <= d.trigger) { trig = u; break; }
    }
    if (!trig) return;
    s.hidden = false; s.dead = true; s.dieT = 0.6;
    const dmg = D.bv(s.t, 'dmg', s.lv);
    const p = bt.vis ? I.toIso(s.cx, s.cy) : null;
    if (s.t === 'skysnare') {
      hurt(bt, trig, dmg);
      if (bt.vis) { P.burst(p.x, p.y - 30, '#ff3d71', 14, 80, 40); P.float(p.x, p.y - 30, 'Sky Snare!', '#ff3d71'); FS.A.sfx('zap'); }
    } else {
      for (const u of bt.units) if (!u.dead && !u.fly && Math.hypot(u.x - s.cx, u.y - s.cy) <= d.splash) hurt(bt, u, dmg);
      if (bt.vis) { P.burst(p.x, p.y, '#ff3d71', 20, 110, 30); P.burst(p.x, p.y, '#ffcf8a', 10, 80, 30); P.float(p.x, p.y - 20, s.t === 'pitfall' ? 'Pitfall!' : 'Rune Mine!', '#ff3d71'); bt.shake = Math.max(bt.shake, 3); FS.A.sfx('boom'); }
    }
  }
  function updateProj(bt, dt) {
    for (const p of bt.proj) {
      if (p.k === 'stone') {
        p.t += dt;
        const k = Math.min(1, p.t / p.T);
        p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; p.z = Math.sin(k * Math.PI) * 5 + (1 - k) * 0.8;
        if (k >= 1) {
          p.done = true;
          for (const u of bt.units) if (!u.dead && !u.fly && Math.hypot(u.x - p.tx, u.y - p.ty) <= p.splash) hurt(bt, u, p.dmg);
          if (bt.vis) { const q = I.toIso(p.tx, p.ty); P.burst(q.x, q.y, '#ff3d71', 8, 70, 20); P.burst(q.x, q.y, '#8a93a2', 8, 60, 20); P.rings.push({ x: q.x, y: q.y, t: 0.35, max: 0.35, r: p.splash * 30, col: '#ff3d71' }); bt.shake = Math.max(bt.shake, 2.5); FS.A.sfx('boom'); }
        }
        continue;
      }
      const toS = p.k === 'uarrow' || p.k === 'storm' || p.k === 'peck';
      if (toS) { if (!p.tgt.dead) { p.tx = p.tgt.cx; p.ty = p.tgt.cy; } }
      else if (p.u && !p.u.dead) { p.tx = p.u.x; p.ty = p.u.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      const st = p.sp * dt;
      p.a = Math.atan2(dy, dx);
      if (p.d0 == null) { p.d0 = Math.max(0.5, d); p.z0 = p.z || 0; }
      const tz = toS ? 1 : p.u && p.u.fly ? 1.9 : 0.5;
      p.z = tz + (p.z0 - tz) * Math.min(1, d / p.d0);
      if (d <= st + (toS ? 0.5 : 0.15)) {
        p.done = true;
        if (toS) {
          if (!p.tgt.dead) damage(bt, p.tgt, p.dmg, p.x, p.y);
          if (p.splash) for (const s of bt.S) if (s !== p.tgt && !s.dead && !s.hidden && s.kind !== 'trap' && distRect(p.tx, p.ty, s) <= p.splash) damage(bt, s, p.dmg * 0.8, p.x, p.y);
          if (bt.vis && p.k === 'storm') { const q = I.toIso(p.tx, p.ty); P.burst(q.x, q.y - 16, '#9af0ff', 8, 60, 20); }
        } else if (p.u && !p.u.dead) {
          hurt(bt, p.u, p.dmg);
          if (p.slow) { p.u.slowT = p.slow; if (bt.vis) { const q = I.toIso(p.tx, p.ty); P.burst(q.x, q.y - 8, '#9af0ff', 4, 40, 10); } }
        }
      } else { p.x += (dx / d) * st; p.y += (dy / d) * st; }
    }
    bt.proj = bt.proj.filter((p) => !p.done);
  }

  // ---------- spells ----------
  function castSpell(bt, k, x, y) {
    const sp = D.SPELLS[k], lv = bt.spellLv[k] || 1;
    if (k === 'lightning') {
      for (let i = 0; i < sp.bolts; i++) {
        const a = bt.rng.range(0, 6.283), r = bt.rng.range(0, sp.radius);
        bt.bolts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, t: 0.12 + i * 0.22, dmg: D.sv(k, 'dmg', lv), show: 0 });
      }
    } else if (k === 'heal') bt.zones.push({ k, x, y, r: sp.radius, t: sp.dur, max: sp.dur, hps: D.sv(k, 'hps', lv) });
    else if (k === 'rage') bt.zones.push({ k, x, y, r: sp.radius, t: sp.dur, max: sp.dur, boost: D.sv(k, 'boost', lv) });
    else if (k === 'frostveil') bt.zones.push({ k, x, y, r: sp.radius, t: D.sv(k, 'dur', lv), max: D.sv(k, 'dur', lv) });
    if (bt.vis) { const p = I.toIso(x, y); P.rings.push({ x: p.x, y: p.y, t: 0.6, max: 0.6, r: sp.radius * 45, col: '#9af0ff' }); FS.A.sfx(k === 'rage' ? 'howl' : 'go'); }
  }
  function updateSpells(bt, dt) {
    for (const u of bt.units) u.boost = 1;
    for (const z of bt.zones) {
      z.t -= dt;
      if (z.k === 'heal') { for (const u of bt.units) if (!u.dead && u.team === bt.team && Math.hypot(u.x - z.x, u.y - z.y) <= z.r) u.hp = Math.min(u.max, u.hp + z.hps * dt * (u.hero ? 0.5 : 1)); }
      else if (z.k === 'rage') { for (const u of bt.units) if (!u.dead && Math.hypot(u.x - z.x, u.y - z.y) <= z.r) u.boost = Math.max(u.boost, z.boost); }
      else if (z.k === 'frostveil') { for (const s of bt.S) if (!s.dead && s.kind === 'def' && Math.hypot(s.cx - z.x, s.cy - z.y) <= z.r + s.w / 2) s.frozen = Math.max(s.frozen, 0.1); }
    }
    bt.zones = bt.zones.filter((z) => z.t > 0);
    for (const b of bt.bolts) {
      b.t -= dt;
      if (b.t <= 0 && !b.hit) {
        b.hit = true; b.show = 0.25;
        for (const s of bt.S) if (!s.dead && !s.hidden && s.kind !== 'trap' && distRect(b.x, b.y, s) <= 1.2) damage(bt, s, b.dmg, b.x, b.y);
        if (bt.vis) { const p = I.toIso(b.x, b.y); P.burst(p.x, p.y, '#9af0ff', 14, 100, 30); P.burst(p.x, p.y, '#ffffff', 6, 70, 20); bt.shake = Math.max(bt.shake, 3); FS.A.sfx('zap'); }
      }
      if (b.hit) b.show -= dt;
    }
    bt.bolts = bt.bolts.filter((b) => !b.hit || b.show > 0);
  }

  // ---------- step ----------
  function step(bt, dt) {
    bt.t += dt;
    bt.timeLeft -= dt;
    bt.rageT = Math.max(0, bt.rageT - dt);
    bt.noFlash = Math.max(0, bt.noFlash - dt);
    if (bt.plan) {
      while (bt.planI < bt.plan.length && bt.plan[bt.planI].t <= bt.t) {
        const e = bt.plan[bt.planI++];
        spawnUnit(bt, e.k, e.x, e.y, { lv: e.lv, team: 'enemy' });
        bt.deployed++;
      }
    }
    updateSpells(bt, dt);
    for (const u of bt.units) if (!u.dead) updateUnit(bt, u, dt);
    for (const s of bt.S) updateStruct(bt, s, dt);
    updateProj(bt, dt);
    if (bt.units.some((u) => u.dead)) bt.units = bt.units.filter((u) => !u.dead);
    if (bt.heroUnit && bt.heroUnit.dead) bt.heroUnit.gone = true;
    if (bt.forbidVer !== bt.ver && ((bt.t * 30) | 0) % 6 === 0) computeForbid(bt);
    // end conditions
    if (bt.timeLeft <= 0) { bt.timeLeft = 0; finish(bt, 'time'); return; }
    if (bt.endGrace >= 0) { bt.endGrace -= dt; if (bt.endGrace <= 0) { finish(bt, BT.pct(bt) >= 100 ? 'cleared' : 'spent'); return; } }
    else {
      const fighters = bt.units.some((u) => !u.dead && !u.healer);
      const left = bt.tray.some((t) => t.n > 0 && t.kind !== 'spell') || (bt.plan && bt.planI < bt.plan.length);
      if (!fighters && !left && bt.deployed > 0 && !bt.bolts.length) bt.endGrace = 1.5;
    }
  }
  function finish(bt, why) {
    if (bt.over) return;
    bt.over = true;
    const stars = bt.stars.filter(Boolean).length;
    bt.result = {
      why, stars, pct: BT.pct(bt),
      loot: { gold: Math.floor(bt.lootGot.gold), mead: Math.floor(bt.lootGot.mead), rs: Math.floor(bt.lootGot.rs) },
      used: bt.used, spellsUsed: bt.spellsUsed, heroHp: bt.heroUnit ? Math.max(0, bt.heroUnit.dead ? 0 : bt.heroUnit.hp) : null,
      destroyed: bt.destroyed, total: bt.total, time: Math.round(D.BATTLE_TIME - bt.timeLeft),
      perBuilding: bt.S.filter((s) => s.lootMax && s.srcId).map((s) => ({ id: s.srcId, taken: Object.fromEntries(Object.keys(s.lootMax).map((k) => [k, Math.floor(s.lootMax[k] - s.loot[k])])) })),
    };
    if (bt.onEnd) bt.onEnd(bt);
  }
  BT.finish = finish;
  BT.update = function (bt, dt) {
    if (!bt || bt.over) return;
    bt.acc += Math.min(0.1, dt) * bt.speed;
    let n = 0;
    while (bt.acc >= D.STEP && n < 8) { step(bt, D.STEP); bt.acc -= D.STEP; n++; if (bt.over) break; }
  };

  // ---------- deploy (player) ----------
  BT.deploy = function (bt, gx, gy) {
    if (!bt || bt.over || bt.mode !== 'attack') return false;
    const it = bt.tray[bt.sel];
    if (!it || it.n <= 0) { BT.selectNext(bt); FS.A.sfx('no'); return false; }
    if (it.kind === 'spell') {
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) return false;
      it.n--; bt.spellsUsed[it.k] = (bt.spellsUsed[it.k] || 0) + 1;
      castSpell(bt, it.k, gx, gy);
      if (it.n <= 0) BT.selectNext(bt);
      return true;
    }
    if (!BT.canDeploy(bt, gx, gy)) { bt.noFlash = 0.6; FS.A.sfx('no'); return false; }
    if (bt.units.length >= D.MAX_UNITS) return false;
    if (it.kind === 'hero') {
      if (bt.heroUnit) return false;
      const u = spawnUnit(bt, 'hero', gx, gy, { lv: it.lv, hp: it.hp });
      bt.heroUnit = u; it.n = 0; bt.heroUsed = true; bt.deployed++;
      FS.A.sfx('howl');
      BT.selectNext(bt);
      return true;
    }
    it.n--;
    bt.used[it.k] = (bt.used[it.k] || 0) + 1;
    spawnUnit(bt, it.k, gx + bt.rng.range(-0.15, 0.15), gy + bt.rng.range(-0.15, 0.15));
    bt.deployed++;
    FS.A.sfx('drop');
    if (it.n <= 0) BT.selectNext(bt);
    return true;
  };
  BT.selectNext = function (bt, dir) {
    dir = dir || 1;
    const n = bt.tray.length;
    for (let k = 1; k <= n; k++) { const i = ((bt.sel + dir * k) % n + n) % n; if (bt.tray[i].n > 0) { bt.sel = i; return; } }
  };
  BT.ability = function (bt) {
    const h = bt.heroUnit;
    if (!h || h.dead || bt.abilityUsed) return false;
    const a = D.HERO.ability;
    h.hp = Math.min(h.max, h.hp + h.max * a.heal);
    h.heroBoost = a.boost; h.boostT = a.dur;
    bt.abilityUsed = true;
    if (bt.vis) { const p = I.toIso(h.x, h.y); P.rings.push({ x: p.x, y: p.y, t: 0.7, max: 0.7, r: 60, col: '#00d9ff' }); P.burst(p.x, p.y - 20, '#00d9ff', 24, 120, 40); FS.A.sfx('howl'); bt.shake = 5; }
    return true;
  };
  BT.randomDeployPoint = function (bt) {
    for (let i = 0; i < 200; i++) {
      const edge = bt.rng.int(0, 3), k = bt.rng.range(2, G - 2);
      let x, y;
      // pick along the forbidden border from outside inward
      if (edge === 0) { x = k; y = 1; } else if (edge === 1) { x = G - 2; y = k; } else if (edge === 2) { x = k; y = G - 2; } else { x = 1; y = k; }
      const cx = G / 2, cy = G / 2;
      for (let s = 0; s < 40; s++) {
        const nx = x + (cx - x) * 0.04, ny = y + (cy - y) * 0.04;
        if (!BT.canDeploy(bt, nx, ny)) break;
        x = nx; y = ny;
      }
      if (BT.canDeploy(bt, x, y)) return { x, y };
    }
    return { x: 1, y: 1 };
  };
  // LIVE viewer actions during a raid
  BT.live = function (bt, n) {
    if (!bt || bt.over) return;
    const group = (k, count, spread) => {
      const p = BT.randomDeployPoint(bt);
      for (let i = 0; i < count; i++) spawnUnit(bt, k, p.x + bt.rng.range(-spread, spread), p.y + bt.rng.range(-spread, spread), { team: bt.team });
      bt.deployed += count;
    };
    if (n === 1) group('wolf', 6, 0.8);
    else if (n === 2) group('jotunn', 1, 0);
    else if (n === 3) group('raven', 4, 0.8);
    else if (n === 4) { bt.rageT = 8; if (bt.vis) for (const u of bt.units) { const p = I.toIso(u.x, u.y); P.rings.push({ x: p.x, y: p.y, t: 0.4, max: 0.4, r: 20, col: '#00d9ff' }); } }
    else if (n === 5) {
      for (const s of bt.S) if (!s.dead && s.kind !== 'trap') { s.hp = Math.min(s.max, s.hp + s.max * 0.25); s.flash = 0.15; }
      const dw = bt.S.filter((s) => s.dead && s.kind === 'wall' && !bt.occ[idx(s.c, s.r)] && !bt.units.some((u) => Math.floor(u.x) === s.c && Math.floor(u.y) === s.r));
      if (dw.length) { const s = dw[bt.rng.int(0, dw.length - 1)]; s.dead = false; s.hp = s.max; s.dieT = 0; bt.occ[idx(s.c, s.r)] = s.id + 1; bt.ver++; }
    } else if (n === 6) {
      // new enemy arrow tower somewhere free inside the village
      let placed = null;
      for (let k = 0; k < 300 && !placed; k++) {
        const c = bt.rng.int(8, G - 11), r = bt.rng.int(8, G - 11);
        let ok = true;
        for (let y = r; y < r + 3 && ok; y++) for (let x = c; x < c + 3 && ok; x++) if (bt.occ[idx(x, y)] || !bt.forbid[idx(x, y)]) ok = false;
        if (ok && !bt.units.some((u) => u.x >= c - 0.5 && u.x < c + 3.5 && u.y >= r - 0.5 && u.y < r + 3.5)) placed = { c, r };
      }
      if (placed) {
        const s = addStruct(bt, { t: 'arrow', lv: Math.max(1, D.maxLevel('arrow', bt.info.hall || 3)), c: placed.c, r: placed.r });
        s.cd = 0.6; bt.total++; bt.ver++;
        bt.draw = bt.S.slice().sort((a, b) => (a.c + a.r + a.w) - (b.c + b.r + b.w));
        if (bt.vis) { const p = I.toIso(s.cx, s.cy); P.rings.push({ x: p.x, y: p.y, t: 0.6, max: 0.6, r: 60, col: '#ff3d71' }); P.puff(p.x, p.y, 3); }
      }
    }
  };

  // =====================================================================
  // AI raids on the home village
  // =====================================================================
  BT.planRaid = function (attHall, seed, layout) {
    const rng = U.rng(seed ^ 0x51ed);
    const cap = [20, 30, 60, 90, 130, 170, 220, 270][D.hallIdx(attHall)];
    const pool = D.TROOP_ORDER.filter((k) => {
      const t = D.TROOPS[k]; const bl = D.maxLevel('barracks', attHall);
      return t.barracks <= bl && (t.hall || 1) <= attHall;
    });
    const army = {};
    let hs = 0;
    const tanks = pool.filter((k) => ['jotunn', 'draugr'].includes(k));
    if (tanks.length) { const k = rng.pick(tanks); const n = Math.max(1, Math.floor(cap * 0.3 / D.TROOPS[k].hs)); army[k] = n; hs += n * D.TROOPS[k].hs; }
    let guard = 0;
    while (hs < cap && guard++ < 400) {
      const k = rng.pick(pool); const t = D.TROOPS[k];
      if (hs + t.hs > cap) { if (t.hs === 1) break; continue; }
      army[k] = (army[k] || 0) + 1; hs += t.hs;
    }
    // deploy points from the defender's forbidden map
    const tmp = BT.create({ mode: 'sim', seed, layout });
    const pts = [];
    const sides = rng.shuffle([0, 1, 2, 3]).slice(0, rng.int(1, 3));
    for (const side of sides) { tmp.rng = U.rng(seed + side * 77); const p = BT.randomDeployPoint(tmp); pts.push(p); }
    const plan = [];
    let t = 1.0;
    const order = Object.keys(army).sort((a, b) => D.TROOPS[b].hs - D.TROOPS[a].hs);
    const lvByHall = Math.max(1, Math.min(5, Math.ceil(attHall / 2)));
    for (const k of order) {
      for (let i = 0; i < army[k]; i++) {
        const p = pts[(i + order.indexOf(k)) % pts.length];
        plan.push({ t, k, x: U.clamp(p.x + rng.range(-1, 1), 0.3, G - 0.3), y: U.clamp(p.y + rng.range(-1, 1), 0.3, G - 0.3), lv: lvByHall });
        t += D.TROOPS[k].hs >= 5 ? 0.6 : 0.18;
      }
      t += 2.5;
    }
    return { army, plan };
  };
  BT.simulate = function (opts) {
    const bt = BT.create(Object.assign({}, opts, { mode: 'sim' }));
    let guard = 0;
    while (!bt.over && guard++ < 7000) step(bt, D.STEP);
    if (!bt.over) finish(bt, 'time');
    return bt.result;
  };

  // =====================================================================
  // Rendering
  // =====================================================================
  const wallMask = (bt, s) => {
    const a = bt.occ[idx(s.c + 1, s.r)], b = bt.occ[idx(s.c, s.r + 1)];
    const A1 = a && s.c + 1 < G && bt.S[a - 1].kind === 'wall', B1 = b && s.r + 1 < G && bt.S[b - 1].kind === 'wall';
    return (A1 ? 1 : 0) | (B1 ? 2 : 0);
  };
  function hpBar(ctx, x, y, w, frac, col) {
    const z = I.cam.z, h = 5 / z, ww = w / z;
    ctx.fillStyle = 'rgba(5,8,13,0.85)'; ctx.fillRect(x - ww / 2 - 1 / z, y - 1 / z, ww + 2 / z, h + 2 / z);
    ctx.fillStyle = col; ctx.fillRect(x - ww / 2, y, Math.max(1 / z, ww * frac), h);
  }
  function drawStruct(ctx, bt, s) {
    const p = I.toIso(s.cx, s.cy);
    if (!I.visible(p.x, p.y - 60, 220)) return;
    if (s.kind === 'trap') {
      if (!s.hidden && s.dieT > 0) { ctx.globalAlpha = s.dieT / 0.6; I.drawSprite(ctx, ART.buildingSprite(s.t, s.lv), p.x, p.y); ctx.globalAlpha = 1; }
      else if (s.hidden && bt.owned) { ctx.globalAlpha = 0.55; I.drawSprite(ctx, ART.buildingSprite(s.t, s.lv), p.x, p.y); ctx.globalAlpha = 1; }
      return;
    }
    if (s.dead && s.dieT <= 0) { I.drawSprite(ctx, ART.rubbleSprite(s.w), p.x, p.y); return; }
    const spr = s.kind === 'wall' ? ART.wallSprite(s.lv, wallMask(bt, s)) : ART.buildingSprite(s.t, s.lv);
    if (s.dead) {
      const k = s.dieT / 0.45;
      I.drawSprite(ctx, ART.rubbleSprite(s.w), p.x, p.y);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, k); ctx.globalAlpha = k; I.drawSprite(ctx, spr, 0, 0); ctx.restore();
      return;
    }
    I.drawSprite(ctx, spr, p.x, p.y);
    if (s.kind === 'def') ART.turret(ctx, s.t, s.lv, p.x, p.y, s.aim, s.fire, bt.t, 'enemy');
    if (s.t === 'camp') ART.campFire(ctx, p.x, p.y, bt.t);
    if (s.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; I.drawSprite(ctx, spr, p.x, p.y); ctx.restore(); }
    if (s.frozen > 0) { ctx.fillStyle = 'rgba(154,240,255,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 12, s.w * 26, s.w * 16, 0, 0, 6.283); ctx.fill(); }
  }
  let TS = 1.25;
  function drawUnit(ctx, bt, u) {
    const p = I.toIso(u.x, u.y);
    const alt = u.fly ? 30 + Math.sin(u.ph * 0.4 + u.id) * 3 : 0;
    const col = u.team === 'ally' ? '#00d9ff' : '#ff3d71';
    const big = u.hero ? 2 : u.k === 'jotunn' || u.k === 'draugr' ? 1.6 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 7 * big * TS, 3.5 * big * TS, 0, 0, 6.283); ctx.fill();
    const boosted = unitMult(bt, u) > 1;
    ctx.strokeStyle = U.rgba(col, boosted ? 0.95 : 0.55); ctx.lineWidth = (boosted ? 2.2 : 1.4) / Math.max(0.5, I.cam.z) * 0.7;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 8 * big * TS, 4 * big * TS, 0, 0, 6.283); ctx.stroke();
    if (u.slowT > 0) { ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - alt, 10 * big, 5 * big, 0, 0, 6.283); ctx.stroke(); }
    const pop = u.age < 0.25 ? 1 + (1 - u.age / 0.25) * 0.5 : 1;
    if (u.flash > 0) ctx.globalAlpha = 0.6;
    ART.troop(ctx, u.hero ? 'hero' : u.k, p.x, p.y - alt, TS * pop, u.face, u.ph, u.team, bt.t);
    ctx.globalAlpha = 1;
    if (u.healer && u.healing) {
      const q = I.toIso(u.healX, u.healY);
      ctx.strokeStyle = 'rgba(125,255,176,0.55)'; ctx.lineWidth = 2 / I.cam.z * 0.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - alt - 20); ctx.lineTo(q.x, q.y - 10); ctx.stroke();
      ctx.fillStyle = 'rgba(125,255,176,0.1)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, D.TROOPS.volva.healR * 45, D.TROOPS.volva.healR * 22, 0, 0, 6.283); ctx.fill();
    }
    if (u.hp < u.max) hpBar(ctx, p.x, p.y - alt - (ART.troopHeight[u.hero ? 'hero' : u.k] || 20) * TS * (u.hero ? 1.3 : 1) - 8, u.hero ? 30 : 16, U.clamp(u.hp / u.max, 0, 1), u.team === 'ally' ? '#00d9ff' : '#ff3d71');
  }
  function drawProj(ctx, p) {
    const q = I.toIso(p.x, p.y), z = (p.z || 0) * 16;
    if (p.k === 'stone') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, 6, 3, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#6f7682'; ctx.beginPath(); ctx.arc(q.x, q.y - z * 3 - 6, 6, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ff3d71'; ctx.beginPath(); ctx.arc(q.x - 1.5, q.y - z * 3 - 8, 2, 0, 6.283); ctx.fill();
      return;
    }
    const a = Math.atan2(Math.sin(p.a) * 0.5 + Math.cos(p.a) * 0.5, Math.cos(p.a) - Math.sin(p.a));
    ctx.save(); ctx.translate(q.x, q.y - z); ctx.rotate(a);
    if (p.k === 'arrow') { ctx.strokeStyle = '#ffd2a0'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.fillStyle = '#ff3d71'; ctx.fillRect(-11, -2, 3, 4); }
    else if (p.k === 'bolt') { ctx.strokeStyle = '#5a4130'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.fillStyle = '#c8ced6'; ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(14, 0); ctx.lineTo(8, 4); ctx.fill(); }
    else if (p.k === 'shard') { ctx.fillStyle = 'rgba(154,240,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(0, -4); ctx.lineTo(-7, 0); ctx.lineTo(0, 4); ctx.fill(); }
    else if (p.k === 'harpoon') { ctx.strokeStyle = '#c8ced6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(10, 0); ctx.stroke(); ctx.fillStyle = '#ff3d71'; ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(17, 0); ctx.lineTo(10, 5); ctx.fill(); }
    else if (p.k === 'uarrow') { ctx.strokeStyle = '#9af0ff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(6, 0); ctx.stroke(); }
    else if (p.k === 'peck') { ctx.fillStyle = '#9af0ff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 6.283); ctx.fill(); }
    else if (p.k === 'storm') { ctx.save(); ctx.shadowColor = '#00d9ff'; ctx.shadowBlur = 10; ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.283); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  BT.render = function (ctx, bt, dt) {
    P.update(dt);
    TS = U.clamp(0.75 / I.cam.z, 1.2, 2.4);
    I.updateBucket();
    I.applyScreen(ctx);
    ctx.fillStyle = '#0b1418'; ctx.fillRect(0, 0, I.W, I.H);
    bt.shake = Math.max(0, (bt.shake || 0) - dt * 18);
    const sh = bt.shake > 0 ? [U.rand(-bt.shake, bt.shake), U.rand(-bt.shake, bt.shake)] : [0, 0];
    I.applyWorld(ctx, sh[0], sh[1]);
    if (!I.ground || I.ground.theme !== bt.theme) I.buildGround(bt.theme);
    I.drawGround(ctx);
    // deploy zone
    if (bt.mode === 'attack' && bt.started) {
      if (bt.forbidPath) {
        const strong = bt.noFlash > 0 ? bt.noFlash / 0.6 : 0;
        ctx.fillStyle = `rgba(255,61,113,${0.06 + strong * 0.12})`; ctx.fill(bt.forbidPath);
        ctx.strokeStyle = `rgba(255,61,113,${0.55 + strong * 0.45})`; ctx.lineWidth = 2 / I.cam.z; ctx.stroke(bt.forbidEdge);
      }
    }
    // spell zones on the ground
    for (const z of bt.zones) {
      const p = I.toIso(z.x, z.y), k = Math.min(1, z.t / 0.4);
      const col = z.k === 'heal' ? '125,255,176' : z.k === 'rage' ? '0,217,255' : '199,245,255';
      ctx.fillStyle = `rgba(${col},${0.16 * k})`; ctx.strokeStyle = `rgba(${col},${0.7 * k})`; ctx.lineWidth = 2 / I.cam.z;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, z.r * I.HW * 1.414, z.r * I.HH * 1.414, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      if (z.k === 'heal' && Math.random() < 0.4) P.parts.push({ x: p.x + U.rand(-z.r * 40, z.r * 40), y: p.y + U.rand(-z.r * 18, z.r * 18), vx: 0, vy: -30, life: 0.8, max: 0.8, col: '#7dffb0', s: 3, g: 0, star: true });
    }
    // rubble first, then depth-sorted structures + ground units
    const ground = bt.units.filter((u) => !u.fly).sort((a, b) => (a.x + a.y) - (b.x + b.y));
    let ui = 0;
    for (const s of bt.draw) {
      const d = s.c + s.r + s.w;
      while (ui < ground.length && ground[ui].x + ground[ui].y < d - 0.2) drawUnit(ctx, bt, ground[ui++]);
      drawStruct(ctx, bt, s);
    }
    while (ui < ground.length) drawUnit(ctx, bt, ground[ui++]);
    for (const p of bt.proj) drawProj(ctx, p);
    for (const u of bt.units) if (u.fly) drawUnit(ctx, bt, u);
    // lightning (storm totem chains + spell bolts)
    for (const z of bt.zaps) z.t -= dt;
    bt.zaps = bt.zaps.filter((z) => z.t > 0);
    ctx.lineCap = 'round';
    for (const z of bt.zaps) {
      const a = I.toIso(z.x1, z.y1), b = I.toIso(z.x2, z.y2);
      ctx.strokeStyle = `rgba(154,240,255,${z.t / 0.2})`; ctx.lineWidth = 3 / Math.max(0.5, I.cam.z) * 0.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - z.z1 * 16);
      for (let i = 1; i < 5; i++) { const k = i / 5; ctx.lineTo(a.x + (b.x - a.x) * k + U.rand(-6, 6), a.y - z.z1 * 16 + (b.y - z.z2 * 16 - a.y + z.z1 * 16) * k + U.rand(-6, 6)); }
      ctx.lineTo(b.x, b.y - z.z2 * 16); ctx.stroke();
    }
    for (const b of bt.bolts) {
      if (!b.hit) continue;
      const p = I.toIso(b.x, b.y);
      ctx.strokeStyle = `rgba(232,251,255,${Math.max(0, b.show / 0.25)})`; ctx.lineWidth = 4 / Math.max(0.5, I.cam.z) * 0.6;
      ctx.beginPath(); ctx.moveTo(p.x + U.rand(-20, 20), p.y - 400);
      for (let i = 1; i < 7; i++) ctx.lineTo(p.x + U.rand(-14, 14), p.y - 400 + i * 400 / 7);
      ctx.stroke();
    }
    // building HP bars
    for (const s of bt.S) {
      if (s.dead || s.hidden || s.hp >= s.max || s.kind === 'trap' || bt.t - (s.hitT || -9) > 2.5) continue;
      const p = I.toIso(s.cx, s.cy);
      hpBar(ctx, p.x, p.y - (s.kind === 'wall' ? 30 : 30 + s.w * 18), s.kind === 'wall' ? 14 : 30, s.hp / s.max, s.kind === 'wall' ? '#a8b3c2' : '#ff3d71');
    }
    P.draw(ctx);
    I.applyScreen(ctx);
    if (bt.rageT > 0) { ctx.fillStyle = `rgba(0,217,255,${0.05 + 0.03 * Math.sin(bt.t * 8)})`; ctx.fillRect(0, 0, I.W, I.H); }
    FS.VV.vignette(ctx);
  };
  // fit the camera on the village
  BT.frame = function (bt) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const s of bt.S) {
      if (s.kind === 'trap') continue;
      for (const [c, r] of [[s.c, s.r], [s.c + s.w, s.r], [s.c, s.r + s.w], [s.c + s.w, s.r + s.w]]) {
        const p = I.toIso(c, r); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y - 50); y1 = Math.max(y1, p.y);
      }
    }
    const padX = 2 * I.TW, padY = 2 * I.TH;
    const top = 150, bottom = 130;
    const fit = Math.min(I.W / (x1 - x0 + padX), (I.H - top - bottom) / (y1 - y0 + padY));
    const z = U.clamp(Math.max(fit, I.defaultZoom() * 0.62), I.zMin, I.zMax);
    I.cam.z = z;
    I.cam.x = (x0 + x1) / 2;
    I.cam.y = (y0 + y1) / 2 + ((bottom - top) / 2) / z;
    I.clamp();
  };
})(window.FS = window.FS || {});
