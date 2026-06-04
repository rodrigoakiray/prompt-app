/* =========================================================================
   PROMPT LIBRARY — app logic (vanilla, hash-routed PWA)
   ========================================================================= */
(function () {
  'use strict';

  // ---- State -----------------------------------------------------------
  let DATA = null;
  const BY_ID = new Map();
  const CAT_BY_ID = new Map();
  const BY_CAT = new Map();           // categoryId -> { category, prompts[] }
  let TOP_TAGS = [];

  let searchQ = '';
  let catSub = 'All';
  let currentCategoryId = null;
  let currentPrompt = null;

  let io = null;                       // IntersectionObserver for lazy lists
  let pager = null;                    // () => render next batch

  const app = document.getElementById('app');

  // ---- Storage ---------------------------------------------------------
  function lsGet(k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  let favArr = lsGet('pl:favorites', []);
  let favSet = new Set(favArr);
  let recents = lsGet('pl:recents', []);

  const isFav = (id) => favSet.has(id);
  function toggleFav(id) {
    if (favSet.has(id)) { favSet.delete(id); favArr = favArr.filter((x) => x !== id); }
    else { favSet.add(id); favArr = [id, ...favArr]; }
    lsSet('pl:favorites', favArr);
  }
  function pushRecent(id) {
    recents = [id, ...recents.filter((x) => x !== id)].slice(0, 40);
    lsSet('pl:recents', recents);
  }

  // ---- Utils -----------------------------------------------------------
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const snippet = (b, n = 150) => b.replace(/\s+/g, ' ').trim().slice(0, n);
  const plural = (n, s) => n + ' ' + s + (n === 1 ? '' : 's');
  const pad2 = (n) => String(n).padStart(2, '0');
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onAccent(hex) {
    const m = hex.replace('#', '');
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#16130f' : '#f7f1e3';
  }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function catAccent(id) { const c = CAT_BY_ID.get(id); return c ? c.accent : '#5a6472'; }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch (e2) { return false; }
    }
  }

  let toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  // ---- Icons -----------------------------------------------------------
  const S = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICON = {
    arrow: S('<path d="m15 18-6-6 6-6"/>'),
    search: S('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>'),
    copy: S('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    check: S('<path d="M20 6 9 17l-5-5"/>'),
    edit: S('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    gear: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
    grid: S('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    star: S('<path d="m12 3 2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 17l-5.2 2.75 1-5.75-4.2-4.1 5.8-.85Z"/>'),
    clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>'),
    sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: S('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>'),
  };
  const themeIcon = () => (document.documentElement.dataset.theme === 'dark' ? ICON.sun : ICON.moon);

  const TABS = [
    { key: 'browse', href: '#/', label: 'Browse', icon: ICON.grid },
    { key: 'search', href: '#/search', label: 'Search', icon: ICON.search },
    { key: 'saved', href: '#/favorites', label: 'Saved', icon: ICON.star },
    { key: 'recent', href: '#/recents', label: 'Recent', icon: ICON.clock },
  ];

  // ---- Theme -----------------------------------------------------------
  function setTheme(pref) {
    try { localStorage.setItem('pl:theme', pref); } catch (e) {}
    const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const de = document.documentElement;
    de.dataset.theme = dark ? 'dark' : 'light';
    de.dataset.themePref = pref;
    updateThemeColor();
  }
  function updateThemeColor() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const m = document.getElementById('theme-color');
    if (m && bg) m.setAttribute('content', bg);
  }

  // ---- Lazy list rendering --------------------------------------------
  function resetPager() { if (io) { io.disconnect(); io = null; } pager = null; }
  function mountList(container, items, render, batch) {
    batch = batch || 40;
    let i = 0;
    function chunk() {
      const slice = items.slice(i, i + batch);
      container.insertAdjacentHTML('beforeend', slice.map(render).join(''));
      i += batch;
      const sentinel = document.getElementById('sentinel');
      if (i < items.length) {
        const s = sentinel || Object.assign(document.createElement('div'), { id: 'sentinel' });
        s.style.height = '1px'; container.appendChild(s);
        if (!io) io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && pager) pager(); }, { rootMargin: '700px' });
        io.observe(s);
      } else if (sentinel) { sentinel.remove(); pager = null; }
    }
    pager = chunk; chunk();
  }

  // ---- Row + item renderers -------------------------------------------
  function rowHTML(p, showCat) {
    const fav = isFav(p.id);
    const style = showCat ? ` style="--accent:${catAccent(p.categoryId)}"` : '';
    const nb = p.placeholders.length;
    return `<a class="row" href="#/p/${p.id}"${style}>
      <div class="row__top">
        <span class="row__accent"></span>
        <div class="row__main">
          <div class="row__title">${esc(p.title)}</div>
          <div class="row__snippet">${esc(snippet(p.body))}</div>
          <div class="row__feet">
            ${showCat ? `<span class="cat-label">${esc(p.categoryName)}</span>` : ''}
            <span class="pill">${esc(p.length)}</span>
            ${nb ? `<span class="pill">${nb} blank${nb > 1 ? 's' : ''}</span>` : ''}
            ${p.tags.slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
        <button class="row__fav" data-action="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="Save">${fav ? '★' : '☆'}</button>
      </div>
    </a>`;
  }
  const renderCatItem = (it) => it.type === 'head'
    ? `<div class="sub-head">${esc(it.name)} <b>${it.count}</b></div>`
    : rowHTML(it.p, false);

  function mountCategoryList(container, catId) {
    const entry = BY_CAT.get(catId); if (!entry) return;
    const { category, prompts } = entry;
    let items;
    if (catSub === 'All') {
      items = [];
      for (const s of category.subcategories) {
        items.push({ type: 'head', name: s.name, count: s.count });
        for (const p of prompts) if (p.subcategory === s.name) items.push({ type: 'row', p });
      }
    } else {
      items = prompts.filter((p) => p.subcategory === catSub).map((p) => ({ type: 'row', p }));
    }
    mountList(container, items, renderCatItem);
  }

  // ---- Views -----------------------------------------------------------
  function viewHome() {
    const tiles = DATA.categories.map((c, i) => {
      const oa = onAccent(c.accent);
      return `<a class="tile reveal" href="#/c/${c.id}" data-idx="${pad2(c.order)}"
        style="--accent:${c.accent};--on-accent:${oa};animation-delay:${i * 30}ms">
        <span class="tile__idx">${pad2(c.order)} / 17</span>
        <span class="tile__name">${esc(c.name)}</span>
        <span class="tile__foot"><span class="tile__count">${c.count}</span>
        <span class="tile__sub">${plural(c.subcategories.length, 'set')}</span></span>
      </a>`;
    }).join('');
    return `
    <header class="masthead">
      <div class="masthead__top">
        <span class="kicker">A curated index · ${DATA.categories.length} collections</span>
        <div style="display:flex;gap:8px">
          <button class="iconbtn" data-action="theme-toggle" aria-label="Toggle theme">${themeIcon()}</button>
          <a class="iconbtn" href="#/settings" aria-label="Settings">${ICON.gear}</a>
        </div>
      </div>
      <h1 class="masthead__title">Prompt<br><em>Library</em></h1>
      <div class="masthead__meta"><b>${DATA.totalPrompts.toLocaleString()}</b> prompts ready to copy</div>
    </header>
    <div class="grid">${tiles}</div>`;
  }

  function viewCategory(id) {
    const entry = BY_CAT.get(id); if (!entry) return viewNotFound();
    const { category, prompts } = entry;
    const oa = onAccent(category.accent);
    const subs = ['All'].concat(category.subcategories.map((s) => s.name));
    const chips = subs.map((s) => {
      const count = s === 'All' ? prompts.length : (category.subcategories.find((x) => x.name === s) || {}).count || 0;
      return `<button class="chip" data-action="set-sub" data-sub="${esc(s)}" aria-pressed="${s === catSub}">${esc(s)}<b>${count}</b></button>`;
    }).join('');
    return `<div style="--accent:${category.accent};--on-accent:${oa}">
      <div class="chead"><button class="back" data-action="back">${ICON.arrow} Collections</button></div>
      <header class="cat-hero">
        <div class="eyebrow">Collection ${pad2(category.order)}</div>
        <h1 class="page-title">${esc(category.name)}</h1>
        <div class="cat-hero__meta"><span><b>${prompts.length}</b> prompts</span><span><b>${category.subcategories.length}</b> sets</span></div>
      </header>
      <div class="chips">${chips}</div>
      <div class="list" id="list"></div>
    </div>`;
  }

  function viewPrompt(id) {
    const p = BY_ID.get(id); if (!p) return viewNotFound();
    pushRecent(id);
    const cat = CAT_BY_ID.get(p.categoryId) || { accent: '#5a6472' };
    const oa = onAccent(cat.accent);
    const fav = isFav(id);
    const nb = p.placeholders.length;
    return `<div style="--accent:${cat.accent};--on-accent:${oa}">
      <div class="chead"><button class="back" data-action="back">${ICON.arrow} Back</button></div>
      <div class="eyebrow">${esc(p.categoryName)} · ${esc(p.subcategory)}</div>
      <h1 class="detail__title">${esc(p.title)}</h1>
      <div class="detail__meta">
        <span><b>${p.words}</b> words</span><span>·</span><span><b>${esc(p.length)}</b></span>
        ${nb ? `<span>·</span><span><b>${nb}</b> blank${nb > 1 ? 's' : ''}</span>` : ''}
        ${p.source ? `<span>·</span><span>Source <b>${esc(p.source)}</b></span>` : ''}
      </div>
      <div class="actions">
        <button class="btn btn--primary" data-action="copy" data-id="${id}">${ICON.copy} Copy prompt</button>
        ${nb ? `<button class="btn btn--ghost" data-action="toggle-fill">${ICON.edit} Fill in blanks</button>` : ''}
        <button class="btn btn--ghost btn--fav" data-action="fav" data-id="${id}" aria-pressed="${fav}">${fav ? '★ Saved' : '☆ Save'}</button>
      </div>
      <div id="fill-mount"></div>
      <div class="body-card">${esc(p.body)}</div>
      ${p.tags.length ? `<div class="detail__tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  function fillPanelHTML(p) {
    const fields = p.placeholders.map((ph, i) =>
      `<div class="field"><label for="ph${i}">${esc(ph)}</label>
       <input id="ph${i}" data-ph="${esc(ph)}" type="text" placeholder="value…" autocomplete="off" autocapitalize="off"></div>`).join('');
    return `<div class="fill" id="fill">
      <div class="fill__head"><span class="fill__title">Fill in the blanks</span>
        <button class="btn btn--primary" style="flex:none;min-width:0;padding:9px 16px" data-action="fill-copy">${ICON.copy} Copy filled</button></div>
      <div class="fill__grid">${fields}</div>
      <div class="fill__preview" id="fill-preview">${esc(p.body)}</div>
    </div>`;
  }
  function fillReplace(body, values) {
    let out = body;
    for (const ph in values) if (values[ph]) out = out.split(ph).join(values[ph]);
    return out;
  }
  function previewHTML(body, placeholders, values) {
    let html = esc(body);
    for (const ph of placeholders) {
      const v = values[ph]; if (!v) continue;
      const safe = esc(ph).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(safe, 'g'), '<mark>' + esc(v) + '</mark>');
    }
    return html;
  }
  function updateFillPreview() {
    if (!currentPrompt) return;
    const prev = document.getElementById('fill-preview'); if (!prev) return;
    const vals = {};
    document.querySelectorAll('#fill [data-ph]').forEach((inp) => { vals[inp.dataset.ph] = inp.value; });
    prev.innerHTML = previewHTML(currentPrompt.body, currentPrompt.placeholders, vals);
  }

  function viewSearch() {
    return `<div class="search-wrap">
      <div class="search-box">${ICON.search}
        <input id="q" type="search" inputmode="search" placeholder="Search ${DATA.totalPrompts.toLocaleString()} prompts…"
          value="${esc(searchQ)}" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="search-box__clear" data-action="clear-search" aria-label="Clear">×</button>
      </div>
      <div id="results"></div>
    </div>`;
  }
  function suggestHTML() {
    const tags = TOP_TAGS.map((t) => `<button data-action="suggest" data-q="${esc(t)}">${esc(t)}</button>`).join('');
    const cats = DATA.categories.slice().sort((a, b) => b.count - a.count).slice(0, 6)
      .map((c) => `<a href="#/c/${c.id}" style="--accent:${c.accent}">${esc(c.name)}</a>`).join('');
    return `<div class="suggest">
      <div class="suggest__h">Popular tags</div><div class="suggest__tags">${tags}</div>
      <div class="suggest__h">Jump to a collection</div><div class="suggest__tags">${cats}</div>
    </div>`;
  }
  function runSearch() {
    const res = document.getElementById('results'); if (!res) return;
    resetPager();
    const q = searchQ.trim().toLowerCase();
    if (!q) { res.innerHTML = suggestHTML(); return; }
    const terms = q.split(/\s+/);
    const scored = [];
    for (const p of DATA.prompts) {
      const hay = p._hay || (p._hay = (p.title + ' ' + p.tags.join(' ') + ' ' + p.body + ' ' + p.categoryName).toLowerCase());
      if (!terms.every((t) => hay.includes(t))) continue;
      const title = p.title.toLowerCase();
      let score = title.startsWith(q) ? 100 : title.includes(q) ? 70 : p.tags.some((t) => t.includes(q)) ? 50 : 10;
      scored.push([score, p]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const total = scored.length;
    const top = scored.slice(0, 80).map((x) => x[1]);
    res.innerHTML = `<div class="search-meta">${total ? `${total} result${total > 1 ? 's' : ''}${total > 80 ? ' · showing 80' : ''}` : 'No matches'}</div>`;
    if (!total) { res.insertAdjacentHTML('beforeend', emptyHTML('Nothing found', 'Try a different word or a #tag.')); return; }
    const list = document.createElement('div'); list.className = 'list'; res.appendChild(list);
    mountList(list, top, (p) => rowHTML(p, true));
  }

  function viewListScreen(ids, eyebrow, title, emTitle, emMsg) {
    const items = ids.map((id) => BY_ID.get(id)).filter(Boolean);
    const head = `<div class="chead"><button class="back" data-action="back">${ICON.arrow} Home</button></div>
      <div class="eyebrow">${esc(eyebrow)}</div><h1 class="page-title">${esc(title)}</h1>`;
    return `<div>${head}${items.length ? '<div class="list" id="list"></div>' : emptyHTML(emTitle, emMsg)}</div>`;
  }
  const viewFavorites = () => viewListScreen(favArr, 'Your collection', 'Saved', 'Nothing saved yet', 'Tap the star on any prompt to keep it here.');
  const viewRecents = () => viewListScreen(recents, 'History', 'Recent', 'No history yet', 'Prompts you open will appear here.');

  function viewSettings() {
    const pref = document.documentElement.dataset.themePref || 'auto';
    const seg = ['auto', 'light', 'dark'].map((o) =>
      `<button data-action="set-theme" data-theme="${o}" aria-pressed="${pref === o}">${o[0].toUpperCase() + o.slice(1)}</button>`).join('');
    return `<div>
      <div class="chead"><button class="back" data-action="back">${ICON.arrow} Home</button></div>
      <div class="eyebrow">Preferences</div><h1 class="page-title">Settings</h1>
      <div class="settings-group">
        <div class="setting-row"><span>Appearance</span></div>
        <div class="seg">${seg}</div>
      </div>
      <div class="settings-group">
        <div class="setting-row"><span>Prompts</span><b>${DATA.totalPrompts.toLocaleString()}</b></div>
        <div class="setting-row"><span>Collections</span><b>${DATA.categories.length}</b></div>
        <div class="setting-row"><span>Saved</span><b>${favArr.length}</b></div>
        <div class="setting-row"><span>Data updated</span><b>${esc((DATA.generatedAt || '').slice(0, 10))}</b></div>
      </div>
      <p class="about">An offline-first reading room for your prompt collection. Add it to your home screen from Safari’s <b>Share</b> menu to use it like a native app. Replace placeholders in <b>[brackets]</b> or <b>$&#123;curly&#125;</b> with the <b>Fill in blanks</b> tool before copying.</p>
    </div>`;
  }

  const emptyHTML = (title, msg) =>
    `<div class="empty"><div class="empty__mark">[ ]</div><h3>${esc(title)}</h3><p>${esc(msg)}</p></div>`;
  const viewNotFound = () =>
    `<div><div class="chead"><button class="back" data-action="back">${ICON.arrow} Home</button></div>${emptyHTML('Not found', 'That prompt or collection doesn’t exist.')}</div>`;

  // ---- Router ----------------------------------------------------------
  function route(hash) {
    const h = hash.replace(/^#/, '');
    if (h === '' || h === '/') return viewHome();
    if (h.indexOf('/c/') === 0) { currentCategoryId = decodeURIComponent(h.slice(3)); catSub = 'All'; return viewCategory(currentCategoryId); }
    if (h.indexOf('/p/') === 0) return viewPrompt(decodeURIComponent(h.slice(3)));
    if (h === '/search') return viewSearch();
    if (h === '/favorites') return viewFavorites();
    if (h === '/recents') return viewRecents();
    if (h === '/settings') return viewSettings();
    return viewHome();
  }
  function afterRender(hash) {
    window.scrollTo(0, 0);
    setActiveTab(hash);
    updateThemeColor();
    const h = hash.replace(/^#/, '');
    if (h.indexOf('/c/') === 0) {
      const list = document.getElementById('list'); if (list) mountCategoryList(list, currentCategoryId);
    } else if (h === '/search') {
      const q = document.getElementById('q');
      if (q) { q.focus(); const v = q.value; q.value = ''; q.value = v; }
      runSearch();
    } else if (h === '/favorites') {
      const list = document.getElementById('list'); if (list) mountList(list, favArr.map((id) => BY_ID.get(id)).filter(Boolean), (p) => rowHTML(p, true));
    } else if (h === '/recents') {
      const list = document.getElementById('list'); if (list) mountList(list, recents.map((id) => BY_ID.get(id)).filter(Boolean), (p) => rowHTML(p, true));
    } else if (h.indexOf('/p/') === 0) {
      currentPrompt = BY_ID.get(decodeURIComponent(h.slice(3))) || null;
    }
  }
  function render(hash) {
    resetPager();
    const run = () => { app.innerHTML = route(hash); afterRender(hash); };
    if (document.startViewTransition && !reduceMotion()) document.startViewTransition(run); else run();
  }
  const go = () => render(location.hash || '#/');

  // ---- Tab bar ---------------------------------------------------------
  function buildTabbar() {
    const nav = document.createElement('nav'); nav.className = 'tabbar';
    nav.innerHTML = TABS.map((t) => `<a class="tab" href="${t.href}" data-tab="${t.key}">${t.icon}<span>${t.label}</span></a>`).join('');
    document.body.appendChild(nav);
  }
  function setActiveTab(hash) {
    const h = hash.replace(/^#/, '');
    const key = h === '/search' ? 'search' : h === '/favorites' ? 'saved' : h === '/recents' ? 'recent' : 'browse';
    document.querySelectorAll('.tab').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === key));
  }

  // ---- Events ----------------------------------------------------------
  function onClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;

    if (action === 'back') {
      e.preventDefault();
      if (history.length > 1) history.back(); else location.hash = '#/';
    } else if (action === 'theme-toggle') {
      e.preventDefault();
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      render(location.hash || '#/');
    } else if (action === 'set-theme') {
      e.preventDefault();
      setTheme(t.dataset.theme);
      document.querySelectorAll('[data-action="set-theme"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === t.dataset.theme)));
    } else if (action === 'fav') {
      e.preventDefault();
      const id = t.dataset.id; toggleFav(id); const on = isFav(id);
      document.querySelectorAll(`[data-action="fav"][data-id="${id}"]`).forEach((btn) => {
        btn.setAttribute('aria-pressed', String(on));
        if (btn.classList.contains('row__fav')) btn.textContent = on ? '★' : '☆';
        else if (btn.classList.contains('btn--fav')) btn.innerHTML = on ? '★ Saved' : '☆ Save';
      });
      toast(on ? 'Saved' : 'Removed');
      const h = (location.hash || '').replace(/^#/, '');
      if (h === '/favorites') render(location.hash);
    } else if (action === 'copy') {
      e.preventDefault();
      const p = BY_ID.get(t.dataset.id); if (!p) return;
      copyText(p.body).then((ok) => {
        toast(ok ? 'Copied to clipboard' : 'Copy failed');
        if (ok) { const html = t.innerHTML; t.classList.add('is-copied'); t.innerHTML = ICON.check + ' Copied'; setTimeout(() => { t.classList.remove('is-copied'); t.innerHTML = html; }, 1400); }
      });
    } else if (action === 'toggle-fill') {
      e.preventDefault();
      const mount = document.getElementById('fill-mount');
      if (mount.firstChild) mount.innerHTML = '';
      else if (currentPrompt) { mount.innerHTML = fillPanelHTML(currentPrompt); const f = mount.querySelector('input'); if (f) f.focus(); }
    } else if (action === 'fill-copy') {
      e.preventDefault();
      if (!currentPrompt) return;
      const vals = {};
      document.querySelectorAll('#fill [data-ph]').forEach((inp) => { vals[inp.dataset.ph] = inp.value; });
      copyText(fillReplace(currentPrompt.body, vals)).then((ok) => toast(ok ? 'Filled prompt copied' : 'Copy failed'));
    } else if (action === 'set-sub') {
      e.preventDefault();
      catSub = t.dataset.sub;
      document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.sub === catSub)));
      const list = document.getElementById('list');
      if (list) { resetPager(); list.innerHTML = ''; mountCategoryList(list, currentCategoryId); }
    } else if (action === 'clear-search') {
      e.preventDefault();
      searchQ = ''; const q = document.getElementById('q'); if (q) { q.value = ''; q.focus(); } runSearch();
    } else if (action === 'suggest') {
      e.preventDefault();
      searchQ = t.dataset.q; const q = document.getElementById('q'); if (q) q.value = searchQ; runSearch();
    }
  }

  const debouncedSearch = debounce(() => runSearch(), 90);
  function onInput(e) {
    const t = e.target;
    if (t.id === 'q') { searchQ = t.value; debouncedSearch(); return; }
    if (t.matches('[data-ph]')) updateFillPreview();
  }

  // ---- Init ------------------------------------------------------------
  function registerSW() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {}); }

  async function init() {
    try {
      const res = await fetch('prompts.json', { cache: 'no-cache' });
      DATA = await res.json();
    } catch (e) {
      app.innerHTML = emptyHTML('Couldn’t load the library', 'Make sure prompts.json is alongside the app, then reload.');
      return;
    }
    for (const c of DATA.categories) { CAT_BY_ID.set(c.id, c); BY_CAT.set(c.id, { category: c, prompts: [] }); }
    for (const p of DATA.prompts) { BY_ID.set(p.id, p); const e = BY_CAT.get(p.categoryId); if (e) e.prompts.push(p); }

    const freq = new Map();
    for (const p of DATA.prompts) for (const t of p.tags) freq.set(t, (freq.get(t) || 0) + 1);
    TOP_TAGS = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map((x) => x[0]);

    buildTabbar();
    document.addEventListener('click', onClick);
    app.addEventListener('input', onInput);
    window.addEventListener('hashchange', go);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((document.documentElement.dataset.themePref || 'auto') === 'auto') { setTheme('auto'); render(location.hash || '#/'); }
    });

    setTheme(localStorage.getItem('pl:theme') || 'auto');
    go();
    registerSW();
  }

  init();
})();
