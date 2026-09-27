/* Fenrir Siege — save / load (localStorage, every access guarded), export/import
   as copyable text, offline progress and AI raids while the player was away. */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U, V = FS.V;
  const S = FS.save = {};
  const SKIP = { pop: 1, hit: 1, born: 1 };
  const replacer = (k, v) => (SKIP[k] ? undefined : v);

  S.serialize = () => JSON.stringify(V.st, replacer);
  S.write = function () {
    if (!V.st) return false;
    V.st.lastSeen = Date.now();
    try { localStorage.setItem(D.SAVE_KEY, S.serialize()); return true; } catch (e) { return false; }
  };
  S.read = function () {
    try { const raw = localStorage.getItem(D.SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  };
  function valid(st) { return st && Array.isArray(st.b) && st.b.some((b) => b.t === 'hall') && typeof st.gold === 'number'; }
  function migrate(st) {
    const base = { xp: 0, plv: 1, trophies: 0, best: 0, rs: 0, gems: 0, o: [], army: {}, trainQ: [], trainProg: 0, spells: {}, brewQ: [], brewProg: 0, lab: { lv: {}, cur: null }, hero: { lv: 0, hp: 0, up: null }, shieldEnd: 0, log: [], logUnread: 0, stats: {}, ach: {}, obstT: 0, nextId: 1 };
    for (const k in base) if (st[k] == null) st[k] = base[k];
    for (const k of ['wins', 'stars', 'lootGold', 'lootMead', 'cleared', 'walls', 'defWins', 'trained', 'raids']) if (st.stats[k] == null) st.stats[k] = 0;
    let maxId = 0;
    for (const o of st.b.concat(st.o)) maxId = Math.max(maxId, o.id || 0);
    st.nextId = Math.max(st.nextId, maxId + 1);
    return st;
  }

  // apply offline progress + possible raids; returns new log entries
  S.catchUp = function (elapsedSec) {
    if (elapsedSec <= 1) return [];
    // production / timers / training (chunked so ordering of finishes stays sane)
    let left = elapsedSec;
    while (left > 0) { const d = Math.min(left, 600); V.tick(d); left -= d; }
    return S.maybeRaids(elapsedSec);
  };
  S.maybeRaids = function (elapsedSec) {
    const st = V.st;
    const out = [];
    if (elapsedSec < D.RAID_AWAY_MIN * 60) return out;
    if ((st.shieldEnd || 0) > Date.now()) return out;
    if (!st.b.some((b) => D.B[b.t].cat === 'def' && b.lv >= 1)) { /* still attackable */ }
    const roll = Math.random();
    const n = elapsedSec >= 30 * 60 ? (roll < 0.25 ? 0 : roll < 0.7 ? 1 : 2) : (roll < 0.45 ? 0 : 1);
    for (let i = 0; i < n; i++) {
      const e = S.raid(Date.now() - Math.floor(Math.random() * elapsedSec * 1000 * 0.8));
      out.push(e);
      if (e.shield) break;
    }
    return out;
  };
  // simulate one AI raid on the home village and apply it
  S.raid = function (when) {
    const st = V.st, BT = FS.battle;
    const hall = V.hallLv();
    const seed = U.seed();
    const rng = U.rng(seed ^ 0xabc);
    const attHall = U.clamp(hall + rng.pick([-1, 0, 0, 1]), 1, D.MAX_HALL);
    const layout = BT.playerLayout();
    const { army, plan } = BT.planRaid(attHall, seed, layout);
    const r = BT.simulate({ seed, layout, plan, info: { hall: attHall } });
    // loot lost
    const lost = { gold: 0, mead: 0, rs: 0 };
    for (const pb of r.perBuilding) {
      const b = V.index.get(pb.id); if (!b) continue;
      for (const k in pb.taken) {
        const amt = pb.taken[k];
        if (D.B[b.t].prod) { b.acc = Math.max(0, (b.acc || 0) - amt); }
        else st[k] = Math.max(0, st[k] - amt);
        lost[k] += amt;
      }
    }
    const won = r.stars > 0;
    const want = won ? -U.clamp(Math.round(12 + r.stars * 4 + rng.int(-3, 3)), 5, 30) : U.clamp(rng.int(5, 14), 3, 20);
    const before = st.trophies;
    st.trophies = Math.max(0, st.trophies + want);
    const trophies = st.trophies - before;
    if (!won) st.stats.defWins = (st.stats.defWins || 0) + 1;
    let shield = 0;
    for (const p in D.SHIELD_MIN) if (r.pct >= +p) shield = D.SHIELD_MIN[p];
    if (shield) st.shieldEnd = Math.max(st.shieldEnd || 0, Date.now() + shield * 60 * 1000);
    const e = {
      id: st.nextId++, time: when || Date.now(), name: BT.villageName(rng), chief: rng.pick(D.CHIEF), hall: attHall,
      stars: r.stars, pct: r.pct, lost, trophies, shield, seed, plan, layout, army,
    };
    st.log.unshift(e);
    if (st.log.length > 10) st.log.length = 10;
    st.logUnread = (st.logUnread || 0) + 1;
    return e;
  };

  S.load = function () {
    const st = S.read();
    if (!valid(st)) { V.newGame(); S.write(); return { fresh: true, raids: [] }; }
    V.st = migrate(st);
    V.recalc();
    const elapsed = Math.max(0, (Date.now() - (st.lastSeen || Date.now())) / 1000);
    const raids = S.catchUp(elapsed);
    S.write();
    return { fresh: false, raids, elapsed };
  };
  S.newGame = function () {
    V.newGame(V.st ? V.st.name : undefined);
    S.write();
    FS.game && FS.game.onNewVillage();
  };
  S.exportText = function () {
    const json = S.serialize();
    let b64 = '';
    try { b64 = btoa(unescape(encodeURIComponent(json))); } catch (e) { b64 = ''; }
    return 'FSIEGE1.' + b64;
  };
  S.importText = function (txt) {
    if (!txt) return false;
    txt = txt.trim();
    let json = null;
    try {
      if (txt.startsWith('FSIEGE1.')) json = decodeURIComponent(escape(atob(txt.slice(8))));
      else json = txt;
      const st = JSON.parse(json);
      if (!valid(st)) return false;
      V.st = migrate(st);
      V.st.lastSeen = Date.now();
      V.recalc();
      S.write();
      FS.game && FS.game.onNewVillage();
      return true;
    } catch (e) { return false; }
  };
})(window.FS = window.FS || {});
