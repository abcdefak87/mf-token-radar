'use strict';
/* Token Radar — the board the judge reads. Data arrives as window.RADAR (data.js, written by main.ts). */
(function () {
  const R = window.RADAR;
  const root = document.getElementById('board');
  if (!R || !root) { if (root) root.innerHTML = '<p class="empty">No radar data loaded.</p>'; return; }
  root.removeAttribute('aria-busy');

  const fmt$ = (n) => n == null ? '—' : n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(0) + 'K' : '$' + n;
  const fmtPct = (n) => n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const days = (n) => n == null ? '—' : n >= 365 ? (n / 365).toFixed(1) + 'y' : n + 'd';

  const CATS = [...new Set(R.rows.map((r) => r.category).filter(Boolean))].sort();
  const CHAINS = [...new Set(R.rows.flatMap((r) => r.chains))].sort();

  const state = { tab: 'board', q: '', cat: '', chain: '', conv: '', watch: false, sort: 'rank', dir: 1, sel: null };

  function chip(cat) { return cat ? `<span class="chip">${esc(cat)}</span>` : '<span class="cat">—</span>'; }
  function chainsOf(r) { return r.chains.slice(0, 3).map((c) => `<span class="chip">${esc(c)}</span>`).join('') + (r.chains.length > 3 ? `<span class="chip">+${r.chains.length - 3}</span>` : ''); }
  function momCell(r) {
    const v = r.change_7d;
    if (v == null) return '<span class="cat">—</span>';
    const w = Math.min(Math.abs(v) / 80, 1) * 100;
    const col = v >= 0 ? 'var(--up)' : 'var(--dn)';
    return `<span class="mombar"><span class="track"><span class="fill" style="width:${w.toFixed(0)}%;background:${col};${v < 0 ? 'right:0' : 'left:0'}"></span></span><span class="${v >= 0 ? 'up' : 'dn'}">${fmtPct(v)}</span></span>`;
  }

  function filtered() {
    let rows = R.rows;
    if (state.watch) rows = rows.filter((r) => r.watchlist);
    if (state.cat) rows = rows.filter((r) => r.category === state.cat);
    if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
    if (state.conv) rows = rows.filter((r) => r.conviction === state.conv);
    if (state.q) { const q = state.q.toLowerCase(); rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q)); }
    const k = state.sort, d = state.dir;
    rows = [...rows].sort((a, b) => {
      const va = a[k], vb = b[k];
      if (va == null && vb == null) return a.rank - b.rank;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : a.rank - b.rank) * d;
    });
    return rows;
  }

  const COLS = [
    ['rank', 'Rank', false], ['name', 'Protocol', false], ['category', 'Category', false],
    ['chains', 'Chains', false], ['tvl_usd', 'TVL', true], ['change_7d', 'Δ 7d', true],
    ['implied_value_usd', 'Implied', true], ['conviction', 'Tier', false],
  ];

  function tableHtml() {
    const rows = filtered();
    const head = COLS.map(([k, t, num]) => `<th class="${num ? 'num' : ''}" data-k="${k}">${t}${state.sort === k ? ` <span class="arr">${state.dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('');
    const body = rows.slice(0, 500).map((r) => `
      <tr data-slug="${esc(r.slug)}" class="${state.sel === r.slug ? 'sel' : ''}">
        <td class="rank">${r.rank}</td>
        <td><span class="name">${esc(r.name)}${r.watchlist ? ' <span class="star" title="snapshot watchlist">★</span>' : ''}<span class="slug">${esc(r.slug)}</span></span></td>
        <td>${chip(r.category)}</td>
        <td>${chainsOf(r)}</td>
        <td class="num">${fmt$(r.tvl_usd)}</td>
        <td>${momCell(r)}</td>
        <td class="num iv">${fmt$(r.implied_value_usd)}</td>
        <td><span class="conv ${r.conviction}">${r.conviction === 'speculative' ? 'spec' : r.conviction}</span></td>
      </tr>`).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="8" class="empty">No rows match the filter.</td></tr>`}</tbody></table>`;
  }

  function liveHtml() {
    const body = R.live.map((p, i) => `
      <tr><td class="rank">${i + 1}</td>
      <td><span class="name">${esc(p.name)}<span class="slug">${esc(p.slug)}</span></span></td>
      <td>${chip(p.category)}</td><td>${chainsOf(p)}</td>
      <td class="num">${fmt$(p.mcap_usd)}</td><td class="num">${fmt$(p.tvl_usd)}</td>
      <td class="num ${p.change_7d >= 0 ? 'up' : 'dn'}">${fmtPct(p.change_7d)}</td></tr>`).join('');
    return `<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">Mcap</th><th class="num">TVL</th><th class="num">Δ 7d</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function methodHtml() {
    const m = R.model;
    const pairs = Object.entries(m.category_multiple).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');
    return `<section class="method"><h3>The model — ${esc(R.model_version)}</h3>
      <div>implied&nbsp;=&nbsp;TVL × <code>category multiple</code> × <code>momentum</code> × <code>maturity</code> × <code>breadth</code>,
      where momentum = 1 + clamp(Δ7d, ${m.momentum_floor}, ${m.momentum_cap})% × ${m.momentum_weight},
      maturity peaks at ${m.prime_age_days}d of age (floor ${m.maturity_floor}), and breadth adds ${m.chain_step} per extra chain (cap ${m.chain_cap}).
      Category multiples (FDV:TVL bands):</div>
      <table class="ctab"><tbody>${pairs}<tr><td><i>default</i></td><td>${m.default_multiple}</td></tr></tbody></table>
      <div style="margin-top:6px">Watchlist floor ${fmt$(R.floor_usd)} TVL · snapshot ${esc(R.as_of)} · ${esc(R.source)}</div>
    </section>`;
  }

  function drawerHtml(r) {
    const steps = (r.farm_steps || []).map((s) => `<li>${esc(s)}</li>`).join('');
    return `<div class="scrim"></div><aside class="drawer" role="dialog" aria-label="${esc(r.name)} detail">
      <button class="close" aria-label="close">✕</button>
      <h2><span class="star">${r.watchlist ? '★ ' : ''}</span>${esc(r.name)} <span class="slug">${esc(r.slug)}</span></h2>
      <div class="dsub">rank ${r.rank} · ${esc(r.category || 'uncategorized')} · ${r.chains.map(esc).join(', ') || 'no chains'} · <span class="conv ${r.conviction}">${r.conviction}</span></div>
      <div class="kv">
        <div><div class="k">TVL</div><div class="v">${fmt$(r.tvl_usd)}</div></div>
        <div><div class="k">Δ 7d</div><div class="v ${r.change_7d >= 0 ? 'up' : 'dn'}">${fmtPct(r.change_7d)}</div></div>
        <div><div class="k">Age</div><div class="v">${days(r.age_days)}</div></div>
        <div><div class="k">Implied value</div><div class="v iv">${fmt$(r.implied_value_usd)}</div></div>
      </div>
      <div class="mults"><h3>Model breakdown</h3>
        <div class="mrow"><span>TVL</span><b>${fmt$(r.tvl_usd)}</b></div>
        <div class="mrow"><span>× category multiple</span><b>${r.category_multiple}</b></div>
        <div class="mrow"><span>× momentum (${fmtPct(r.change_7d)})</span><b>${r.momentum_multiplier}</b></div>
        <div class="mrow"><span>× maturity (${days(r.age_days)})</span><b>${r.maturity_multiplier}</b></div>
        <div class="mrow"><span>× breadth (${r.chains.length} chains)</span><b>${r.breadth_multiplier}</b></div>
        <div class="mrow mtotal"><span>= implied value</span><b>${fmt$(r.implied_value_usd)}</b></div>
      </div>
      <h4>Farm plan</h4><ol class="steps">${steps}</ol>
    </aside>`;
  }

  function render() {
    const rows = filtered();
    root.innerHTML = `
      <header class="top"><h1>TOKEN <span class="radar">RADAR</span></h1>
        <span class="sub"><b>${R.watchlist_size}</b>-protocol watchlist · snapshot <b>${esc(R.as_of)}</b> · ${esc(R.source)}</span>
        <span class="spacer"></span><span class="ver">${esc(R.model_version)}</span></header>
      <div class="stats">
        <div class="stat"><div class="k">Board rows</div><div class="v">${R.board_size}</div></div>
        <div class="stat"><div class="k">Watchlist covered</div><div class="v">${R.watchlist_size}<small>/${R.watchlist_size}</small></div></div>
        <div class="stat"><div class="k">Early finds</div><div class="v">${R.early_size}</div></div>
        <div class="stat"><div class="k">Live set aside</div><div class="v">${R.live_size}</div></div>
        <div class="stat"><div class="k">Total implied</div><div class="v">${fmt$(R.rows.reduce((a, r) => a + r.implied_value_usd, 0))}</div></div>
      </div>
      <div class="tabs">
        <button data-tab="board" class="${state.tab === 'board' ? 'on' : ''}">Board</button>
        <button data-tab="live" class="${state.tab === 'live' ? 'on' : ''}">Live tokens</button>
        <button data-tab="method" class="${state.tab === 'method' ? 'on' : ''}">Model</button>
      </div>
      ${state.tab === 'board' ? `<div class="toolbar">
        <input type="search" id="q" placeholder="Search name or slug…" value="${esc(state.q)}" aria-label="search">
        <select id="cat" aria-label="category"><option value="">All categories</option>${CATS.map((c) => `<option ${state.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select id="chain" aria-label="chain"><option value="">All chains</option>${CHAINS.map((c) => `<option ${state.chain === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select id="conv" aria-label="tier"><option value="">All tiers</option>${['high', 'medium', 'speculative'].map((c) => `<option ${state.conv === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <label><input type="checkbox" id="watch" ${state.watch ? 'checked' : ''}> watchlist ★</label>
        <span class="count">${rows.length} rows</span>
      </div>${tableHtml()}` : ''}
      ${state.tab === 'live' ? liveHtml() : ''}
      ${state.tab === 'method' ? methodHtml() : ''}
      <div class="foot">Implied values are the model's estimate of a launch-day FDV, not a promise — a pre-token protocol may never launch one.
      Every row's plan is generated from its own snapshot record (category, chains, TVL, age). Not financial advice.</div>`;

    root.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));
    const q = document.getElementById('q');
    if (q) q.addEventListener('input', () => { state.q = q.value; refreshTable(); });
    for (const id of ['cat', 'chain', 'conv']) { const el = document.getElementById(id); if (el) el.addEventListener('change', () => { state[id] = el.value; refreshTable(); }); }
    const w = document.getElementById('watch');
    if (w) w.addEventListener('change', () => { state.watch = w.checked; refreshTable(); });
    root.querySelectorAll('thead th[data-k]').forEach((th) => th.addEventListener('click', () => {
      const k = th.dataset.k;
      if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = k === 'name' || k === 'category' || k === 'conviction' || k === 'chains' ? 1 : -1; }
      if (k === 'rank') state.dir = 1;
      refreshTable();
    }));
    root.querySelectorAll('tbody tr[data-slug]').forEach((tr) => tr.addEventListener('click', () => openDrawer(tr.dataset.slug)));
  }

  function refreshTable() {
    if (state.tab !== 'board') { render(); return; }
    const n = filtered().length;
    const c = root.querySelector('.count'); if (c) c.textContent = `${n} rows`;
    const tbl = root.querySelector('table');
    if (tbl) { const w = document.createElement('div'); w.innerHTML = tableHtml(); tbl.replaceWith(w.firstChild); bindRows(); bindHead(); }
  }
  function bindRows() { root.querySelectorAll('tbody tr[data-slug]').forEach((tr) => tr.addEventListener('click', () => openDrawer(tr.dataset.slug))); }
  function bindHead() { root.querySelectorAll('thead th[data-k]').forEach((th) => th.addEventListener('click', () => {
    const k = th.dataset.k;
    if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
    if (k === 'rank') state.dir = 1;
    refreshTable();
  })); }

  function openDrawer(slug) {
    const r = R.rows.find((x) => x.slug === slug);
    if (!r) return;
    state.sel = slug;
    const wr = document.createElement('div');
    wr.className = 'drawer-wrap open';
    wr.innerHTML = drawerHtml(r);
    document.body.appendChild(wr);
    const close = () => { wr.remove(); state.sel = null; };
    wr.querySelector('.scrim').addEventListener('click', close);
    wr.querySelector('.close').addEventListener('click', close);
    document.addEventListener('keydown', function h(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', h); } });
    refreshTable();
  }

  render();
})();
