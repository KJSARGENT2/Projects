/* Fenrir Siege — army: barracks training queue, camps, Rune Forge research,
   Seidr Hut spells and the hero Fenrir. Operates on FS.V.st. */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U, V = FS.V;
  const A = FS.army = {};
  const st = () => V.st;
  const built = (t) => st().b.filter((b) => b.t === t && b.lv >= 1);

  // ---------- housing ----------
  A.campCap = () => built('camp').reduce((n, b) => n + D.bv('camp', 'housing', b.lv), 0);
  A.armyHS = () => { let n = 0; const a = st().army; for (const k in a) n += (D.TROOPS[k] ? D.TROOPS[k].hs : 0) * a[k]; return n; };
  A.queueHS = () => st().trainQ.reduce((n, q) => n + D.TROOPS[q.k].hs * q.n, 0);
  A.barracksLv = () => built('barracks').reduce((m, b) => Math.max(m, b.lv), 0);
  A.trainers = () => built('barracks').filter((b) => !b.bt).length;
  A.troopLv = (k) => st().lab.lv[k] || 1;
  A.unlocked = function (k) {
    const t = D.TROOPS[k];
    return A.barracksLv() >= t.barracks && V.hallLv() >= (t.hall || 1);
  };
  A.lockText = function (k) {
    const t = D.TROOPS[k];
    if (V.hallLv() < (t.hall || 1)) return 'Great Hall ' + t.hall;
    return 'Barracks ' + t.barracks;
  };
  A.trainCost = (k) => ({ res: D.TROOPS[k].res, amt: D.tv(k, 'cost', A.troopLv(k)) });
  A.train = function (k, n) {
    n = n || 1;
    let done = 0;
    for (let i = 0; i < n; i++) {
      const t = D.TROOPS[k];
      if (!A.unlocked(k)) return { ok: false, msg: 'Locked' };
      if (A.armyHS() + A.queueHS() + t.hs > A.campCap()) { if (!done) return { ok: false, msg: 'Army camps are full' }; break; }
      const c = A.trainCost(k);
      if (!V.spend(c.res, c.amt)) { if (!done) return { ok: false, msg: 'Not enough ' + D.RES[c.res].name.toLowerCase(), need: c }; break; }
      const q = st().trainQ;
      if (q.length && q[q.length - 1].k === k) q[q.length - 1].n++; else q.push({ k, n: 1 });
      done++;
    }
    FS.A.sfx('tap');
    return { ok: true, n: done };
  };
  A.untrain = function (i) {
    const q = st().trainQ; const e = q[i]; if (!e) return;
    const c = A.trainCost(e.k); V.add(c.res, c.amt);
    e.n--; if (e.n <= 0) { q.splice(i, 1); if (i === 0) st().trainProg = 0; }
  };
  A.trainLeft = function () { // seconds until the whole queue is done
    const tr = Math.max(1, A.trainers());
    let s = -st().trainProg;
    for (const q of st().trainQ) s += D.TROOPS[q.k].time * D.TIME_SCALE * q.n;
    return Math.max(0, s / tr);
  };
  A.finishTrainingGems = () => D.speedGems(A.trainLeft());
  A.finishTraining = function () {
    const g = A.finishTrainingGems();
    if (!g) return;
    if (!V.spend('gems', g)) { FS.toast('Not enough gems', 'bad'); return; }
    tickQueue(1e9, 'train');
  };
  // free troops (LIVE key) — ignores cost, respects housing
  A.gift = function (k, hs) {
    let added = 0;
    const t = D.TROOPS[k];
    while (added + t.hs <= hs && A.armyHS() + t.hs <= A.campCap()) { st().army[k] = (st().army[k] || 0) + 1; added += t.hs; }
    return added;
  };

  // ---------- spells ----------
  A.seidrLv = () => built('seidr').reduce((m, b) => Math.max(m, b.lv), 0);
  A.spellCap = () => { const l = A.seidrLv(); return l ? D.bv('seidr', 'spellCap', l) : 0; };
  A.spellCount = () => { let n = 0; for (const k in st().spells) n += st().spells[k] * D.SPELLS[k].space; return n; };
  A.brewHS = () => st().brewQ.reduce((n, q) => n + D.SPELLS[q.k].space * q.n, 0);
  A.spellUnlocked = (k) => A.seidrLv() >= D.SPELLS[k].seidr;
  A.spellLv = (k) => st().lab.lv[k] || 1;
  A.brew = function (k) {
    const s = D.SPELLS[k];
    if (!A.spellUnlocked(k)) return { ok: false, msg: 'Locked' };
    if (A.spellCount() + A.brewHS() + s.space > A.spellCap()) return { ok: false, msg: 'Spell space is full' };
    if (!V.spend(s.res, s.cost)) return { ok: false, msg: 'Not enough mead', need: { res: s.res, amt: s.cost } };
    const q = st().brewQ;
    if (q.length && q[q.length - 1].k === k) q[q.length - 1].n++; else q.push({ k, n: 1 });
    FS.A.sfx('tap');
    return { ok: true };
  };
  A.unbrew = function (i) {
    const q = st().brewQ; const e = q[i]; if (!e) return;
    V.add(D.SPELLS[e.k].res, D.SPELLS[e.k].cost);
    e.n--; if (e.n <= 0) { q.splice(i, 1); if (i === 0) st().brewProg = 0; }
  };

  function tickQueue(dt, which) {
    const s = st();
    const isT = which === 'train';
    const q = isT ? s.trainQ : s.brewQ;
    const rate = isT ? A.trainers() : (built('seidr').some((b) => !b.bt) ? 1 : 0);
    let t = dt * rate;
    let guard = 0;
    while (q.length && t > 0 && guard++ < 5000) {
      const e = q[0];
      const def = isT ? D.TROOPS[e.k] : D.SPELLS[e.k];
      const need = def.time * D.TIME_SCALE - (isT ? s.trainProg : s.brewProg);
      const fits = isT ? A.armyHS() + def.hs <= A.campCap() : A.spellCount() + def.space <= A.spellCap();
      if (!fits) break;
      if (t >= need) {
        t -= need;
        if (isT) { s.army[e.k] = (s.army[e.k] || 0) + 1; s.trainProg = 0; s.stats.trained = (s.stats.trained || 0) + def.hs; }
        else { s.spells[e.k] = (s.spells[e.k] || 0) + 1; s.brewProg = 0; }
        e.n--; if (e.n <= 0) q.shift();
      } else { if (isT) s.trainProg += t; else s.brewProg += t; t = 0; }
    }
  }

  // ---------- research ----------
  A.forgeLv = () => built('forge').reduce((m, b) => Math.max(m, b.lv), 0);
  A.researchMax = () => D.FORGE_MAX[Math.min(D.FORGE_MAX.length - 1, A.forgeLv())];
  A.canResearch = function (k) {
    const lv = st().lab.lv[k] || 1;
    if (st().lab.cur) return { ok: false, msg: 'Forge is busy' };
    if (!A.forgeLv()) return { ok: false, msg: 'Build a Rune Forge' };
    if (built('forge').some((b) => b.bt)) return { ok: false, msg: 'Rune Forge is being upgraded' };
    const isSpell = !!D.SPELLS[k];
    if (isSpell ? !A.spellUnlocked(k) : !A.unlocked(k)) return { ok: false, msg: 'Unlock it first' };
    if (lv >= D.TROOP_MAXLV) return { ok: false, msg: 'Maximum level' };
    if (lv >= A.researchMax()) return { ok: false, msg: 'Upgrade the Rune Forge' };
    return { ok: true, lv };
  };
  A.research = function (k) {
    const c = A.canResearch(k);
    if (!c.ok) return c;
    const to = c.lv + 1;
    const cost = D.researchCost(k, to);
    if (!V.spend(cost.res, cost.amt)) return { ok: false, msg: 'Not enough ' + D.RES[cost.res].name.toLowerCase(), need: cost };
    const dur = D.researchTime(k, to) * 1000;
    st().lab.cur = { k, to, end: Date.now() + dur, dur };
    FS.A.sfx('build');
    return { ok: true };
  };
  A.researchLeft = () => (st().lab.cur ? Math.max(0, (st().lab.cur.end - Date.now()) / 1000) : 0);
  A.speedResearch = function () {
    const g = D.speedGems(A.researchLeft());
    if (!V.spend('gems', g)) return { ok: false, msg: 'Not enough gems' };
    st().lab.cur.end = Date.now();
    return { ok: true };
  };
  function finishResearch() {
    const c = st().lab.cur;
    st().lab.lv[c.k] = c.to; st().lab.cur = null;
    V.addXP(D.xpFor(c.dur / 1000));
    FS.A.sfx('done');
    const name = (D.TROOPS[c.k] || D.SPELLS[c.k]).name;
    FS.toast(name + ' researched to level ' + c.to, 'good');
  }

  // ---------- hero ----------
  A.heroMax = () => D.HERO.hp(Math.max(1, st().hero.lv));
  A.heroMaxLv = () => D.HERO.maxByHall[D.hallIdx(V.hallLv())];
  A.heroReady = () => { const h = st().hero; return h.lv >= 1 && !h.up && h.hp >= A.heroMax() - 0.5; };
  A.heroStatus = function () {
    const h = st().hero;
    if (h.lv < 1) return 'Build the Wolf Den (Great Hall 4)';
    if (h.up) return 'Upgrading — ' + U.fmtTime((h.up.end - Date.now()) / 1000);
    if (h.hp < A.heroMax() - 0.5) return 'Resting — ' + U.fmtTime(A.heroRegenLeft());
    return 'Ready for battle';
  };
  A.heroRegenLeft = () => { const h = st().hero; const need = A.heroMax() - h.hp; return need <= 0 ? 0 : need / (A.heroMax() / (D.HERO.regen(h.lv) * D.TIME_SCALE)); };
  A.heroUpgrade = function () {
    const h = st().hero;
    if (h.lv < 1) return { ok: false, msg: 'Fenrir is not here yet' };
    if (h.up) return { ok: false, msg: 'Already upgrading' };
    if (h.lv >= A.heroMaxLv()) return { ok: false, msg: 'Upgrade the Great Hall first' };
    const cost = D.HERO.cost(h.lv + 1);
    if (V.builders().free <= 0) return { ok: false, msg: 'All builders are busy', builders: true };
    if (!V.spend('rs', cost)) return { ok: false, msg: 'Not enough runestone', need: { res: 'rs', amt: cost } };
    const dur = D.HERO.time(h.lv + 1) * D.TIME_SCALE * 1000;
    h.up = { end: Date.now() + dur, dur, to: h.lv + 1 };
    FS.A.sfx('build');
    return { ok: true };
  };
  A.heroSpeed = function () {
    const h = st().hero; if (!h.up) return { ok: false };
    const g = D.speedGems((h.up.end - Date.now()) / 1000);
    if (!V.spend('gems', g)) return { ok: false, msg: 'Not enough gems' };
    h.up.end = Date.now();
    return { ok: true };
  };

  A.tick = function (dt, now) {
    tickQueue(dt, 'train');
    tickQueue(dt, 'brew');
    const s = st();
    if (s.lab.cur && s.lab.cur.end <= now) finishResearch();
    const h = s.hero;
    if (h.up && h.up.end <= now) {
      h.lv = h.up.to; h.up = null; h.hp = A.heroMax();
      V.addXP(10); FS.A.sfx('done'); FS.toast('Fenrir reached level ' + h.lv, 'good');
    }
    if (h.lv >= 1 && !h.up && h.hp < A.heroMax()) h.hp = Math.min(A.heroMax(), h.hp + A.heroMax() / (D.HERO.regen(h.lv) * D.TIME_SCALE) * dt);
  };
})(window.FS = window.FS || {});
