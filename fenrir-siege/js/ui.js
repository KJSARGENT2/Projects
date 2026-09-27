/* Fenrir Siege — DOM UI: HUD, building sheet, shop, army/research/spells/hero,
   attack + match screen, battle HUD, results, defense log, achievements, menu,
   toasts and in-page confirms. Never uses alert/confirm/prompt. */
(function (FS) {
  'use strict';
  const D = FS.D, U = FS.U, V = FS.V, ART = FS.art;
  const UI = FS.UI = {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  UI.$ = $;

  // ---------- icons ----------
  const SVG = {
    gold: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#ffcf8a"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#b98237" stroke-width="1.8"/><path d="M10 9.5l2-1.5 2 1.5v5l-2 1.5-2-1.5z" fill="#b98237"/></svg>',
    mead: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C12 2.5 4.5 11 4.5 15.2a7.5 7.5 0 0 0 15 0C19.5 11 12 2.5 12 2.5z" fill="#e7a93b"/><path d="M8.5 15a3.5 3.5 0 0 0 3 3.4" stroke="#ffe3ae" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    rs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8L20.5 12 12 22.2 3.5 12z" fill="#8a5cff"/><path d="M10 7.5v9M10 8l4 3-4 2 4 3" stroke="#e2d6ff" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>',
    gems: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10l4.5 6.5L12 21.5 2.5 10z" fill="#9af0ff"/><path d="M2.5 10h19M7 3.5l3 6.5 2 11.5M17 3.5l-3 6.5-2 11.5" stroke="#3aa7c2" stroke-width="1.1" fill="none"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v5a6 6 0 0 1-12 0z" fill="#ffcf8a"/><path d="M6 5H3v2a4 4 0 0 0 4 4M18 5h3v2a4 4 0 0 1-4 4" stroke="#ffcf8a" stroke-width="1.6" fill="none"/><path d="M10 14h4v3h-4zM7.5 18h9v3h-9z" fill="#ffcf8a"/></svg>',
    hammer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l9-9" stroke="#d7c7a8" stroke-width="3" stroke-linecap="round"/><path d="M11 5l4-2 6 6-2 4-3-1-5-5z" fill="#9af0ff"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#1f6bff"/><path d="M12 5l5 2v4c0 3.4-2.2 6-5 7.5" stroke="#9af0ff" stroke-width="1.6" fill="none"/></svg>',
    axes: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 40L34 10M38 40L14 10" stroke="#05080d" stroke-width="4.5" stroke-linecap="round"/><path d="M30 6c6 0 10 4 11 10l-8-2-3-8zM18 6c-6 0-10 4-11 10l8-2 3-8z" fill="#05080d"/></svg>',
    shop: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 18h30l-3 22H12z" fill="#05080d"/><path d="M16 18c0-6 3.5-10 8-10s8 4 8 10" stroke="#05080d" stroke-width="4" fill="none"/><path d="M21 26v8M27 26v8" stroke="#00d9ff" stroke-width="3" stroke-linecap="round"/></svg>',
    army: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14c4-1 8-5 9-11 1 6 5 10 9 11-3 3-6 7-9 7s-6-4-9-7z" fill="none" stroke="#9af0ff" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="2.4" fill="#00d9ff"/></svg>',
    log: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="none" stroke="#9af0ff" stroke-width="1.8"/><path d="M8.5 11.5l2.5 2.5 4.5-5" stroke="#00d9ff" stroke-width="2" fill="none"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="none" stroke="#9af0ff" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="#9af0ff" stroke-width="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#9af0ff" stroke-width="1.8" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    wolf: '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#00d9ff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 6 L25 21 H39 L52 6 L54 32 L42 46 L32 58 L22 46 L10 32 Z"/><path d="M21 32 L27 35 M43 32 L37 35 M28 48 H36"/></svg>',
  };
  UI.SVG = SVG;
  const ic = (k, cls) => '<i class="ic ' + (cls || '') + '">' + SVG[k] + '</i>';
  UI.ic = ic;
  UI.resIcon = function (ctx, res, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    const s = r / 10;
    if (res === 'gold') {
      ctx.fillStyle = '#ffcf8a'; ctx.beginPath(); ctx.arc(0, 0, 9 * s, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#b98237'; ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.arc(0, 0, 5.8 * s, 0, 6.283); ctx.stroke();
    } else if (res === 'mead') {
      ctx.fillStyle = '#e7a93b'; ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.bezierCurveTo(-3 * s, -5 * s, -7.5 * s, 0, -7.5 * s, 3 * s); ctx.arc(0, 3 * s, 7.5 * s, Math.PI, 0, true); ctx.bezierCurveTo(7.5 * s, 0, 3 * s, -5 * s, 0, -10 * s); ctx.fill();
      ctx.strokeStyle = '#ffe3ae'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.arc(0, 3 * s, 4 * s, 2.2, 3.2); ctx.stroke();
    } else if (res === 'rs') {
      ctx.fillStyle = '#8a5cff'; ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.lineTo(8 * s, 0); ctx.lineTo(0, 10 * s); ctx.lineTo(-8 * s, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e2d6ff'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(-2 * s, -5 * s); ctx.lineTo(-2 * s, 5 * s); ctx.moveTo(-2 * s, -4 * s); ctx.lineTo(2.5 * s, -1 * s); ctx.lineTo(-2 * s, 1 * s); ctx.stroke();
    } else {
      ctx.fillStyle = '#9af0ff'; ctx.beginPath(); ctx.moveTo(-5 * s, -8 * s); ctx.lineTo(5 * s, -8 * s); ctx.lineTo(9 * s, -2 * s); ctx.lineTo(0, 9 * s); ctx.lineTo(-9 * s, -2 * s); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  const cost = (res, amt, have) => `<span class="cost ${have === false || (have == null && !V.has(res, amt)) ? 'short' : ''}">${ic(res)}${U.fmt(amt)}</span>`;
  UI.cost = cost;

  // ---------- toasts ----------
  UI.toast = function (text, kind) {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'info');
    t.innerHTML = '<span class="dot"></span><span>' + esc(text) + '</span>';
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 2300);
  };
  FS.toast = UI.toast;

  // ---------- confirm ----------
  UI.confirm = function (title, msg, yes, onYes, no) {
    const c = $('confirm');
    $('confirm-title').textContent = title;
    $('confirm-msg').innerHTML = msg;
    $('confirm-yes').innerHTML = yes || 'OK';
    $('confirm-no').textContent = no || 'Cancel';
    c.hidden = false;
    UI._confirmYes = onYes;
    $('confirm-yes').focus();
  };
  UI.closeConfirm = () => { $('confirm').hidden = true; UI._confirmYes = null; };

  // resource fill with gems when short
  const fillGems = (n) => Math.max(1, Math.ceil(Math.pow(n, 0.72) / 6));
  UI.fail = function (res, retry) {
    if (res && res.need && res.need.res !== 'gems') {
      const need = res.need.amt - V.st[res.need.res];
      const g = fillGems(need);
      const name = D.RES[res.need.res].name;
      UI.confirm('Not enough ' + name.toLowerCase(), `You need ${U.fmtFull(need)} more ${name.toLowerCase()}.`, `Buy for ${ic('gems')}${g}`, () => {
        if (V.caps()[res.need.res] < res.need.amt) { UI.toast('Storage too small — build or upgrade storage', 'bad'); return; }
        if (!V.spend('gems', g)) { UI.toast('Not enough gems', 'bad'); return; }
        V.st[res.need.res] += need;
        if (retry) { const r = retry(); if (r && !r.ok) UI.fail(r); }
      });
      return;
    }
    FS.A.sfx('no');
    UI.toast(res && res.msg ? res.msg : 'Not possible', 'bad');
  };

  // ---------- HUD ----------
  UI.init = function () {
    $('btn-shop').innerHTML = SVG.shop + '<span>Shop</span>';
    $('btn-attack').innerHTML = SVG.axes + '<span>Attack!</span>';
    $('btn-army').innerHTML = SVG.army + '<span>Army</span>';
    $('btn-log').innerHTML = SVG.log + '<span>Log</span><b class="badge" id="log-badge" hidden></b>';
    $('btn-ach').innerHTML = SVG.star + '<span>Awards</span><b class="badge" id="ach-badge" hidden></b>';
    $('btn-menu').innerHTML = SVG.gear + '<span>Menu</span>';
    $('brand').innerHTML = SVG.wolf;
    for (const r of ['gold', 'mead', 'rs', 'gems']) {
      const row = document.createElement('div');
      row.className = 'res'; row.dataset.res = r;
      row.innerHTML = `<div class="res-bar"><i class="fill"></i><b class="val">0</b><span class="cap"></span></div>${ic(r, 'res-ic')}`;
      $('res').appendChild(row);
    }
    $('trophy-ic').innerHTML = SVG.trophy;
    $('chip-builders').innerHTML = SVG.hammer + '<b id="builders-txt">0/0</b>';
    $('chip-shield').innerHTML = SVG.shield + '<b id="shield-txt"></b>';
    bind();
  };
  let hudCache = {};
  const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; const e = $(id); if (e) e.textContent = v; } };
  UI.updateHUD = function () {
    const st = V.st;
    setText('plv', st.plv);
    setText('pname', st.name);
    setText('trophies', U.fmtFull(st.trophies));
    const L = D.league(st.trophies);
    setText('league', L.name);
    $('league').style.color = L.col;
    $('xpfill').style.width = Math.round(st.xp / D.xpNeed(st.plv) * 100) + '%';
    const caps = V.caps();
    for (const r of ['gold', 'mead', 'rs', 'gems']) {
      const row = $('res').querySelector(`[data-res="${r}"]`);
      if (r === 'rs' && caps.rs <= 0 && st.rs <= 0) { row.hidden = true; continue; }
      row.hidden = false;
      const v = U.fmtFull(st[r]);
      const k = 'res-' + r;
      if (hudCache[k] !== v) { hudCache[k] = v; row.querySelector('.val').textContent = v; row.classList.toggle('long', v.length > 7); row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump'); }
      if (r !== 'gems') {
        row.querySelector('.fill').style.width = Math.min(100, st[r] / Math.max(1, caps[r]) * 100) + '%';
        setText('cap-' + r, '');
        const capE = row.querySelector('.cap'); const cv = 'max ' + U.fmt(caps[r]);
        if (capE.textContent !== cv) capE.textContent = cv;
        row.classList.toggle('full', st[r] >= caps[r]);
      } else row.querySelector('.fill').style.width = '100%';
    }
    const b = V.builders();
    setText('builders-txt', b.free + '/' + b.total);
    const sh = (st.shieldEnd || 0) - Date.now();
    $('chip-shield').hidden = sh <= 0;
    if (sh > 0) setText('shield-txt', U.fmtTime(sh / 1000));
    const lb = $('log-badge'); lb.hidden = !st.logUnread; lb.textContent = st.logUnread;
    const ab = $('ach-badge'); const ar = V.achReady(); ab.hidden = !ar; ab.textContent = ar;
    if (VVsel()) UI.refreshSheetTimers();
  };
  const VVsel = () => FS.VV && FS.VV.sel;

  // ---------- building sheet ----------
  let sheetFor = null;
  UI.onSelect = function (o) {
    sheetFor = o;
    const sh = $('sheet');
    if (!o) { sh.classList.remove('open'); setTimeout(() => { if (!sheetFor) sh.hidden = true; }, 200); $('hud-bottom').classList.remove('hide'); return; }
    sh.hidden = false; requestAnimationFrame(() => sh.classList.add('open'));
    $('hud-bottom').classList.add('hide');
    UI.renderSheet();
  };
  UI.onPlacing = function (on) {
    $('place-bar').hidden = !on;
    $('hud-bottom').classList.toggle('hide', on);
    if (on) { const g = FS.VV.ghost; $('place-name').textContent = g ? D.B[g.type].name + (g.type === 'wall' ? ' — drag to paint a line' : '') : ''; }
  };
  UI.positionPlaceBar = function () {
    const p = FS.VV.ghostScreen();
    const bar = $('place-bar');
    if (!p || bar.hidden) return;
    const x = U.clamp(p.x, 90, window.innerWidth - 90), y = U.clamp(p.y - 30, 90, window.innerHeight - 120);
    bar.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    $('place-ok').classList.toggle('bad', !(FS.VV.ghost && FS.VV.ghost.ok));
  };
  function statRows(o) {
    const rows = [];
    if (V.isObst(o)) return rows;
    const def = D.B[o.t], lv = Math.max(1, o.lv), nx = o.lv + 1, canNext = nx <= D.levels(o.t);
    const row = (label, cur, next) => rows.push(`<div class="stat"><span>${label}</span><b>${cur}${next != null && canNext && !o.bt ? ` <em>→ ${next}</em>` : ''}</b></div>`);
    row('Hitpoints', U.fmtFull(D.bv(o.t, 'hp', lv)), U.fmtFull(D.bv(o.t, 'hp', nx)));
    if (def.dps) { row('Damage/sec', D.bv(o.t, 'dps', lv), D.bv(o.t, 'dps', nx)); row('Range', def.range + ' tiles' + (def.min ? ' (min ' + def.min + ')' : '') + ' · ' + (def.air && def.ground ? 'Air & ground' : def.air ? 'Air only' : 'Ground only')); }
    if (def.dmg) row('Damage', D.bv(o.t, 'dmg', lv), D.bv(o.t, 'dmg', nx));
    if (def.prod) { row('Production/h', U.fmtFull(D.bv(o.t, 'rate', lv) * D.PROD_SCALE / D.TIME_SCALE), U.fmtFull(D.bv(o.t, 'rate', nx) * D.PROD_SCALE / D.TIME_SCALE)); row('Holds', U.fmtFull(Math.floor(o.acc || 0)) + ' / ' + U.fmtFull(D.bv(o.t, 'cap', lv))); }
    if (def.store) for (const k in def.store) { const a = def.store[k]; if (a[lv - 1] > 0) row(D.RES[k].name + ' storage', U.fmtFull(a[Math.min(a.length, lv) - 1]), a[nx - 1] != null ? U.fmtFull(a[nx - 1]) : null); }
    if (def.housing) row('Housing', D.bv(o.t, 'housing', lv), D.bv(o.t, 'housing', nx));
    if (def.spellCap) row('Spell space', D.bv(o.t, 'spellCap', lv), D.bv(o.t, 'spellCap', nx));
    if (o.t === 'barracks') { const un = D.TROOP_ORDER.filter((k) => D.TROOPS[k].barracks === nx && !D.TROOPS[k].hall); if (un.length && canNext) row('Unlocks', D.TROOPS[un[0]].name); }
    if (o.t === 'forge') row('Research cap', 'Level ' + D.FORGE_MAX[Math.min(8, lv)], canNext ? 'Level ' + D.FORGE_MAX[Math.min(8, nx)] : null);
    if (o.t === 'wall') row('Material', D.WALL_MATERIAL[lv - 1], canNext ? D.WALL_MATERIAL[nx - 1] : null);
    if (o.t === 'wolfden') row('Fenrir', FS.army.heroStatus());
    return rows;
  }
  UI.renderSheet = function () {
    const o = sheetFor; if (!o) return;
    const isObs = V.isObst(o);
    const name = isObs ? D.OBST[o.t].name : D.B[o.t].name;
    let lvl = isObs ? 'Obstacle' : o.lv < 1 ? 'Under construction' : 'Level ' + o.lv;
    if (o.t === 'wall' && FS.VV.rowSel) lvl += ' · ' + FS.VV.rowSel.length + ' in row';
    $('sheet-title').innerHTML = `${esc(name)} <small>${lvl}</small>`;
    $('sheet-stats').innerHTML = statRows(o).join('');
    const btns = [];
    const B = (id, label, cls, extra) => btns.push(`<button type="button" class="sbtn ${cls || ''}" data-act="${id}">${extra || ''}<span>${label}</span></button>`);
    if (isObs) {
      if (o.clr) B('speedclr', 'Clearing…', 'ghostb');
      else { const d = D.OBST[o.t]; B('clear', 'Remove ' + cost(d.res, d.cost), 'pri'); }
    } else if (o.bt) {
      B('speed', 'Finish ' + cost('gems', D.speedGems(V.remaining(o))), 'pri', '');
      B('cancel', 'Cancel', 'danger');
    } else {
      B('info', 'Info', 'ghostb');
      const max = V.maxLevel(o.t);
      if (o.t === 'wall' && FS.VV.rowSel && FS.VV.rowSel.length > 1) {
        const per = D.bv('wall', 'cost', o.lv + 1);
        if (o.lv < max) B('uprow', `Upgrade ${FS.VV.rowSel.length} ${cost('gold', per * FS.VV.rowSel.length)}`, 'pri');
      } else if (o.lv < D.levels(o.t) && o.t !== 'builder') {
        if (o.lv >= max) B('none', 'Needs Great Hall ' + (V.hallLv() + 1), 'ghostb dis');
        else {
          const c = V.costOf(o);
          B('upgrade', `Upgrade ${cost(c.res, c.amt)}${c.time > 0 ? `<em>${ic('clock', 'tiny')}${U.fmtTime(c.time)}</em>` : ''}`, 'pri');
        }
      }
      if (o.t === 'wall') B('row', 'Select row', 'ghostb');
      if (D.B[o.t].prod) B('collect', 'Collect', 'ghostb');
      if (o.t === 'barracks' || o.t === 'camp') B('train', 'Train', 'ghostb');
      if (o.t === 'forge') B('research', 'Research', 'ghostb');
      if (o.t === 'seidr') B('brew', 'Brew', 'ghostb');
      if (o.t === 'wolfden') B('hero', 'Fenrir', 'ghostb');
    }
    $('sheet-btns').innerHTML = btns.join('');
  };
  UI.refreshSheetTimers = function () {
    const o = sheetFor; if (!o) return;
    const key = (o.bt ? 'b' + Math.ceil(V.remaining(o)) : 'n') + ':' + o.lv + ':' + (o.clr ? 1 : 0) + ':' + Math.floor(o.acc || 0) + ':' + V.st.gold + ':' + V.st.mead + ':' + V.st.gems + ':' + (FS.VV.rowSel ? FS.VV.rowSel.length : 0);
    if (UI._sheetKey === key) return;
    UI._sheetKey = key;
    UI.renderSheet();
  };
  function sheetAction(act) {
    const o = sheetFor; if (!o) return;
    let r = null;
    if (act === 'upgrade') { r = V.upgrade(o); if (!r.ok) UI.fail(r, () => V.upgrade(o)); }
    else if (act === 'speed') { r = V.speedUp(o); if (!r.ok) UI.fail(r); }
    else if (act === 'cancel') UI.confirm('Cancel construction?', 'You get 50% of the cost back.', 'Cancel it', () => { V.cancel(o); if (o.lv < 1) FS.VV.select(null); UI.renderSheet(); }, 'Keep building');
    else if (act === 'collect') V.collect(o);
    else if (act === 'clear') { r = V.clear(o); if (!r.ok) UI.fail(r, () => V.clear(o)); }
    else if (act === 'info') UI.openInfo(o);
    else if (act === 'train') UI.openArmy('train');
    else if (act === 'brew') UI.openArmy('spells');
    else if (act === 'hero') UI.openArmy('hero');
    else if (act === 'research') UI.openResearch();
    else if (act === 'row') { FS.VV.rowSel = V.wallRow(o); }
    else if (act === 'uprow') { r = V.upgradeWalls(FS.VV.rowSel); if (!r.ok) UI.fail(r, () => V.upgradeWalls(FS.VV.rowSel)); else FS.VV.rowSel = V.wallRow(o); }
    UI._sheetKey = null;
    UI.renderSheet();
  }

  // ---------- modal helpers ----------
  UI.modal = function (title, html, cls) {
    $('modal-title').innerHTML = title;
    $('modal-body').innerHTML = html;
    $('modal').className = 'modal m-' + (cls || 'x');
    $('modal').hidden = false;
    UI.modalOpen = true;
  };
  UI.closeModal = function () { $('modal').hidden = true; UI.modalOpen = false; UI._modalKind = null; };
  function tabs(active, list) { return '<div class="tabs">' + list.map(([id, n]) => `<button type="button" class="tab ${id === active ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('') + '</div>'; }

  // ---------- shop ----------
  UI.openShop = function (tab) {
    tab = tab || UI._shopTab || 'res';
    UI._shopTab = tab; UI._modalKind = 'shop';
    const cat = D.SHOP.find((c) => c.id === tab);
    const cards = cat.types.map((t) => {
      const lock = V.lockReason(t);
      const c = V.buildCost(t);
      const n = V.count(t), max = V.maxCount(t);
      return `<button type="button" class="card-b ${lock ? 'locked' : ''}" data-shop="${t}">
        <canvas class="thumb" width="160" height="120" data-thumb="${t}"></canvas>
        <b>${esc(D.B[t].name)}</b>
        <span class="cnt">${t === 'builder' ? n + '/' + max : Math.min(n, 999) + '/' + max}</span>
        ${lock ? `<span class="lock">${esc(lock)}</span>` : `<span class="row">${cost(c.res, c.amt)}${c.time > 0 ? `<em>${ic('clock', 'tiny')}${U.fmtTime(c.time)}</em>` : ''}</span>`}
      </button>`;
    }).join('');
    UI.modal('Shop', tabs(tab, D.SHOP.map((c) => [c.id, c.name])) + `<div class="grid shop-grid">${cards}</div>`, 'shop');
    document.querySelectorAll('[data-thumb]').forEach((cv) => ART.thumb(cv, cv.dataset.thumb, 1));
  };

  // ---------- army (train / spells / hero) ----------
  UI.openArmy = function (tab) {
    tab = tab || UI._armyTab || 'train';
    UI._armyTab = tab; UI._modalKind = 'army';
    UI.modal('Army', tabs(tab, [['train', 'Troops'], ['spells', 'Spells'], ['hero', 'Fenrir']]) + '<div id="army-body"></div>', 'army');
    UI.renderArmy();
  };
  UI.renderArmy = function () {
    const body = $('army-body'); if (!body) return;
    const A = FS.army, st = V.st, tab = UI._armyTab;
    let h = '';
    if (tab === 'train') {
      const cap = A.campCap(), used = A.armyHS(), q = A.queueHS();
      h += `<div class="capbar"><span>Army camps</span><div class="bar"><i style="width:${Math.min(100, used / Math.max(1, cap) * 100)}%"></i><i class="q" style="width:${Math.min(100, q / Math.max(1, cap) * 100)}%"></i></div><b>${used}${q ? '+' + q : ''} / ${cap}</b></div>`;
      h += '<div class="lbl">Ready</div><div class="chips">' + (D.TROOP_ORDER.filter((k) => st.army[k] > 0).map((k) => `<span class="chip"><canvas width="48" height="48" data-icon="troop:${k}"></canvas><b>×${st.army[k]}</b></span>`).join('') || '<span class="muted">No troops yet — tap a troop below to train.</span>') + '</div>';
      if (st.trainQ.length) {
        h += `<div class="lbl">Training <span class="muted">· ${U.fmtTime(A.trainLeft())} left${A.trainers() > 1 ? ' · ' + A.trainers() + ' barracks' : ''}</span> <button type="button" class="mini pri" data-act="finishtrain">Finish ${cost('gems', A.finishTrainingGems())}</button></div><div class="chips">`;
        h += st.trainQ.map((e, i) => `<button type="button" class="chip q" data-untrain="${i}" title="Tap to remove one"><canvas width="48" height="48" data-icon="troop:${e.k}"></canvas><b>×${e.n}</b><span class="x">−</span></button>`).join('') + '</div>';
        if (A.armyHS() + D.TROOPS[st.trainQ[0].k].hs > cap) h += '<div class="warn">Army camps are full — training paused.</div>';
        if (!A.trainers()) h += '<div class="warn">No barracks available — training paused.</div>';
      }
      h += '<div class="lbl">Train</div><div class="grid troop-grid">';
      for (const k of D.TROOP_ORDER) {
        const t = D.TROOPS[k], un = A.unlocked(k), c = A.trainCost(k);
        h += `<button type="button" class="tcard ${un ? '' : 'locked'}" data-train="${k}"><canvas width="64" height="64" data-icon="troop:${k}"></canvas><b>${esc(t.name)}</b><span class="lv">Lv ${A.troopLv(k)} · ${t.hs} space</span>${un ? cost(c.res, c.amt) : `<span class="lock">${A.lockText(k)}</span>`}</button>`;
      }
      h += '</div>';
    } else if (tab === 'spells') {
      const cap = A.spellCap();
      if (!cap) h += '<div class="empty">Build a <b>Seidr Hut</b> (Great Hall 3) to brew spells.</div>';
      else {
        h += `<div class="capbar"><span>Spell space</span><div class="bar"><i style="width:${A.spellCount() / cap * 100}%"></i><i class="q" style="width:${A.brewHS() / cap * 100}%"></i></div><b>${A.spellCount()}${A.brewHS() ? '+' + A.brewHS() : ''} / ${cap}</b></div>`;
        h += '<div class="chips">' + D.SPELL_ORDER.filter((k) => st.spells[k] > 0).map((k) => `<span class="chip"><canvas width="48" height="48" data-icon="spell:${k}"></canvas><b>×${st.spells[k]}</b></span>`).join('') + st.brewQ.map((e, i) => `<button type="button" class="chip q" data-unbrew="${i}"><canvas width="48" height="48" data-icon="spell:${e.k}"></canvas><b>×${e.n}</b><span class="x">−</span></button>`).join('') + '</div>';
      }
      h += '<div class="grid troop-grid">';
      for (const k of D.SPELL_ORDER) {
        const s = D.SPELLS[k], un = A.spellUnlocked(k);
        h += `<button type="button" class="tcard ${un ? '' : 'locked'}" data-brew="${k}"><canvas width="64" height="64" data-icon="spell:${k}"></canvas><b>${esc(s.name)}</b><span class="lv">Lv ${A.spellLv(k)}</span>${un ? cost(s.res, s.cost) : `<span class="lock">Seidr Hut ${s.seidr}</span>`}</button>`;
      }
      h += '</div>';
    } else {
      const hr = st.hero;
      h += `<div class="hero-card"><canvas width="120" height="120" data-icon="hero:hero"></canvas><div><b class="big">${D.HERO.name}${hr.lv ? ' · Lv ' + hr.lv : ''}</b><p>${esc(D.HERO.desc)}</p><p class="muted">${esc(A.heroStatus())}</p>`;
      if (hr.lv >= 1) {
        const mh = A.heroMax();
        h += `<div class="capbar"><span>Health</span><div class="bar"><i style="width:${hr.hp / mh * 100}%"></i></div><b>${Math.floor(hr.hp)} / ${mh}</b></div>`;
        h += `<div class="stat"><span>Damage/sec</span><b>${D.HERO.dps(hr.lv)}${hr.lv < A.heroMaxLv() ? ' <em>→ ' + D.HERO.dps(hr.lv + 1) + '</em>' : ''}</b></div>`;
        h += `<div class="stat"><span>Ability</span><b>${D.HERO.ability.name}: heal ${D.HERO.ability.heal * 100}% + rage ${D.HERO.ability.dur}s</b></div>`;
        if (hr.up) h += `<button type="button" class="sbtn pri" data-act="herospeed"><span>Finish ${cost('gems', D.speedGems((hr.up.end - Date.now()) / 1000))}</span></button>`;
        else if (hr.lv < A.heroMaxLv()) h += `<button type="button" class="sbtn pri" data-act="heroup"><span>Upgrade ${cost('rs', D.HERO.cost(hr.lv + 1))} <em>${ic('clock', 'tiny')}${U.fmtTime(D.HERO.time(hr.lv + 1) * D.TIME_SCALE)}</em></span></button>`;
        else h += '<div class="muted">Max level for this Great Hall.</div>';
      }
      h += '</div></div>';
    }
    body.innerHTML = h;
    paintIcons(body);
  };
  function paintIcons(root) {
    root.querySelectorAll('canvas[data-icon]').forEach((cv) => { const [kind, key] = cv.dataset.icon.split(':'); ART.icon(cv, kind, key, 'ally'); });
  }
  UI.paintIcons = paintIcons;

  // ---------- research ----------
  UI.openResearch = function () {
    UI._modalKind = 'research';
    UI.modal('Rune Forge', '<div id="research-body"></div>', 'army');
    UI.renderResearch();
  };
  UI.renderResearch = function () {
    const body = $('research-body'); if (!body) return;
    const A = FS.army, st = V.st;
    let h = '';
    const cur = st.lab.cur;
    if (cur) {
      const n = (D.TROOPS[cur.k] || D.SPELLS[cur.k]).name;
      h += `<div class="capbar"><span>Researching ${esc(n)} → ${cur.to}</span><div class="bar"><i style="width:${(1 - A.researchLeft() * 1000 / cur.dur) * 100}%"></i></div><b>${U.fmtTime(A.researchLeft())}</b></div><button type="button" class="sbtn pri wide" data-act="rspeed"><span>Finish ${cost('gems', D.speedGems(A.researchLeft()))}</span></button>`;
    } else if (!A.forgeLv()) h += '<div class="empty">Build a Rune Forge (Great Hall 2).</div>';
    else h += `<div class="muted">Forge level ${A.forgeLv()} — research up to level ${A.researchMax()}.</div>`;
    h += '<div class="grid troop-grid">';
    for (const k of D.TROOP_ORDER.concat(D.SPELL_ORDER)) {
      const isS = !!D.SPELLS[k];
      const lv = st.lab.lv[k] || 1;
      const c = A.canResearch(k);
      const next = lv + 1;
      const cc = next <= D.TROOP_MAXLV ? D.researchCost(k, next) : null;
      const name = (D.TROOPS[k] || D.SPELLS[k]).name;
      h += `<button type="button" class="tcard ${c.ok ? '' : 'locked'}" data-research="${k}"><canvas width="64" height="64" data-icon="${isS ? 'spell' : 'troop'}:${k}"></canvas><b>${esc(name)}</b><span class="lv">Level ${lv}</span>${c.ok && cc ? cost(cc.res, cc.amt) + `<em>${ic('clock', 'tiny')}${U.fmtTime(D.researchTime(k, next))}</em>` : `<span class="lock">${esc(c.msg || '')}</span>`}</button>`;
    }
    h += '</div>';
    body.innerHTML = h;
    paintIcons(body);
  };

  // ---------- info ----------
  UI.openInfo = function (o) {
    const def = D.B[o.t];
    const n = D.levels(o.t);
    let rows = '<table class="tbl"><tr><th>Lv</th><th>HP</th>' + (def.dps ? '<th>DPS</th>' : '') + (def.rate && def.prod ? '<th>/hour</th>' : '') + '<th>Cost</th><th>Time</th></tr>';
    for (let l = 1; l <= n; l++) {
      rows += `<tr class="${l === o.lv ? 'on' : ''}"><td>${l}</td><td>${U.fmt(D.bv(o.t, 'hp', l))}</td>` + (def.dps ? `<td>${D.bv(o.t, 'dps', l)}</td>` : '') + (def.rate && def.prod ? `<td>${U.fmt(D.bv(o.t, 'rate', l))}</td>` : '') + `<td>${cost(def.res, D.bv(o.t, 'cost', l), true)}</td><td>${U.fmtTime(D.btime(o.t, l))}</td></tr>`;
    }
    rows += '</table>';
    UI._modalKind = 'info';
    UI.modal(esc(def.name), `<canvas class="thumb big" width="220" height="170" data-thumb="${o.t}"></canvas><p>${esc(def.desc)}</p>${rows}`, 'info');
    document.querySelectorAll('[data-thumb]').forEach((cv) => ART.thumb(cv, cv.dataset.thumb, Math.max(1, o.lv)));
  };

  // ---------- attack ----------
  UI.openAttack = function () {
    UI._modalKind = 'attack';
    const A = FS.army, st = V.st;
    const fc = D.FIND_COST[D.hallIdx(V.hallLv())];
    const troops = D.TROOP_ORDER.filter((k) => st.army[k] > 0);
    let h = `<div class="attack-hero"><div class="lbl">Your army · ${A.armyHS()} / ${A.campCap()}</div><div class="chips">` +
      (troops.map((k) => `<span class="chip"><canvas width="48" height="48" data-icon="troop:${k}"></canvas><b>×${st.army[k]}</b></span>`).join('') || '<span class="muted">No troops trained.</span>') +
      D.SPELL_ORDER.filter((k) => st.spells[k] > 0).map((k) => `<span class="chip"><canvas width="48" height="48" data-icon="spell:${k}"></canvas><b>×${st.spells[k]}</b></span>`).join('') +
      (st.hero.lv >= 1 ? `<span class="chip ${A.heroReady() ? '' : 'dim'}"><canvas width="48" height="48" data-icon="hero:hero"></canvas><b>${A.heroReady() ? 'Lv ' + st.hero.lv : 'Resting'}</b></span>` : '') +
      '</div></div>';
    if ((st.shieldEnd || 0) > Date.now()) h += '<div class="warn">Attacking now will break your shield.</div>';
    h += `<button type="button" class="big-btn" id="btn-find" ${troops.length ? '' : 'disabled'}>${SVG.axes}<span>Find a match</span>${cost('gold', fc)}</button>`;
    h += '<button type="button" class="sbtn ghostb wide" data-act="gotrain"><span>Train troops</span></button>';
    UI.modal('Raid', h, 'attack');
    paintIcons($('modal-body'));
  };
  UI.showMatch = function (m) {
    const p = $('match');
    p.hidden = false;
    const fc = D.FIND_COST[D.hallIdx(V.hallLv())];
    p.innerHTML = `<div class="mcard">
      <div class="mhead"><div><div class="lbl">Enemy village</div><b class="big">${esc(m.name)}</b><div class="muted">${esc(m.chief)} · Great Hall ${m.hall} · ${ic('trophy', 'tiny')}${m.trophies}</div></div>
      <div class="offer"><div class="lbl">Trophies</div><b class="win">+${m.offer.win}</b><b class="lose">−${m.offer.lose}</b></div></div>
      <div class="lbl">Available loot</div>
      <div class="loot">${['gold', 'mead', 'rs'].filter((k) => m.lootTotal[k] > 0 || k !== 'rs').map((k) => `<span>${ic(k)}<b>${U.fmtFull(m.lootTotal[k])}</b></span>`).join('')}</div>
      <div class="mbtns"><button type="button" class="sbtn ghostb" id="btn-match-home"><span>Home</span></button><button type="button" class="sbtn ghostb" id="btn-next"><span>Next ${cost('gold', fc)}</span></button><button type="button" class="sbtn pri attack" id="btn-start-attack"><span>Attack!</span></button></div>
    </div>`;
  };
  UI.hideMatch = () => { $('match').hidden = true; };

  // ---------- battle HUD ----------
  let bh = {};
  UI.showBattle = function (bt) {
    bh = {};
    $('battle').hidden = false;
    $('bh-title').textContent = bt.mode === 'replay' ? 'Replay: ' + bt.info.name : bt.info.name || '';
    $('bh-sub').textContent = bt.mode === 'replay' ? 'Great Hall ' + bt.info.hall + ' raider' : 'Great Hall ' + (bt.info.hall || '?');
    $('bh-loot-lbl').textContent = bt.mode === 'replay' ? 'Loot lost' : 'Available loot';
    $('btn-end').hidden = bt.mode === 'replay';
    $('btn-skip').hidden = bt.mode !== 'replay';
    $('btn-speed').hidden = bt.mode !== 'replay';
    $('btn-speed').textContent = '2×';
    UI.renderTray(bt);
  };
  UI.hideBattle = () => { $('battle').hidden = true; };
  UI.renderTray = function (bt) {
    const tray = $('tray');
    if (bt.mode !== 'attack') { tray.innerHTML = ''; tray.hidden = true; return; }
    tray.hidden = false;
    tray.innerHTML = bt.tray.map((t, i) => {
      const nm = t.kind === 'spell' ? D.SPELLS[t.k].name : t.kind === 'hero' ? D.HERO.name : D.TROOPS[t.k].name;
      const lv = t.kind === 'spell' ? (bt.spellLv[t.k] || 1) : t.kind === 'hero' ? t.lv : (bt.troopLv[t.k] || 1);
      return `<button type="button" class="tray-card ${t.kind}" data-tray="${i}" aria-label="${esc(nm)}"><canvas width="56" height="56" data-icon="${t.kind}:${t.k}"></canvas><b class="n"></b><span class="tlv">${lv}</span><span class="nm">${esc(nm)}</span></button>`;
    }).join('');
    paintIcons(tray);
    bh.tray = null;
  };
  UI.updateBattle = function (bt) {
    const tl = bt.started === false ? D.BATTLE_TIME : bt.timeLeft;
    const t = U.fmtClock(tl);
    if (bh.t !== t) { bh.t = t; $('bh-time').textContent = t; $('bh-time').classList.toggle('low', tl <= 20 && bt.started !== false); }
    const pct = FS.battle.pct(bt) + '%';
    if (bh.p !== pct) { bh.p = pct; $('bh-pct').textContent = pct; }
    const sk = bt.stars.map((s) => (s ? 1 : 0)).join('');
    if (bh.s !== sk) { bh.s = sk; $('bh-stars').innerHTML = bt.stars.map((s) => `<i class="${s ? 'on' : ''}">★</i>`).join(''); }
    const lk = bt.mode === 'replay' ? bt.lootGot : bt.lootAvail;
    const lootK = ['gold', 'mead', 'rs'].map((k) => Math.floor(lk[k])).join(',') + '|' + ['gold', 'mead', 'rs'].map((k) => Math.floor(bt.lootGot[k])).join(',');
    if (bh.l !== lootK) {
      bh.l = lootK;
      $('bh-loot').innerHTML = ['gold', 'mead', 'rs'].filter((k) => bt.lootStart[k] > 0 || k !== 'rs').map((k) => `<span>${ic(k)}<b>${U.fmtFull(Math.max(0, lk[k]))}</b></span>`).join('');
      const anyGot = ['gold', 'mead', 'rs'].some((k) => bt.lootGot[k] >= 1);
      $('bh-got').innerHTML = bt.mode === 'replay' || !anyGot ? '' : 'Gained ' + ['gold', 'mead', 'rs'].filter((k) => bt.lootGot[k] >= 1).map((k) => `${ic(k, 'tiny')}${U.fmt(bt.lootGot[k])}`).join(' ');
    }
    if (bt.mode === 'attack') {
      const tk = bt.tray.map((t) => t.n).join(',') + '|' + bt.sel + '|' + (bt.heroUnit ? (bt.heroUnit.dead ? 'd' : 'a') : '') + (bt.abilityUsed ? 'u' : '');
      if (bh.tray !== tk) {
        bh.tray = tk;
        const cards = $('tray').children;
        bt.tray.forEach((t, i) => {
          const c = cards[i]; if (!c) return;
          c.classList.toggle('sel', i === bt.sel && t.n > 0);
          let empty = t.n <= 0;
          let label = t.kind === 'hero' ? '' : '×' + t.n;
          if (t.kind === 'hero' && bt.heroUnit) {
            if (bt.heroUnit.dead) { label = 'Fallen'; empty = true; }
            else if (!bt.abilityUsed) { label = 'Unchain!'; empty = false; c.classList.add('ability'); }
            else { label = 'Used'; empty = true; c.classList.remove('ability'); }
          }
          c.classList.toggle('empty', empty);
          c.querySelector('.n').textContent = label;
        });
      }
    }
  };
  UI.starPop = function (i) {
    const s = $('bh-stars'); if (!s) return;
    bh.s = null;
    const big = $('star-pop');
    big.textContent = '★';
    big.classList.remove('go'); void big.offsetWidth; big.classList.add('go');
  };

  // ---------- results ----------
  UI.showResults = function (bt, r, applied) {
    const res = $('results');
    res.hidden = false;
    const win = r.stars > 0;
    const isReplay = bt.mode === 'replay';
    const title = isReplay ? (win ? 'Village raided' : 'Defense held!') : win ? 'Victory!' : 'Defeat';
    const lootRows = ['gold', 'mead', 'rs'].filter((k) => r.loot[k] > 0 || (k !== 'rs')).map((k) => `<div class="rrow"><span>${ic(k)}${D.RES[k].name}</span><b>${isReplay ? '−' : '+'}${U.fmtFull(applied && !isReplay ? applied.loot[k] : r.loot[k])}</b></div>`).join('');
    const used = Object.keys(r.used || {}).filter((k) => r.used[k] > 0);
    res.innerHTML = `<div class="rcard ${win ? 'win' : 'lose'}">
      <div class="lbl">${isReplay ? 'Defense replay' : 'Raid over'}</div>
      <h2>${title}</h2>
      <div class="rstars">${[0, 1, 2].map((i) => `<i class="${i < r.stars ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.35}s">★</i>`).join('')}</div>
      <div class="rpct">${r.pct}% destroyed</div>
      <div class="rrows">${lootRows}
        ${applied && applied.trophies != null ? `<div class="rrow"><span>${ic('trophy')}Trophies</span><b class="${applied.trophies >= 0 ? 'pos' : 'neg'}">${applied.trophies >= 0 ? '+' : ''}${applied.trophies}</b></div>` : ''}
        ${applied && applied.xp ? `<div class="rrow"><span>${ic('star')}Experience</span><b>+${applied.xp}</b></div>` : ''}
      </div>
      ${used.length ? `<div class="lbl">Troops used</div><div class="chips">${used.map((k) => `<span class="chip"><canvas width="48" height="48" data-icon="troop:${k}"></canvas><b>×${r.used[k]}</b></span>`).join('')}</div>` : ''}
      <button type="button" class="big-btn" id="btn-home">${SVG.wolf}<span>Return home</span></button>
    </div>`;
    paintIcons(res);
    setTimeout(() => { const b = $('btn-home'); if (b) b.focus(); }, 50);
  };
  UI.hideResults = () => { $('results').hidden = true; };

  // ---------- defense log ----------
  UI.openLog = function () {
    UI._modalKind = 'log';
    const st = V.st;
    st.logUnread = 0;
    let h = '';
    if (!st.log.length) h = '<div class="empty">No raids yet. When you are away for a while, rival clans may attack — their raids show up here.</div>';
    for (const e of st.log) {
      const win = e.stars === 0;
      h += `<div class="log ${win ? 'win' : 'lose'}"><div class="lh"><b>${esc(e.name)}</b><span class="muted">${esc(e.chief)} · GH ${e.hall} · ${U.ago(e.time)}</span></div>
        <div class="lrow"><span class="stars">${[0, 1, 2].map((i) => `<i class="${i < e.stars ? 'on' : ''}">★</i>`).join('')}</span><span>${e.pct}%</span>
        <span class="lloot">${['gold', 'mead', 'rs'].filter((k) => e.lost[k] > 0).map((k) => `${ic(k, 'tiny')}−${U.fmt(e.lost[k])}`).join(' ') || '<span class="muted">No loot lost</span>'}</span>
        <span class="${e.trophies >= 0 ? 'pos' : 'neg'}">${ic('trophy', 'tiny')}${e.trophies >= 0 ? '+' : ''}${e.trophies}</span></div>
        <div class="lres">${win ? 'Defense won' : 'Defense lost'}${e.shield ? ' · shield ' + U.fmtTime(e.shield * 60) : ''}<button type="button" class="mini" data-replay="${e.id}">Watch replay</button></div></div>`;
    }
    UI.modal('Defense log', h, 'log');
  };
  UI.awayReport = function (entries) {
    if (!entries.length) return;
    const lost = { gold: 0, mead: 0, rs: 0 }; let tr = 0;
    for (const e of entries) { for (const k in lost) lost[k] += e.lost[k] || 0; tr += e.trophies; }
    UI.confirm('While you were away…', `${entries.length} raid${entries.length > 1 ? 's' : ''} hit your village.<br>` +
      `${['gold', 'mead', 'rs'].filter((k) => lost[k] > 0).map((k) => `${ic(k, 'tiny')}−${U.fmtFull(lost[k])}`).join(' ') || 'No loot was lost.'}<br>${ic('trophy', 'tiny')}${tr >= 0 ? '+' : ''}${tr} trophies`, 'Defense log', () => UI.openLog(), 'OK');
  };

  // ---------- achievements / profile ----------
  UI.openAch = function () {
    UI._modalKind = 'ach';
    const st = V.st;
    const L = D.league(st.trophies);
    let h = `<div class="profile"><div class="lvl-badge big"><span>${st.plv}</span></div><div><b class="big">${esc(st.name)}</b><div class="muted">${ic('trophy', 'tiny')}${st.trophies} · <span style="color:${L.col}">${L.name}</span> · best ${st.best || st.trophies}</div><div class="muted">${st.stats.wins} raids won · ${st.stats.defWins} defenses won</div></div></div>`;
    h += '<div class="lbl">Leagues</div><div class="leagues">' + D.LEAGUES.slice(1).map((l) => `<span class="lg ${st.trophies >= l.min ? 'on' : ''}" style="--c:${l.col}">${l.name}<em>${l.min}+</em></span>`).join('') + '</div>';
    h += '<div class="lbl">Achievements</div>';
    for (const a of D.ACH) {
      const s = V.achState(a);
      const target = s.next != null ? s.next : a.tiers[a.tiers.length - 1];
      const frac = Math.min(1, s.val / target);
      h += `<div class="ach ${s.ready ? 'ready' : ''}"><div class="ah"><b>${esc(a.name)}</b><span class="tiers">${a.tiers.map((_, i) => `<i class="${i < s.claimed ? 'on' : ''}">★</i>`).join('')}</span></div>
        <div class="muted">${esc(a.desc.replace('{n}', U.fmtFull(target)))}</div>
        <div class="bar"><i style="width:${frac * 100}%"></i></div>
        <div class="arow"><span>${U.fmtFull(Math.min(s.val, target))} / ${U.fmtFull(target)}</span>${s.done ? '<b class="pos">Complete</b>' : s.ready ? `<button type="button" class="mini pri" data-claim="${a.id}">Claim ${cost('gems', s.gems, true)}</button>` : `<span class="muted">${ic('gems', 'tiny')}${s.gems}</span>`}</div></div>`;
    }
    UI.modal('Awards', h, 'ach');
  };

  // ---------- menu ----------
  UI.openMenu = function () {
    UI._modalKind = 'menu';
    const st = V.st;
    const h = `<div class="menu">
      <label class="field"><span>Chieftain name</span><input id="name-in" maxlength="16" value="${esc(st.name)}" autocomplete="off"></label>
      <button type="button" class="sbtn ghostb wide" data-act="sound"><span>Sound: ${FS.A.on ? 'on' : 'off'}</span></button>
      <button type="button" class="sbtn ghostb wide" data-act="live"><span>LIVE keys legend: ${FS.liveLegend ? 'shown' : 'hidden'} (L)</span></button>
      <button type="button" class="sbtn ghostb wide" data-act="collectall"><span>Collect all resources</span></button>
      <div class="lbl">Save</div>
      <button type="button" class="sbtn ghostb wide" data-act="export"><span>Export save</span></button>
      <textarea id="save-text" rows="3" placeholder="Paste a save here to import it" spellcheck="false"></textarea>
      <div class="two"><button type="button" class="sbtn ghostb" data-act="copy"><span>Copy</span></button><button type="button" class="sbtn ghostb" data-act="import"><span>Import</span></button></div>
      <button type="button" class="sbtn danger wide" data-act="newgame"><span>Start a new village</span></button>
      <p class="muted small">Progress saves automatically in this browser. Gems are earned in play only — there are no purchases.</p>
    </div>`;
    UI.modal('Menu', h, 'menu');
  };

  // ---------- LIVE legend ----------
  UI.renderLegend = function () {
    const box = $('live-legend');
    box.hidden = !FS.liveLegend;
    if (!FS.liveLegend) return;
    const inBattle = FS.mode === 'battle';
    const list = inBattle ? FS.LIVE_BATTLE : FS.LIVE_VILLAGE;
    box.innerHTML = `<div class="lbl">LIVE keys · ${inBattle ? 'raid' : 'village'}</div>` + list.map((a, i) => `<div class="lk"><kbd>${i + 1}</kbd><span class="dot ${a.good ? '' : 'bad'}"></span>${esc(a.name)}</div>`).join('');
  };

  // ---------- event wiring ----------
  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('button, [data-shop]');
      if (!t) return;
      FS.A.ensure();
      const d = t.dataset;
      if (t.id === 'btn-shop') { FS.VV.select(null); UI.openShop(); FS.A.sfx('tap'); }
      else if (t.id === 'btn-attack') { FS.VV.select(null); UI.openAttack(); FS.A.sfx('tap'); }
      else if (t.id === 'btn-army') { FS.VV.select(null); UI.openArmy(); FS.A.sfx('tap'); }
      else if (t.id === 'btn-log') { FS.VV.select(null); UI.openLog(); FS.A.sfx('tap'); }
      else if (t.id === 'btn-ach') { FS.VV.select(null); UI.openAch(); FS.A.sfx('tap'); }
      else if (t.id === 'btn-menu') { FS.VV.select(null); UI.openMenu(); FS.A.sfx('tap'); }
      else if (t.id === 'modal-close') { UI.closeModal(); }
      else if (t.id === 'sheet-close') { FS.VV.select(null); }
      else if (t.id === 'place-ok') FS.VV.confirmPlace();
      else if (t.id === 'place-no') FS.VV.cancelPlace();
      else if (t.id === 'confirm-yes') { const f = UI._confirmYes; UI.closeConfirm(); if (f) f(); }
      else if (t.id === 'confirm-no') UI.closeConfirm();
      else if (t.id === 'btn-find') FS.game.findMatch();
      else if (t.id === 'btn-next') FS.game.findMatch(true);
      else if (t.id === 'btn-match-home') FS.game.goHome();
      else if (t.id === 'btn-start-attack') FS.game.startAttack();
      else if (t.id === 'btn-end') FS.game.endBattle();
      else if (t.id === 'btn-skip') FS.game.skipReplay();
      else if (t.id === 'btn-speed') { const bt = FS.battle.cur; if (bt) { bt.speed = bt.speed === 1 ? 2 : 1; t.textContent = bt.speed === 1 ? '2×' : '1×'; } }
      else if (t.id === 'btn-home') FS.game.goHome();
      else if (t.id === 'btn-pause') FS.game.togglePause();
      else if (t.id === 'btn-resume') FS.game.togglePause();
      else if (d.tab) {
        if (UI._modalKind === 'shop') UI.openShop(d.tab);
        else if (UI._modalKind === 'army') { UI._armyTab = d.tab; UI.openArmy(d.tab); }
      } else if (d.shop) {
        if (t.classList.contains('locked')) { UI.toast(V.lockReason(d.shop), 'bad'); FS.A.sfx('no'); return; }
        const c = V.buildCost(d.shop);
        if (!V.has(c.res, c.amt)) { UI.fail({ need: c }); return; }
        if (c.time > 0 && V.builders().free <= 0) { UI.toast('All builders are busy', 'bad'); FS.A.sfx('no'); return; }
        UI.closeModal(); FS.VV.startPlace(d.shop); FS.A.sfx('tap');
      } else if (d.train) { const r = FS.army.train(d.train, e.shiftKey ? 5 : 1); if (!r.ok) UI.fail(r, () => FS.army.train(d.train)); UI.renderArmy(); }
      else if (d.untrain != null) { FS.army.untrain(+d.untrain); UI.renderArmy(); }
      else if (d.brew) { const r = FS.army.brew(d.brew); if (!r.ok) UI.fail(r); UI.renderArmy(); }
      else if (d.unbrew != null) { FS.army.unbrew(+d.unbrew); UI.renderArmy(); }
      else if (d.research) { const r = FS.army.research(d.research); if (!r.ok) UI.fail(r, () => FS.army.research(d.research)); UI.renderResearch(); }
      else if (d.claim) { const a = D.ACH.find((x) => x.id === d.claim); V.claimAch(a); UI.openAch(); }
      else if (d.replay) { UI.closeModal(); FS.game.replay(+d.replay); }
      else if (d.tray != null) {
        const bt = FS.battle.cur; if (!bt) return;
        const i = +d.tray, it = bt.tray[i];
        if (it.kind === 'hero' && bt.heroUnit && !bt.heroUnit.dead) { FS.battle.ability(bt); }
        else if (it.n > 0) { bt.sel = i; FS.A.sfx('tick'); }
        bh.tray = null;
      } else if (d.act) menuAct(d.act, t);
    });
    $('sheet-btns').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) { e.stopPropagation(); sheetAction(b.dataset.act); } });
    document.addEventListener('change', (e) => { if (e.target.id === 'name-in') { V.st.name = (e.target.value || 'Wolfkin').slice(0, 16); UI.updateHUD(); } });
  }
  function menuAct(act, t) {
    const A = FS.army;
    if (act === 'finishtrain') { A.finishTraining(); UI.renderArmy(); }
    else if (act === 'heroup') { const r = A.heroUpgrade(); if (!r.ok) UI.fail(r, () => A.heroUpgrade()); UI.renderArmy(); }
    else if (act === 'herospeed') { const r = A.heroSpeed(); if (!r.ok) UI.fail(r); UI.renderArmy(); }
    else if (act === 'rspeed') { const r = A.speedResearch(); if (!r.ok) UI.fail(r); UI.renderResearch(); }
    else if (act === 'gotrain') UI.openArmy('train');
    else if (act === 'sound') { FS.A.toggle(); UI.openMenu(); }
    else if (act === 'live') { FS.liveLegend = !FS.liveLegend; U.store.set('legend', FS.liveLegend); UI.renderLegend(); UI.openMenu(); }
    else if (act === 'collectall') { const n = V.collectAll(); UI.toast(n ? 'Collected ' + U.fmt(n) : 'Nothing to collect', n ? 'good' : 'info'); }
    else if (act === 'export') { const s = FS.save.exportText(); $('save-text').value = s; $('save-text').select(); UI.toast('Save exported — copy the text', 'good'); }
    else if (act === 'copy') { const ta = $('save-text'); if (!ta.value) ta.value = FS.save.exportText(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => UI.toast('Copied', 'good'), () => UI.toast('Select the text and copy it', 'info')); } catch (e) { UI.toast('Select the text and copy it', 'info'); } }
    else if (act === 'import') { const ok = FS.save.importText($('save-text').value); UI.toast(ok ? 'Save imported' : 'That save could not be read', ok ? 'good' : 'bad'); if (ok) UI.closeModal(); }
    else if (act === 'newgame') UI.confirm('Start over?', 'Your current village will be replaced by a brand-new one.', 'Start over', () => { FS.save.newGame(); UI.closeModal(); });
  }
})(window.FS = window.FS || {});
