/* Fenrir Siege — boot, main loop, mode switching (village / match / battle /
   results), battle input, keyboard + LIVE viewer keys, autosave, debug getter. */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U, I = FS.iso, V = FS.V, BT = FS.battle, UI = FS.UI, VV = FS.VV, P = FS.P;
  FS.FONT_DISPLAY = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
  FS.mode = 'village';
  FS.liveLegend = U.store.get('legend', false);
  FS.LIVE_BATTLE = [
    { name: 'Wolf pack: 6 Wolves', good: true }, { name: 'Jötunn joins the raid', good: true }, { name: 'Raven flock: 4 Ravens', good: true },
    { name: 'Rage Howl: +50% for 8s', good: true }, { name: 'Rebuild: enemy heals 25%', good: false }, { name: 'Reinforce: enemy Arrow Tower', good: false },
  ];
  FS.LIVE_VILLAGE = [
    { name: 'Gold chest', good: true }, { name: 'Mead barrel', good: true }, { name: 'Builder boost: −5 min', good: true },
    { name: 'Free troops: 10 housing of Wolves', good: true }, { name: 'Gem gift: +5 gems', good: true }, { name: 'Storm: a building is raided', good: false },
  ];
  const game = FS.game = { paused: false, fps: 60, homeCam: null, match: null };
  const $ = UI.$;

  function setMode(m) {
    FS.mode = m;
    document.body.className = 'mode-' + m;
    UI.renderLegend();
  }

  // ---------- flow ----------
  game.findMatch = function (next) {
    const cost = D.FIND_COST[D.hallIdx(V.hallLv())];
    if (!V.has('gold', cost)) { UI.fail({ msg: 'Not enough gold', need: { res: 'gold', amt: cost } }, () => { game.findMatch(next); return { ok: true }; }); return; }
    const st = V.st;
    const troops = D.TROOP_ORDER.some((k) => st.army[k] > 0);
    if (!troops) { UI.toast('Train some troops first', 'bad'); return; }
    V.spend('gold', cost);
    if (!game.homeCam) game.homeCam = Object.assign({}, I.cam);
    UI.closeModal(); VV.select(null); VV.cancelPlace();
    const m = BT.genMatch({ hall: V.hallLv(), trophies: st.trophies });
    game.match = m;
    const A = FS.army;
    const lab = st.lab.lv;
    const bt = BT.create({
      mode: 'attack', seed: m.seed, layout: m.layout, info: { name: m.name, hall: m.hall, chief: m.chief },
      army: Object.assign({}, st.army), spells: Object.assign({}, st.spells),
      hero: A.heroReady() ? { lv: st.hero.lv, hp: st.hero.hp } : null,
      troopLv: Object.assign({}, lab), spellLv: Object.assign({}, lab), theme: 'enemy',
    });
    bt.started = false;
    bt.onEnd = onBattleEnd;
    BT.cur = bt;
    P.clear();
    BT.frame(bt);
    setMode('match');
    UI.showMatch(m);
    UI.showBattle(bt);
    FS.A.sfx(next ? 'tick' : 'go');
  };
  game.startAttack = function () {
    const bt = BT.cur; if (!bt) return;
    bt.started = true;
    V.st.shieldEnd = 0;
    UI.hideMatch();
    setMode('battle');
    UI.showBattle(bt);
    FS.A.sfx('howl');
    UI.toast('Deploy outside the red border', 'info');
  };
  game.endBattle = function () {
    const bt = BT.cur; if (!bt) return;
    if (bt.mode !== 'attack') { game.skipReplay(); return; }
    if (!bt.deployed) { game.goHome(); return; }
    UI.confirm('End the raid?', 'Your deployed troops are spent. Stars and loot so far are kept.', 'End raid', () => BT.finish(bt, 'surrender'), 'Keep fighting');
  };
  function onBattleEnd(bt) {
    const r = bt.result, st = V.st;
    if (bt.mode !== 'attack') { setTimeout(() => { setMode('results'); UI.showResults(bt, r, null); }, 900); return; }
    const m = game.match;
    const applied = { loot: {}, trophies: 0, xp: 0 };
    for (const k of ['gold', 'mead', 'rs']) applied.loot[k] = V.add(k, r.loot[k]);
    st.stats.lootGold += r.loot.gold; st.stats.lootMead += r.loot.mead;
    for (const k in r.used) st.army[k] = Math.max(0, (st.army[k] || 0) - r.used[k]);
    for (const k in r.spellsUsed) st.spells[k] = Math.max(0, (st.spells[k] || 0) - r.spellsUsed[k]);
    if (r.heroHp != null) st.hero.hp = Math.min(st.hero.hp, r.heroHp);
    if (r.stars > 0) applied.trophies = Math.max(1, Math.round(m.offer.win * r.stars / 3));
    else applied.trophies = -m.offer.lose;
    const before = st.trophies;
    st.trophies = Math.max(0, st.trophies + applied.trophies);
    applied.trophies = st.trophies - before;
    st.best = Math.max(st.best || 0, st.trophies);
    st.stats.raids++; if (r.stars > 0) st.stats.wins++; st.stats.stars += r.stars;
    applied.xp = 3 + r.stars * 4;
    V.addXP(applied.xp);
    FS.save.write();
    setTimeout(() => { setMode('results'); UI.showResults(bt, r, applied); FS.A.sfx(r.stars ? 'done' : 'bad'); }, 1100);
  }
  game.goHome = function () {
    BT.cur = null;
    game.match = null;
    game.paused = false;
    $('pause').hidden = true;
    UI.hideMatch(); UI.hideBattle(); UI.hideResults(); UI.closeModal();
    P.clear();
    if (game.homeCam) { Object.assign(I.cam, game.homeCam); game.homeCam = null; I.clamp(); }
    setMode('village');
    UI.updateHUD();
  };
  game.replay = function (id) {
    const e = V.st.log.find((x) => x.id === id);
    if (!e) return;
    if (!game.homeCam) game.homeCam = Object.assign({}, I.cam);
    VV.select(null);
    const bt = BT.create({ mode: 'replay', seed: e.seed, layout: e.layout, plan: e.plan, info: { name: e.name, hall: e.hall }, owned: true, theme: 'home' });
    bt.started = true;
    bt.onEnd = onBattleEnd;
    BT.cur = bt;
    P.clear();
    BT.frame(bt);
    setMode('battle');
    UI.showBattle(bt);
  };
  game.skipReplay = function () {
    const bt = BT.cur; if (!bt) return;
    bt.vis = false;
    let guard = 0;
    while (!bt.over && guard++ < 8000) BT.update(bt, D.STEP * 8);
    bt.vis = true;
  };
  game.togglePause = function () {
    if (FS.mode === 'battle') {
      game.paused = !game.paused;
      $('pause').hidden = !game.paused;
      if (game.paused) $('btn-resume').focus();
    } else if (FS.mode === 'village') {
      if (UI.modalOpen) UI.closeModal(); else UI.openMenu();
    }
  };
  game.onNewVillage = function () {
    VV.select(null); VV.cancelPlace(); UI.closeModal();
    I.centerOn(21, 23, I.defaultZoom());
    V.dirty = true;
    UI.updateHUD();
  };

  // ---------- LIVE keys ----------
  function liveToast(list, n) { const a = list[n - 1]; UI.toast(a.name, a.good ? 'good' : 'bad'); FS.A.sfx(a.good ? 'good' : 'bad'); }
  function villageLive(n) {
    const st = V.st, hall = V.hall();
    const at = (b) => ({ id: b.id });
    liveToast(FS.LIVE_VILLAGE, n);
    if (n === 1 || n === 2) {
      const res = n === 1 ? 'gold' : 'mead';
      const got = V.add(res, 400 * V.hallLv());
      V.fx(Object.assign(at(hall), { k: 'float', text: got ? '+' + U.fmt(got) : 'Storage full', col: D.RES[res].col }));
      V.fx(Object.assign(at(hall), { k: 'sparkle' }));
      FS.A.sfx('coin');
    } else if (n === 3) {
      const b = st.b.filter((x) => x.bt).sort((a, c) => a.bt.end - c.bt.end)[0];
      if (!b) { UI.toast('No construction running', 'info'); return; }
      b.bt.end -= 300 * 1000;
      V.fx(Object.assign(at(b), { k: 'sparkle' }));
    } else if (n === 4) {
      const hs = FS.army.gift('wolf', 10);
      if (!hs) UI.toast('Army camps are full', 'info');
      const camp = st.b.find((x) => x.t === 'camp');
      if (camp) V.fx(Object.assign(at(camp), { k: 'puff' }));
    } else if (n === 5) {
      st.gems += 5;
      V.fx(Object.assign(at(hall), { k: 'float', text: '+5', col: D.RES.gems.col }));
    } else if (n === 6) {
      const cands = st.b.filter((x) => x.t !== 'hall' && x.lv >= 1 && x.t !== 'wall');
      const b = cands[Math.floor(Math.random() * cands.length)];
      if (!b) return;
      const def = D.B[b.t];
      let lost = 0, res = null;
      if (def.prod) { res = def.prod; lost = Math.floor(b.acc || 0); b.acc = 0; }
      else if (def.store) { res = Object.keys(def.store)[0]; lost = Math.floor(st[res] * 0.08); st[res] -= lost; }
      V.fx(Object.assign(at(b), { k: 'storm' }));
      if (lost > 0) V.fx(Object.assign(at(b), { k: 'float', text: '−' + U.fmt(lost), col: '#ff3d71' }));
      FS.A.sfx('boom');
      game.shake = 8;
    }
  }
  function battleLive(n) {
    const bt = BT.cur;
    if (!bt || bt.over || bt.mode !== 'attack' || !bt.started) return;
    liveToast(FS.LIVE_BATTLE, n);
    BT.live(bt, n);
  }

  // ---------- input ----------
  const ptrs = new Map();
  let bdrag = null, bpinch = null;
  function battleDown(e) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      bpinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: I.cam.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      bdrag = null; return;
    }
    bdrag = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, x: e.clientX, y: e.clientY, moved: false, t: performance.now(), hold: false, lastDrop: 0 };
  }
  function battleMove(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (bpinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      I.zoomAt(cx, cy, (bpinch.z * d / bpinch.d) / I.cam.z); I.pan(cx - bpinch.cx, cy - bpinch.cy);
      bpinch.cx = cx; bpinch.cy = cy; return;
    }
    if (!bdrag) return;
    bdrag.x = e.clientX; bdrag.y = e.clientY;
    if (!bdrag.moved && !bdrag.hold && Math.hypot(e.clientX - bdrag.sx, e.clientY - bdrag.sy) > 9) bdrag.moved = true;
    if (bdrag.moved) I.pan(e.clientX - bdrag.lx, e.clientY - bdrag.ly);
    bdrag.lx = e.clientX; bdrag.ly = e.clientY;
  }
  function battleUp(e) {
    ptrs.delete(e.pointerId);
    if (bpinch) { if (ptrs.size < 2) bpinch = null; bdrag = null; return; }
    if (!bdrag) return;
    const d = bdrag; bdrag = null;
    if (d.moved || d.hold) return;
    deployAtScreen(d.sx, d.sy);
  }
  function deployAtScreen(sx, sy) {
    const bt = BT.cur;
    if (!bt || FS.mode !== 'battle' || bt.mode !== 'attack' || game.paused) return;
    const g = I.screenToGrid(sx, sy);
    BT.deploy(bt, g.x, g.y);
  }
  function holdDeploy() {
    if (!bdrag || bdrag.moved || FS.mode !== 'battle' || game.paused) return;
    const now = performance.now();
    if (now - bdrag.t > 280) {
      const bt = BT.cur; if (!bt || bt.mode !== 'attack') return;
      const it = bt.tray[bt.sel];
      if (it && it.kind === 'spell') return;
      bdrag.hold = true;
      if (now - bdrag.lastDrop > 90) { bdrag.lastDrop = now; deployAtScreen(bdrag.x, bdrag.y); }
    }
  }

  function bindInput() {
    const cv = I.canvas;
    cv.addEventListener('pointerdown', (e) => {
      FS.A.ensure();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (FS.mode === 'village') VV.down(e); else battleDown(e);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => { if (FS.mode === 'village') VV.movePtr(e); else battleMove(e); });
    const up = (e) => { if (FS.mode === 'village') VV.up(e); else battleUp(e); };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e) => { if (FS.mode === 'village') VV.cancelPtr(e); else { ptrs.delete(e.pointerId); bdrag = null; bpinch = null; } });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); I.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => { I.resize(); I.ground = null; });
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => { if (document.hidden) FS.save.write(); else game.wake(); });
    window.addEventListener('pagehide', () => FS.save.write());
  }
  function onKey(e) {
    const k = e.key;
    FS.A.ensure();
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') { if (k === 'Escape') document.activeElement.blur(); return; }
    if (k === 'Escape') {
      e.preventDefault();
      if (!$('confirm').hidden) { UI.closeConfirm(); return; }
      if (UI.modalOpen) { UI.closeModal(); return; }
      if (VV.ghost) { VV.cancelPlace(); return; }
      if (VV.sel) { VV.select(null); return; }
      game.togglePause(); return;
    }
    if (k === 'p' || k === 'P') { e.preventDefault(); game.togglePause(); return; }
    if (k === 'l' || k === 'L') { FS.liveLegend = !FS.liveLegend; U.store.set('legend', FS.liveLegend); UI.renderLegend(); return; }
    if (/^[1-6]$/.test(k)) {
      if (e.repeat) return;
      if (FS.mode === 'battle') battleLive(+k); else if (FS.mode === 'village') villageLive(+k);
      return;
    }
    const focusedBtn = tag === 'BUTTON';
    if ((k === 'Enter' || k === ' ') && !focusedBtn) {
      if (!$('confirm').hidden) { e.preventDefault(); $('confirm-yes').click(); return; }
      if (FS.mode === 'village' && !UI.modalOpen && !VV.ghost) { e.preventDefault(); UI.openAttack(); return; }
      if (FS.mode === 'village' && VV.ghost) { e.preventDefault(); VV.confirmPlace(); return; }
      if (FS.mode === 'village' && UI._modalKind === 'attack') { e.preventDefault(); game.findMatch(); return; }
      if (FS.mode === 'match') { e.preventDefault(); game.startAttack(); return; }
      if (FS.mode === 'results') { e.preventDefault(); game.goHome(); return; }
      if (FS.mode === 'battle' && BT.cur && BT.cur.mode === 'attack' && !game.paused) {
        e.preventDefault();
        const bt = BT.cur, it = bt.tray[bt.sel];
        if (it && it.kind === 'spell') { const t = bt.S.filter((s) => !s.dead && s.counts)[0]; if (t) BT.deploy(bt, t.cx, t.cy); }
        else { const p = BT.randomDeployPoint(bt); BT.deploy(bt, p.x, p.y); }
        return;
      }
    }
    if (FS.mode === 'match' && (k === 'n' || k === 'N')) { game.findMatch(true); return; }
    if (FS.mode === 'battle' && BT.cur && BT.cur.mode === 'attack') {
      if (k === 'Tab' || k === 'e' || k === 'E') { e.preventDefault(); BT.selectNext(BT.cur, e.shiftKey && k === 'Tab' ? -1 : 1); FS.A.sfx('tick'); return; }
      if (k === 'q' || k === 'Q') { e.preventDefault(); BT.selectNext(BT.cur, -1); FS.A.sfx('tick'); return; }
      if (k === 'h' || k === 'H') { BT.ability(BT.cur); return; }
    }
    const step = 60;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') I.pan(step, 0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') I.pan(-step, 0);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') I.pan(0, step);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') I.pan(0, -step);
    else if (k === '+' || k === '=') I.zoomAt(I.W / 2, I.H / 2, 1.15);
    else if (k === '-' || k === '_') I.zoomAt(I.W / 2, I.H / 2, 1 / 1.15);
    else return;
    e.preventDefault();
  }

  // ---------- loop ----------
  let last = performance.now(), fpsAcc = 0, fpsN = 0, hudT = 0, saveT = 0, lastWall = Date.now();
  game.wake = function () {
    const gap = (Date.now() - lastWall) / 1000;
    lastWall = Date.now();
    if (gap > 2) {
      const raids = FS.save.catchUp(gap);
      if (raids.length) UI.awayReport(raids);
      FS.save.write();
    }
  };
  function frame(now) {
    const raw = (now - last) / 1000; last = now;
    fpsAcc += raw; fpsN++;
    if (fpsAcc >= 0.5) { game.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; governor(); }
    const dt = Math.min(0.1, raw);
    const ctx = I.ctx;
    // real-time village simulation always runs
    const wallGap = (Date.now() - lastWall) / 1000;
    if (wallGap > 2) game.wake(); else { V.tick(dt); lastWall = Date.now(); }
    if (FS.mode === 'village') {
      if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 20);
      VV.render(ctx, dt);
      UI.positionPlaceBar();
    } else {
      const bt = BT.cur;
      if (bt) {
        if (FS.mode === 'battle' && !game.paused && bt.started) { holdDeploy(); BT.update(bt, dt); }
        BT.render(ctx, bt, game.paused ? 0 : dt);
        UI.updateBattle(bt);
      }
    }
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.25; UI.updateHUD(); if (UI.modalOpen && UI._modalKind === 'army') UI.refreshArmy && UI.refreshArmy(); }
    saveT += dt;
    if (saveT >= D.AUTOSAVE_SEC) { saveT = 0; FS.save.write(); }
    requestAnimationFrame(frame);
  }
  // adaptive resolution: keep ~60fps on weaker GPUs by lowering the backing-store scale
  const gov = { low: 0, high: 0, ceil: 1, ceilT: 0 };
  function governor() {
    if (document.hidden) return;
    const f = game.fps;
    gov.ceilT = Math.max(0, gov.ceilT - 0.5);
    if (gov.ceilT <= 0) gov.ceil = 1;
    if (f < 52) { gov.low++; gov.high = 0; } else if (f >= 58.5) { gov.high++; gov.low = 0; } else { gov.low = 0; gov.high = 0; }
    if (gov.low >= 2 && I.rs > 0.5) { gov.ceil = I.rs - 0.05; gov.ceilT = 40; I.setScale(I.rs - 0.2); gov.low = 0; }
    else if (gov.high >= 8 && I.rs < Math.min(1, gov.ceil)) { I.setScale(Math.min(gov.ceil, I.rs + 0.1)); gov.high = 0; }
  }
  // cheap periodic refresh of the army/research modal (timers)
  let armyKey = '';
  UI.refreshArmy = function () {
    const st = V.st;
    const key = JSON.stringify([st.army, st.trainQ, Math.floor(st.trainProg), st.spells, st.brewQ, Math.floor(st.hero.hp), st.hero.up && Math.ceil((st.hero.up.end - Date.now()) / 1000), st.gold, st.mead, st.gems]);
    if (key === armyKey) return; armyKey = key;
    UI.renderArmy();
  };

  // ---------- debug (read-only, for automated checks) ----------
  window.__siege = function () {
    const bt = BT.cur, st = V.st;
    const out = {
      mode: FS.mode, fps: Math.round(game.fps), paused: game.paused,
      gold: Math.floor(st.gold), mead: Math.floor(st.mead), rs: Math.floor(st.rs), gems: st.gems, trophies: st.trophies,
      hall: V.hallLv(), builders: V.builders(), buildings: st.b.length, obstacles: st.o.length,
      army: Object.assign({}, st.army), trainQ: st.trainQ.map((q) => q.k + 'x' + q.n), camp: FS.army.campCap(),
      constructing: st.b.filter((b) => b.bt).map((b) => b.t), cam: Object.assign({}, I.cam),
    };
    if (bt) {
      Object.assign(out, { battle: { mode: bt.mode, started: bt.started, units: bt.units.length, pct: BT.pct(bt), stars: bt.stars.filter(Boolean).length, timeLeft: Math.round(bt.timeLeft), deployed: bt.deployed, over: bt.over, loot: bt.lootGot, tray: bt.tray.map((t) => t.k + ':' + t.n) } });
      const pts = [];
      for (let i = 0; i < 400 && pts.length < 6; i++) {
        const gx = 1 + Math.random() * (D.GRID - 2), gy = 1 + Math.random() * (D.GRID - 2);
        if (!BT.canDeploy(bt, gx, gy)) continue;
        const near = bt.forbid[Math.floor(gy) * D.GRID + Math.min(D.GRID - 1, Math.floor(gx) + 2)] || bt.forbid[Math.min(D.GRID - 1, Math.floor(gy) + 2) * D.GRID + Math.floor(gx)] || bt.forbid[Math.max(0, Math.floor(gy) - 2) * D.GRID + Math.floor(gx)] || bt.forbid[Math.floor(gy) * D.GRID + Math.max(0, Math.floor(gx) - 2)];
        if (!near) continue;
        const s = I.gridToScreen(gx, gy);
        if (s.x > 20 && s.x < I.W - 20 && s.y > 140 && s.y < I.H - 170) pts.push({ x: Math.round(s.x), y: Math.round(s.y) });
      }
      out.deployPoints = pts;
    }
    return out;
  };

  // ---------- boot ----------
  function boot() {
    I.init($('game'));
    UI.init();
    const res = FS.save.load();
    I.centerOn(21, 23, I.defaultZoom());
    setMode('village');
    bindInput();
    UI.updateHUD();
    if (res.raids && res.raids.length) setTimeout(() => UI.awayReport(res.raids), 600);
    if (res.fresh) setTimeout(() => UI.toast('Welcome, chieftain!', 'good'), 500);
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.FS = window.FS || {});
