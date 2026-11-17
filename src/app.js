/* Numeros — application shell, state and views. */
(() => {
  'use strict';

  const N = Numerology;
  const DICT = window.NumerosI18N;
  const STORE_KEY = 'numeros.studio.v1';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fold = (value) => N.stripDiacritics(String(value == null ? '' : value)).toLowerCase();
  const hue = (n) => `var(--d${n})`;
  const ABBR = { lifePath: 'LP', destiny: 'EX', soul: 'SO', personality: 'PE', birthday: 'BD', maturity: 'MA' };
  const VIEWS = ['chart', 'timeline', 'cycles', 'bond', 'atlas'];
  const VIEW_ICON = { chart: 'i-chart', timeline: 'i-timeline', cycles: 'i-cycles', bond: 'i-bond', atlas: 'i-atlas' };

  /* ---------------- i18n ---------------- */
  let lang = 'en';
  function t(path, params) {
    const read = (dict) => path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), dict);
    let value = read(DICT[lang]);
    if (value == null) value = read(DICT.en);
    if (value == null) return path;
    if (typeof value === 'string' && params) {
      return value.replace(/\{(\w+)\}/g, (m, key) => (params[key] == null ? m : String(params[key])));
    }
    return value;
  }
  const num = (n) => t(`numbers.${n}`);

  /* ---------------- dates ---------------- */
  const todayObj = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
  const toISO = (o) => `${o.y}-${String(o.m).padStart(2, '0')}-${String(o.d).padStart(2, '0')}`;
  const asDate = (o) => new Date(o.y, o.m - 1, o.d);
  const shiftDays = (o, delta) => { const d = asDate(o); d.setDate(d.getDate() + delta); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
  function fmtDate(o, style) {
    if (!o || !o.y) return '—';
    const loc = lang === 'vi' ? 'vi-VN' : 'en-GB';
    try {
      return asDate(o).toLocaleDateString(loc, style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return toISO(o); }
  }
  const monthName = (m) => t('months')[m - 1] || String(m);
  const monthShort = (m) => t('monthsShort')[m - 1] || String(m);

  /* ---------------- state ---------------- */
  const state = {
    theme: 'obsidian',
    sound: true,
    profiles: [],
    activeId: null,
    overrides: {},
    view: 'chart',
    ledgerFilter: 'all',
    arithOpen: false,
    cycDate: todayObj(),
    bond: { name: '', date: null },
    atlas: { q: '', filter: 'all', sort: 'numeric' },
    journal: { q: '', sort: 'recent', selectMode: false, selected: [] },
    drawer: { n: 1, tab: 'meaning' },
    banner: true,
  };

  const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const signature = (p) => `${N.normalizeName(p.name).toLowerCase()}|${p.year}-${p.month}-${p.day}`;

  function activeProfile() { return state.profiles.find((p) => p.id === state.activeId) || null; }
  function overridesFor(id) { return state.overrides[id] || {}; }

  let chartCache = null;
  function chart() {
    const p = activeProfile();
    if (!p) return null;
    if (!chartCache || chartCache.profile.id !== p.id || chartCache.sig !== signature(p) || chartCache.ov !== JSON.stringify(overridesFor(p.id))) {
      chartCache = N.buildChart({ id: p.id, name: p.name, month: p.month, day: p.day, year: p.year }, overridesFor(p.id));
      chartCache.sig = signature(p);
      chartCache.ov = JSON.stringify(overridesFor(p.id));
    }
    return chartCache;
  }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        lang, theme: state.theme, sound: state.sound, profiles: state.profiles,
        activeId: state.activeId, overrides: state.overrides, banner: state.banner,
        bond: state.bond, view: state.view,
      }));
    } catch (e) { /* storage unavailable — session still works */ }
  }

  function seed() {
    const list = t('examples');
    const ids = ['ex-ada', 'ex-nguyendu', 'ex-jung'];
    state.profiles = list.map((ex, i) => ({
      id: ids[i] || uid(), name: ex.name, currentName: '', month: ex.month, day: ex.day, year: ex.year,
      note: ex.note, example: true, createdAt: Date.now() - (list.length - i) * 1000,
    }));
    state.activeId = state.profiles[0].id;
    state.banner = true;
  }

  function restore() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        const data = JSON.parse(raw);
        lang = data.lang === 'vi' ? 'vi' : 'en';
        state.theme = data.theme === 'parchment' ? 'parchment' : 'obsidian';
        state.sound = data.sound !== false;
        state.profiles = Array.isArray(data.profiles) ? data.profiles : [];
        state.activeId = data.activeId || null;
        state.overrides = data.overrides || {};
        state.banner = data.banner !== false;
        state.bond = data.bond && typeof data.bond === 'object' ? { name: data.bond.name || '', date: data.bond.date || null } : { name: '', date: null };
        if (VIEWS.includes(data.view)) state.view = data.view;
      } catch (e) { state.profiles = []; }
    } else {
      try { lang = (localStorage.getItem('numeros-language') === 'vi') ? 'vi' : 'en'; } catch (e) { lang = 'en'; }
    }
    if (!state.profiles.length) seed();
    if (!activeProfile()) state.activeId = state.profiles[0] ? state.profiles[0].id : null;
  }

  /* ---------------- sound ---------------- */
  let audioCtx = null;
  function ctx() {
    if (!state.sound) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, start, dur, gain, type) {
    const ac = ctx(); if (!ac) return;
    const osc = ac.createOscillator(); const g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    g.gain.setValueAtTime(0.0001, ac.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(ac.currentTime + start); osc.stop(ac.currentTime + start + dur + 0.02);
  }
  const sfx = {
    reveal() { tone(523.25, 0, 0.5, 0.05); tone(659.25, 0.09, 0.5, 0.045); tone(987.77, 0.18, 0.7, 0.035, 'triangle'); },
    tap() { tone(880, 0, 0.09, 0.028, 'triangle'); },
    flip() { tone(392, 0, 0.12, 0.035, 'triangle'); tone(587.33, 0.06, 0.16, 0.03); },
    remove() { tone(196, 0, 0.22, 0.04, 'sine'); tone(146.83, 0.05, 0.26, 0.03); },
    nav() { tone(659.25, 0, 0.1, 0.02, 'sine'); },
  };

  /* ---------------- sky ---------------- */
  function initSky() {
    const canvas = $('#sky');
    const g = canvas.getContext && canvas.getContext('2d');
    if (!g) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, pts = [], raf = 0, alive = false;
    const pointer = { x: -999, y: -999 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = clamp(Math.round((w * h) / 24000), 30, 84);
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.13, vy: (Math.random() - 0.5) * 0.13,
        r: Math.random() * 1.25 + 0.5, ph: Math.random() * Math.PI * 2,
      }));
    }

    function draw(time) {
      const dot = getComputedStyle(document.documentElement).getPropertyValue('--sky-dot').trim() || '210,230,255';
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i];
        if (!reduce) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -20) p.x = w + 20; if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20; if (p.y > h + 20) p.y = -20;
        }
        for (let j = i + 1; j < pts.length; j += 1) {
          const q = pts[j]; const dx = p.x - q.x; const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 15000) {
            g.strokeStyle = `rgba(${dot},${(1 - d2 / 15000) * 0.13})`;
            g.lineWidth = 0.6;
            g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
          }
        }
      }
      for (const p of pts) {
        const tw = reduce ? 0.6 : 0.45 + 0.4 * Math.sin(time / 1400 + p.ph);
        const dx = p.x - pointer.x; const dy = p.y - pointer.y;
        const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 190);
        g.fillStyle = `rgba(${dot},${clamp(tw * 0.55 + near * 0.5, 0, 0.95)})`;
        g.beginPath(); g.arc(p.x, p.y, p.r + near * 1.5, 0, Math.PI * 2); g.fill();
      }
    }

    function frame(time) {
      if (!alive) return;
      draw(time);
      raf = window.requestAnimationFrame(frame);
    }

    function start() { if (alive) return; alive = true; raf = window.requestAnimationFrame(frame); }
    function stop() { alive = false; window.cancelAnimationFrame(raf); }

    resize();
    draw(0);
    if (!reduce) start();
    let rt = 0;
    window.addEventListener('resize', () => { window.clearTimeout(rt); rt = window.setTimeout(() => { resize(); draw(0); }, 160); });
    window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.x = -999; pointer.y = -999; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (!reduce) start(); });
  }

  /* ---------------- reveal ---------------- */
  let io = null;
  function observeReveals(root) {
    const nodes = $$('.reveal', root || document);
    if (!('IntersectionObserver' in window)) { nodes.forEach((n) => n.classList.add('is-in')); return; }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    }
    const now = [];
    nodes.forEach((n) => {
      if (n.classList.contains('is-in')) return;
      if (n.getBoundingClientRect().top < window.innerHeight * 0.94) { now.push(n); return; }
      io.observe(n);
    });
    if (now.length) window.requestAnimationFrame(() => now.forEach((n) => n.classList.add('is-in')));
  }

  /* ---------------- toasts ---------------- */
  function toast(message, opts) {
    const o = opts || {};
    const host = $('#toasts');
    const node = document.createElement('div');
    node.className = 'toast';
    node.style.setProperty('--tone', o.tone || 'var(--brass)');
    node.innerHTML = `<span class="toast__ico"><svg class="ico" aria-hidden="true"><use href="#${o.icon || 'i-check'}"/></svg></span><p>${esc(message)}</p>`;
    if (o.action) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = o.action;
      btn.addEventListener('click', () => { o.onAction && o.onAction(); dismiss(); });
      node.appendChild(btn);
    }
    host.appendChild(node);
    let done = false;
    function dismiss() {
      if (done) return; done = true;
      node.classList.add('is-out');
      window.setTimeout(() => node.remove(), 240);
    }
    window.setTimeout(dismiss, o.duration || (o.action ? 6500 : 3200));
    while (host.children.length > 3) host.firstElementChild.remove();
    return dismiss;
  }

  /* ---------------- overlays ---------------- */
  let lastFocus = null;
  const openStack = [];
  function focusables(root) {
    return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter((n) => !n.disabled && n.offsetParent !== null);
  }
  function openOverlay(node, onClose) {
    if (openStack.some((o) => o.node === node)) return;
    lastFocus = document.activeElement;
    node.hidden = false;
    $('#scrim').hidden = false;
    document.body.style.overflow = 'hidden';
    openStack.push({ node, onClose });
    const f = focusables(node);
    if (f.length) f[0].focus();
  }
  function closeOverlay(node) {
    const idx = openStack.findIndex((o) => o.node === node);
    if (idx < 0) return;
    const entry = openStack.splice(idx, 1)[0];
    entry.node.hidden = true;
    if (entry.onClose) entry.onClose();
    if (!openStack.length) { $('#scrim').hidden = true; document.body.style.overflow = ''; }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function closeTop() { if (openStack.length) closeOverlay(openStack[openStack.length - 1].node); }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#exportMenu').hidden) { toggleExport(false); return; }
      if (!$('#cycCal').hidden) { $('#cycCal').hidden = true; $('#cycCal').innerHTML = ''; cycCal = null; return; }
      if (openStack.length) { e.preventDefault(); closeTop(); }
      return;
    }
    if (e.key === 'Tab' && openStack.length) {
      const root = openStack[openStack.length - 1].node;
      const f = focusables(root);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- calendar ---------------- */
  function createCalendar(opts) {
    const o = Object.assign({ value: null, max: null, minYear: 1700, maxYear: new Date().getFullYear() + 1, allowClear: true }, opts);
    let view = o.value ? { y: o.value.y, m: o.value.m } : (o.max ? { y: o.max.getFullYear(), m: o.max.getMonth() + 1 } : { y: new Date().getFullYear(), m: new Date().getMonth() + 1 });
    let value = o.value;
    const el = document.createElement('div');
    el.className = 'cal';

    function render(focusDay) {
      const dim = N.daysInMonth(view.y, view.m);
      const firstDow = (new Date(view.y, view.m - 1, 1).getDay() + 6) % 7;
      const tod = todayObj();
      const years = [];
      const hi = Math.max(o.maxYear, view.y);
      const lo = Math.min(o.minYear, view.y);
      for (let y = hi; y >= lo; y -= 1) years.push(y);
      let cells = '';
      for (let i = 0; i < firstDow; i += 1) cells += '<span class="cal__pad"></span>';
      for (let d = 1; d <= dim; d += 1) {
        const isSel = value && value.y === view.y && value.m === view.m && value.d === d;
        const isToday = tod.y === view.y && tod.m === view.m && tod.d === d;
        const disabled = o.max && new Date(view.y, view.m - 1, d) > o.max;
        cells += `<button type="button" class="cal__day${isSel ? ' is-sel' : ''}${isToday ? ' is-today' : ''}" data-day="${d}"${disabled ? ' disabled' : ''} aria-label="${d} ${esc(monthName(view.m))} ${view.y}"${isSel ? ' aria-current="date"' : ''}>${d}</button>`;
      }
      el.innerHTML = `
        <div class="cal__head">
          <button type="button" class="icon-btn" data-cal="pm" aria-label="${esc(t('common.prev'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-left"/></svg></button>
          <span class="cal__title">${esc(monthName(view.m))} ${view.y}</span>
          <button type="button" class="icon-btn" data-cal="nm" aria-label="${esc(t('common.next'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-right"/></svg></button>
        </div>
        <div class="cal__jump">
          <label class="select-wrap select-wrap--sm"><span class="sr-only">${esc(t('form.monthJump'))}</span>
            <select data-cal="month">${t('months').map((m, i) => `<option value="${i + 1}"${i + 1 === view.m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>
            <svg class="ico ico--sm" aria-hidden="true"><use href="#i-down"/></svg></label>
          <label class="select-wrap select-wrap--sm"><span class="sr-only">${esc(t('form.yearJump'))}</span>
            <select data-cal="year">${years.map((y) => `<option value="${y}"${y === view.y ? ' selected' : ''}>${y}</option>`).join('')}</select>
            <svg class="ico ico--sm" aria-hidden="true"><use href="#i-down"/></svg></label>
        </div>
        <div class="cal__week">${t('cycles.weekdays').map((d) => `<span>${esc(d)}</span>`).join('')}</div>
        <div class="cal__grid" role="grid">${cells}</div>
        <div class="cal__foot">
          <button type="button" class="btn btn--ghost btn--sm" data-cal="today">${esc(t('common.today'))}</button>
          ${o.allowClear ? `<button type="button" class="btn btn--ghost btn--sm" data-cal="clear">${esc(t('common.clear'))}</button>` : ''}
        </div>`;
      if (focusDay) {
        const target = $(`[data-day="${focusDay}"]`, el);
        if (target) target.focus();
      }
    }

    function pick(v, keepView) {
      value = v;
      if (v && !keepView) view = { y: v.y, m: v.m };
      render();
      o.onPick && o.onPick(v);
    }

    el.addEventListener('click', (e) => {
      const day = e.target.closest('[data-day]');
      if (day) { pick({ y: view.y, m: view.m, d: Number(day.dataset.day) }, true); sfx.tap(); return; }
      const act = e.target.closest('[data-cal]');
      if (!act) return;
      const a = act.dataset.cal;
      if (a === 'pm' || a === 'nm') {
        const d = new Date(view.y, view.m - 1 + (a === 'pm' ? -1 : 1), 1);
        view = { y: d.getFullYear(), m: d.getMonth() + 1 }; render(); sfx.tap();
      } else if (a === 'today') { pick(todayObj()); sfx.tap(); }
      else if (a === 'clear') { pick(null); }
    });
    el.addEventListener('change', (e) => {
      const s = e.target.closest('select[data-cal]');
      if (!s) return;
      if (s.dataset.cal === 'month') view.m = Number(s.value); else view.y = Number(s.value);
      render();
    });
    el.addEventListener('keydown', (e) => {
      const day = e.target.closest('[data-day]');
      if (!day) return;
      const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = shiftDays({ y: view.y, m: view.m, d: Number(day.dataset.day) }, map[e.key]);
      if (next.m !== view.m || next.y !== view.y) { view = { y: next.y, m: next.m }; render(next.d); }
      else { const target = $(`[data-day="${next.d}"]`, el); if (target) target.focus(); }
    });

    render();
    return { el, set(v) { value = v; if (v) view = { y: v.y, m: v.m }; render(); }, get() { return value; } };
  }

  function parseDateText(text) {
    const s = String(text || '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    let y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
      m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (!m) return null;
      d = +m[1]; mo = +m[2]; y = +m[3];
    }
    if (!N.isValidDate(y, mo, d)) return null;
    return { y, m: mo, d };
  }

  function createDateField(host, opts) {
    const o = Object.assign({ value: null, max: null, onChange: null, allowClear: true }, opts);
    let value = o.value;
    let cal = null;
    host.innerHTML = `
      <div class="datefield__row">
        <input class="datefield__input" type="text" inputmode="numeric" autocomplete="bday"
          placeholder="dd/mm/yyyy" aria-label="${esc(t('form.dateLabel'))}" />
        <button class="icon-btn" type="button" aria-expanded="false" aria-label="${esc(t('form.pickDate'))}">
          <svg class="ico" aria-hidden="true"><use href="#i-calendar"/></svg>
        </button>
      </div>
      <div class="datefield__slot"></div>`;
    const input = $('.datefield__input', host);
    const toggle = $('button', host);
    const slot = $('.datefield__slot', host);

    function sync() { input.value = value ? `${String(value.d).padStart(2, '0')}/${String(value.m).padStart(2, '0')}/${value.y}` : ''; }
    function closeCal() { if (cal) { cal.el.remove(); cal = null; toggle.setAttribute('aria-expanded', 'false'); } }
    function openCal() {
      cal = createCalendar({
        value, max: o.max, allowClear: o.allowClear,
        minYear: 1700, maxYear: (o.max || new Date()).getFullYear(),
        onPick(v) { value = v; sync(); closeCal(); o.onChange && o.onChange(v); },
      });
      slot.appendChild(cal.el);
      toggle.setAttribute('aria-expanded', 'true');
      const sel = $('.cal__day.is-sel', cal.el) || $('.cal__day:not([disabled])', cal.el);
      if (sel) sel.focus();
    }
    toggle.addEventListener('click', () => { if (cal) closeCal(); else openCal(); sfx.tap(); });
    input.addEventListener('change', () => {
      const parsed = parseDateText(input.value);
      if (parsed) { value = parsed; o.onChange && o.onChange(parsed); }
      else if (!input.value.trim()) { value = null; o.onChange && o.onChange(null); }
      sync();
    });
    input.addEventListener('blur', () => { if (input.value.trim() && !parseDateText(input.value)) sync(); });
    sync();
    const api = {
      get: () => value,
      set(v) { value = v; sync(); if (cal) cal.set(v); },
      focus() { input.focus(); },
      close: closeCal,
    };
    return api;
  }

  /* ---------------- chrome ---------------- */
  function applyStaticI18n() {
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    $$('[data-i18n]').forEach((n) => { const v = t(n.dataset.i18n); if (typeof v === 'string') n.textContent = v; });
    $$('[data-i18n-placeholder]').forEach((n) => { const v = t(n.dataset.i18nPlaceholder); if (typeof v === 'string') n.placeholder = v; });
    $$('[data-i18n-aria]').forEach((n) => { const v = t(n.dataset.i18nAria); if (typeof v === 'string') n.setAttribute('aria-label', v); });
    const tips = { soundBtn: state.sound ? t('header.soundOn') : t('header.soundOff'), themeBtn: t('header.theme'), exportBtn: t('header.export'), journalBtn: t('nav.journal') };
    Object.keys(tips).forEach((id) => { const n = document.getElementById(id); if (n) n.dataset.tip = tips[id]; });
    $('#profileModalTitle').textContent = t('form.title');
  }

  function buildNav() {
    const rail = $('#railGroup'); const tab = $('#tabbar');
    rail.innerHTML = VIEWS.map((v) => `
      <button class="rail__btn" type="button" data-goto="${v}">
        <svg class="ico" aria-hidden="true"><use href="#${VIEW_ICON[v]}"/></svg>
        <span>${esc(t('nav.' + v))}</span><em data-railhint="${v}"></em>
      </button>`).join('');
    tab.innerHTML = VIEWS.map((v) => `
      <button class="tabbar__btn" type="button" data-goto="${v}">
        <svg class="ico" aria-hidden="true"><use href="#${VIEW_ICON[v]}"/></svg>
        <span>${esc(t('nav.' + v))}</span>
      </button>`).join('');
  }

  function renderChrome() {
    const p = activeProfile(); const c = chart();
    $$('.rail__btn, .tabbar__btn').forEach((b) => b.classList.toggle('is-on', b.dataset.goto === state.view));
    const chip = $('#profileChip');
    if (p && c) {
      chip.style.setProperty('--hue', hue(c.lifePath.value));
      $('#profileDot').textContent = c.lifePath.value;
      $('#profileName').textContent = p.name;
      $('#profileMeta').textContent = `${t('header.born')} ${fmtDate({ y: p.year, m: p.month, d: p.day })} · ${t('header.age', { n: N.ageOn({ year: p.year, month: p.month, day: p.day }) })}`;
    } else {
      chip.style.removeProperty('--hue');
      $('#profileDot').textContent = '+';
      $('#profileName').textContent = t('header.setProfile');
      $('#profileMeta').textContent = '';
    }
    $('#journalCount').textContent = state.profiles.length;
    const hints = {
      chart: c ? String(c.lifePath.value) : '—',
      timeline: p ? String(N.ageOn({ year: p.year, month: p.month, day: p.day })) : '—',
      cycles: p ? String(N.personalDay(p.month, p.day, state.cycDate.y, state.cycDate.m, state.cycDate.d).value) : '—',
      bond: state.bond.name && state.bond.date ? '2' : '—',
      atlas: '12',
    };
    $$('[data-railhint]').forEach((n) => { n.textContent = hints[n.dataset.railhint] || ''; });
    $('#exampleBanner').hidden = !(state.banner && p && p.example);
    $('#soundBtn').setAttribute('aria-pressed', String(state.sound));
    $('#soundIcon').setAttribute('href', state.sound ? '#i-sound-on' : '#i-sound-off');
    $('#soundBtn').dataset.tip = state.sound ? t('header.soundOn') : t('header.soundOff');
    $('#themeIcon').setAttribute('href', state.theme === 'obsidian' ? '#i-sun' : '#i-moon');
    $('#themeBtn').dataset.tip = state.theme === 'obsidian' ? t('header.themeLight') : t('header.themeDark');
    $$('#langSeg .seg__btn').forEach((b) => b.classList.toggle('is-on', b.dataset.lang === lang));
  }

  function goto(view, silent) {
    if (!VIEWS.includes(view)) return;
    state.view = view;
    $$('.view').forEach((s) => { s.hidden = s.dataset.view !== view; });
    renderChrome();
    renderView();
    persist();
    if (!silent) { sfx.nav(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  function renderView() {
    if (state.view === 'chart') renderChart();
    else if (state.view === 'timeline') renderTimeline();
    else if (state.view === 'cycles') renderCycles();
    else if (state.view === 'bond') renderBond();
    else if (state.view === 'atlas') renderAtlas();
    observeReveals($('#view' + state.view.charAt(0).toUpperCase() + state.view.slice(1)));
  }

  /* ---------------- chart view ---------------- */
  function renderChart() {
    const p = activeProfile(); const c = chart();
    $('#chartEmpty').hidden = Boolean(p);
    $('#chartBody').hidden = !p;
    if (!p) { renderEmptyExamples(); return; }

    const age = N.ageOn({ year: p.year, month: p.month, day: p.day });
    $('#chartMeta').innerHTML = `
      <span class="meta-pill"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-user"/></svg>${esc(p.name)}</span>
      <span class="meta-pill">${esc(t('timeline.bornIn', { date: fmtDate({ y: p.year, m: p.month, d: p.day }, 'long') }))}</span>
      <span class="meta-pill"><b>${age}</b> ${esc(t('timeline.ageLabel').toLowerCase())}</span>`;

    renderWheel(c);
    renderHero(c);
    renderCore(c);
    renderLedger(c);
    renderNameShift(p, c);
    renderReading(c);
    renderArithmetic(c);
    observeReveals($('#chartBody'));
  }

  function renderEmptyExamples() {
    const host = $('#emptyExamples');
    host.innerHTML = t('examples').map((ex, i) => {
      const lp = N.lifePath(ex.month, ex.day, ex.year).value;
      return `<button class="example-card" type="button" data-example="${i}" style="--hue:${hue(lp)}">
        <strong>${esc(ex.name)}</strong><small>${esc(ex.note)}</small><b>${esc(t('chart.lifePath'))} ${lp}</b>
      </button>`;
    }).join('');
  }

  function renderWheel(c) {
    const svg = $('#wheel');
    const cx = 210, cy = 210, R = 152;
    const owned = {};
    c.core.forEach((k) => { (owned[k.value] = owned[k.value] || []).push(k.key); });
    const pt = (n, r) => { const a = (-90 + (n - 1) * 40) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };

    let ticks = '';
    for (let i = 0; i < 72; i += 1) {
      const a = (i * 5) * Math.PI / 180;
      const major = i % 6 === 0;
      const r1 = major ? 190 : 195, r2 = 201;
      ticks += `<line class="w-tick${major ? ' w-tick--major' : ''}" x1="${(cx + r1 * Math.cos(a)).toFixed(2)}" y1="${(cy + r1 * Math.sin(a)).toFixed(2)}" x2="${(cx + r2 * Math.cos(a)).toFixed(2)}" y2="${(cy + r2 * Math.sin(a)).toFixed(2)}"/>`;
    }
    const hexad = [1, 4, 2, 8, 5, 7];
    const line = (a, b) => { const [x1, y1] = pt(a, R - 24); const [x2, y2] = pt(b, R - 24); return `<line class="w-link${owned[a] && owned[b] ? ' w-link--lit' : ''}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`; };
    let links = '';
    for (let i = 0; i < hexad.length; i += 1) links += line(hexad[i], hexad[(i + 1) % hexad.length]);
    links += line(3, 6) + line(6, 9) + line(9, 3);

    let nodes = '';
    for (let d = 1; d <= 9; d += 1) {
      const [x, y] = pt(d, R);
      const lit = Boolean(owned[d]);
      const abbr = (owned[d] || []).map((k) => ABBR[k]).join('·');
      const [bx, by] = pt(d, R + 36);
      nodes += `<g class="w-node${lit ? ' is-lit' : ''}" data-number="${d}" style="--hue:${hue(d)}" tabindex="0" role="button" aria-label="${esc(t('atlas.openNumber', { n: d }))}">
        <circle class="halo" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="29"/>
        <circle class="disc" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="22"/>
        <circle class="hit" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="30"/>
        <text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="21">${d}</text>
        ${abbr ? `<text class="w-badge" x="${bx.toFixed(2)}" y="${(by + 3).toFixed(2)}">${esc(abbr)}</text>` : ''}
      </g>`;
    }

    const lp = c.lifePath.value;
    svg.innerHTML = `
      <g class="w-ticks">${ticks}</g>
      <circle class="w-ring" cx="${cx}" cy="${cy}" r="186"/>
      <circle class="w-ring" cx="${cx}" cy="${cy}" r="120"/>
      ${links}
      <g style="--hue:${hue(lp)}">
        <circle class="w-center-bg" cx="${cx}" cy="${cy}" r="76"/>
        <text class="w-center-num" x="${cx}" y="${cy - 4}">${lp}</text>
        <text class="w-center-cap" x="${cx}" y="${cy + 42}">${esc(t('chart.lifePath'))}</text>
      </g>
      ${nodes}`;
    svg.onclick = (e) => { const g = e.target.closest('[data-number]'); if (g) { sfx.tap(); openDrawer(Number(g.dataset.number)); } };
    svg.onkeydown = (e) => { const g = e.target.closest('[data-number]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sfx.tap(); openDrawer(Number(g.dataset.number)); } };

    $('#wheelLegend').innerHTML = c.core.map((k) => `<button class="chip" type="button" data-number="${k.value}" style="--hue:${hue(k.value)}">${ABBR[k.key]} · ${esc(t('chart.core.' + k.key))} ${k.value}</button>`).join('');
    $('#wheelLegend').onclick = (e) => { const b = e.target.closest('[data-number]'); if (b) { sfx.tap(); openDrawer(Number(b.dataset.number)); } };
  }

  function renderHero(c) {
    const info = num(c.lifePath.value);
    const panel = $('#heroRead');
    panel.style.setProperty('--hue', hue(c.lifePath.value));
    $('#heroNum').textContent = c.lifePath.value;
    $('#heroTitle').textContent = info.title;
    $('#heroTag').textContent = info.tag + (N.MASTER_NUMBERS.includes(c.lifePath.value) ? ' · ' + t('common.master') : '');
    $('#heroEssence').textContent = info.essence;
    $('#heroAs').textContent = info.as.lifePath;
    $('#heroKeywords').innerHTML = info.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join('');
    $('#heroPair').innerHTML = `<span class="lbl">${esc(t('chart.pairings'))}</span>` +
      N.pairings(c.lifePath.value).map((n) => `<button class="pair-dot" type="button" data-number="${n}" style="--hue:${hue(n)}" aria-label="${esc(t('atlas.openNumber', { n }))}">${n}</button>`).join('');
    $('#heroPair').onclick = (e) => { const b = e.target.closest('[data-number]'); if (b) { sfx.tap(); openDrawer(Number(b.dataset.number)); } };
    renderHeroNow(c);
  }

  function renderHeroNow(c) {
    const host = $('#heroNow');
    const p = c.profile;
    if (!N.isValidDate(p.year, p.month, p.day)) { host.innerHTML = ''; host.hidden = true; return; }
    host.hidden = false;
    const today = new Date();
    const py = N.personalYear(p.month, p.day, today.getFullYear());
    const pd = N.personalDay(p.month, p.day, today.getFullYear(), today.getMonth() + 1, today.getDate());
    const age = N.ageOn({ year: p.year, month: p.month, day: p.day }, today);
    const pin = N.currentPinnacle(c, age);
    const cells = [
      { value: py.value, label: t('cycles.personalYear') },
      { value: pd.value, label: t('cycles.personalDay') },
      { value: pin ? pin.value : c.periods[0].value, label: pin ? t('chart.nowPinnacle') : t('timeline.periodOrder')[0] },
    ];
    host.innerHTML = `<div class="hero-now__head">
        <span>${esc(t('chart.nowLabel'))}</span>
        <button class="hero-now__link" type="button" data-goto="cycles">${esc(t('chart.nowOpen'))} →</button>
      </div>
      <div class="hero-now__row">${cells.map((x) => `<button class="now-cell" type="button" data-goto="cycles" style="--hue:${hue(x.value)}">
        <b>${x.value}</b><small>${esc(x.label)}</small>
      </button>`).join('')}</div>`;
    host.onclick = (e) => { if (e.target.closest('[data-goto]')) { sfx.nav(); goto('cycles'); } };
  }

  function renderCore(c) {
    $('#coreGrid').innerHTML = c.core.map((k, i) => {
      const master = N.MASTER_NUMBERS.includes(k.value);
      const root = N.reduceRoot(k.value);
      return `<button class="core-tile reveal" type="button" data-number="${k.value}" style="--hue:${hue(k.value)};transition-delay:${i * 45}ms">
        <span class="core-tile__label">${esc(t('chart.core.' + k.key))}</span>
        <span class="core-tile__val">${k.value}${master ? `<sup>${root}</sup>` : ''}</span>
        <span class="core-tile__how">${esc(t('chart.coreHow.' + k.key))}</span>
      </button>`;
    }).join('');
    $('#coreGrid').onclick = (e) => { const b = e.target.closest('[data-number]'); if (b) { sfx.tap(); openDrawer(Number(b.dataset.number)); } };
  }

  function renderLedger(c) {
    const a = c.name;
    const filter = state.ledgerFilter;
    $('#ledger').innerHTML = a.words.map((w) => `
      <div class="ledger-word">
        <span class="ledger-word__tag">${esc(w.text)}</span>
        ${w.letters.map((l) => {
          const dim = filter !== 'all' && l.role !== filter;
          const tip = l.flipped ? t('reasons.flipped') : t('reasons.' + l.reason);
          const inner = `<span class="lt__char">${l.char}</span><span class="lt__val">${l.value}</span>
            <span class="lt__tip"><b>${l.char} = ${l.value} · ${esc(t('chart.filter' + (l.role === 'vowel' ? 'Vowels' : 'Consonants')).replace(/s$/, ''))}</b>${esc(tip)}</span>`;
          const cls = `lt${l.isY ? ' lt--y' : ''}${l.flipped ? ' lt--flipped' : ''}${dim ? ' is-dim' : ''}`;
          return l.isY
            ? `<button type="button" class="${cls}" data-role="${l.role}" data-yid="${l.id}" aria-pressed="${l.flipped}" aria-label="${l.char}, ${esc(tip)}">${inner}</button>`
            : `<span class="${cls}" data-role="${l.role}" tabindex="0">${inner}</span>`;
        }).join('')}
      </div>`).join('');

    $('#ledger').onclick = (e) => {
      const b = e.target.closest('[data-yid]');
      if (!b) return;
      flipY(b.dataset.yid);
    };

    const tot = (label, sum, reduced, h) => `<div class="total" style="--hue:${h}">
      <span class="total__k">${esc(label)}</span>
      <span class="total__v"><i>${sum}</i>→<b>${reduced}</b></span></div>`;
    $('#ledgerTotals').innerHTML =
      tot(t('chart.totalsVowels'), a.vowelTotal, a.soul.reduced, 'var(--d8)') +
      tot(t('chart.totalsConsonants'), a.consonantTotal, a.personality.reduced, 'var(--d2)') +
      tot(t('chart.totalsAll'), a.total, a.destiny.reduced, 'var(--brass)');

    $('#yRule').innerHTML = `
      <span class="y-rule__mark">Y</span>
      <span class="y-rule__txt">
        <strong>${esc(t('chart.yRuleTitle'))}</strong>
        <p>${esc(t('chart.yRuleBody'))}</p>
        <small>${esc(a.yCount ? t('chart.yHint') : t('chart.yNone'))}</small>
      </span>
      ${a.flippedCount ? `<button class="btn btn--ghost btn--sm" type="button" id="yReset"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-undo"/></svg>${esc(t('chart.yReset'))}</button>` : ''}`;
    const reset = $('#yReset');
    if (reset) reset.addEventListener('click', () => {
      state.overrides[c.profile.id] = {};
      chartCache = null; persist(); renderChart(); renderChrome();
      toast(t('toast.yReset'), { icon: 'i-undo' }); sfx.flip();
    });
  }

  function flipY(letterId) {
    const c = chart(); if (!c) return;
    const letter = c.name.letters.find((l) => l.id === letterId);
    if (!letter) return;
    const next = letter.role === 'vowel' ? 'consonant' : 'vowel';
    const bag = state.overrides[c.profile.id] || (state.overrides[c.profile.id] = {});
    if (next === letter.autoRole) delete bag[letterId]; else bag[letterId] = next;
    chartCache = null; persist();
    renderChart(); renderChrome();
    toast(t('toast.yFlipped', { role: t('toast.' + next) }), { icon: 'i-swap', tone: 'var(--d3)' });
    sfx.flip();
    const again = $(`[data-yid="${letterId}"]`);
    if (again) again.focus();
  }

  function renderNameShift(p, c) {
    const block = $('#nameShiftBlock');
    if (!p.currentName || N.normalizeName(p.currentName).toLowerCase() === N.normalizeName(p.name).toLowerCase()) { block.hidden = true; return; }
    block.hidden = false;
    const alt = N.analyzeName(p.currentName, {});
    const rows = [
      { key: 'destiny', a: c.destiny.reduced, b: alt.destiny.reduced },
      { key: 'soul', a: c.soul.reduced, b: alt.soul.reduced },
      { key: 'personality', a: c.personality.reduced, b: alt.personality.reduced },
    ];
    const col = (title, name, vals, base) => `<div class="shift-col">
      <h3>${esc(title)}</h3><p class="nm">${esc(name)}</p>
      ${rows.map((r, i) => {
        const v = vals[i]; const from = base[i];
        return `<div class="shift-row" style="--hue:${hue(v)}"><span>${esc(t('chart.core.' + r.key))}</span>
          <span><b>${v}</b> ${v !== from ? `<span class="delta">${from}→${v}</span>` : ''}</span></div>`;
      }).join('')}
    </div>`;
    const same = rows.every((r) => r.a === r.b);
    $('#nameShift').innerHTML = `<div class="shift-grid">
      ${col(t('chart.nameShiftBirth'), p.name, rows.map((r) => r.a), rows.map((r) => r.a))}
      ${col(t('chart.nameShiftCurrent'), p.currentName, rows.map((r) => r.b), rows.map((r) => r.a))}
    </div><p class="shift-note">${esc(same ? t('chart.nameShiftSame') : t('chart.nameShiftNote'))}</p>`;
  }

  function renderReading(c) {
    const info = num(c.lifePath.value);
    $('#lifeReading').innerHTML = `
      <div class="reading__grid">
        <div class="read-card reveal" style="--hue:${hue(c.lifePath.value)}">
          <h3>${esc(t('drawer.strengths'))}</h3>
          <ul class="read-list">${info.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>
        <div class="read-card reveal">
          <h3>${esc(t('drawer.shadows'))}</h3>
          <ul class="read-list read-list--shadow">${info.shadows.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>
        <div class="read-card reveal"><h3>${esc(t('drawer.love'))}</h3><p>${esc(info.love)}</p></div>
        <div class="read-card reveal"><h3>${esc(t('drawer.work'))}</h3><p>${esc(info.work)}</p></div>
      </div>`;
    const btn = $('#arithToggle');
    btn.setAttribute('aria-expanded', String(state.arithOpen));
    $('span', btn).textContent = state.arithOpen ? t('chart.arithmeticHide') : t('chart.arithmetic');
    $('#arithmetic').hidden = !state.arithOpen;
    observeReveals($('#lifeReading'));
  }

  function renderArithmetic(c) {
    const p = c.profile;
    const row = (k, f, r) => `<div class="arith-row"><span class="k">${esc(k)}</span><span>${esc(f)}</span><span class="r">= ${r}</span></div>`;
    const lp = c.lifePath;
    const letters = (arr) => arr.map((l) => `${l.char}${l.value}`).join(' + ') || '—';
    const pinRows = c.pinnacles.map((x, i) => row(t('timeline.pinnacleOrder')[i], `${x.formula.join(' ')}`, x.value)).join('');
    const chalRows = c.challenges.map((x, i) => row(t('timeline.challengeOrder')[i], `${x.formula.join(' ')}`, x.value)).join('');
    $('#arithmetic').innerHTML = `
      <div class="arith-group"><h3>${esc(t('chart.coreTitle'))}</h3>
        ${row(t('chart.core.lifePath'), `${lp.monthReduced} + ${lp.dayReduced} + ${lp.yearReduced} = ${lp.sum}`, lp.value)}
        ${row(t('chart.core.destiny'), `${c.destiny.total} (${c.destiny.letters.length} ${t('common.letters')})`, c.destiny.reduced)}
        ${row(t('chart.core.soul'), letters(c.soul.letters) + ` = ${c.soul.total}`, c.soul.reduced)}
        ${row(t('chart.core.personality'), letters(c.personality.letters) + ` = ${c.personality.total}`, c.personality.reduced)}
        ${row(t('chart.core.birthday'), `${p.day}`, c.birthday.value)}
        ${row(t('chart.core.maturity'), `${lp.value} + ${c.destiny.reduced} = ${c.maturity.sum}`, c.maturity.value)}
      </div>
      <div class="arith-group"><h3>${esc(t('timeline.pinnacles'))}</h3>${pinRows}</div>
      <div class="arith-group"><h3>${esc(t('timeline.challenges'))}</h3>${chalRows}</div>
      <p class="arith-note">${esc(t('chart.arithmeticNote'))}</p>`;
  }

  /* ---------------- timeline view ---------------- */
  function renderTimeline() {
    const p = activeProfile(); const c = chart(); const host = $('#tlBody');
    if (!p) {
      $('#tlMeta').innerHTML = '';
      host.innerHTML = `<div class="empty"><h2>${esc(t('timeline.noProfile'))}</h2>
        <button class="btn btn--primary" type="button" data-open-profile>${esc(t('empty.cta'))}</button></div>`;
      return;
    }
    const birth = { year: p.year, month: p.month, day: p.day };
    const age = N.ageOn(birth);
    $('#tlMeta').innerHTML = `<span class="meta-pill">${esc(t('timeline.bornIn', { date: fmtDate({ y: p.year, m: p.month, d: p.day }, 'long') }))}</span>
      <span class="meta-pill"><b>${age}</b> ${esc(t('timeline.ageLabel').toLowerCase())}</span>`;

    const pin = N.currentPinnacle(c, age);
    const chal = N.currentChallenge(c, age);
    const per = N.currentPeriod(c, age);
    const nowCard = (k, v, body, h) => `<div class="now-card" style="--hue:${h}">
      <span class="now-card__k">${esc(k)}</span>
      <span class="now-card__v"><b>${v}</b>${esc(num(v).title)}</span>
      <p>${esc(body)}</p></div>`;

    const MAXA = 90;
    const first = c.pinnacles[0];
    const segs = [];
    if (first.startAge > 0) segs.push({ early: true, from: 0, to: first.startAge });
    c.pinnacles.forEach((x) => segs.push({ from: x.startAge, to: x.endAge == null ? MAXA : Math.min(x.endAge, MAXA), n: x.value, idx: x.index }));
    const span = MAXA;
    const bar = segs.map((s) => {
      const w = ((s.to - s.from) / span) * 100;
      if (s.early) return `<div class="tl-seg tl-seg--early" style="width:${w.toFixed(3)}%" title="${esc(t('timeline.earlyYears'))}"><span class="tl-seg__n">0–${s.to}</span></div>`;
      return `<button type="button" class="tl-seg" data-number="${s.n}" style="width:${w.toFixed(3)}%;--hue:${hue(s.n)};background:color-mix(in srgb, ${hue(s.n)} ${pin && pin.index === s.idx ? 50 : 30}%, var(--surface))" aria-label="${esc(t('timeline.pinnacleOrder')[s.idx])} ${s.n}"><span class="tl-seg__n">${s.n}</span></button>`;
    }).join('');
    let axis = '';
    for (let a = 0; a <= MAXA; a += 10) {
      const pct = (a / span) * 100;
      const edge = pct < 3 ? ' is-start' : pct > 97 ? ' is-end' : '';
      axis += `<span class="tl-tick${edge}" style="left:${pct}%">${a}</span>`;
    }
    const markerPos = clamp((age / span) * 100, 0, 100);
    const chalStages = c.challenges.map((x, i) => Object.assign({}, x, { startAge: c.pinnacles[i].startAge, endAge: c.pinnacles[i].endAge }));

    const stageCard = (x, kind, i, active) => {
      const labels = t('timeline.' + kind + 'Order');
      const range = x.endAge == null ? t('timeline.rangeOpen', { start: x.startAge }) : (x.startAge === 0 ? t('timeline.rangeBirth', { end: x.endAge }) : t('timeline.range', { start: x.startAge, end: x.endAge }));
      const left = active && x.endAge != null ? `<span class="stage__left">${esc(t('timeline.yearsLeft', { n: x.endAge - age }))}</span>` : '';
      const body = kind === 'pinnacle' ? num(x.value).pinnacle : kind === 'challenge' ? num(x.value).challenge : num(x.value).essence;
      const formula = x.formula ? `${x.formula.join(' ')} = ${x.value}` : t('timeline.periodSource')[x.source];
      return `<button class="stage reveal${active ? ' is-active' : ''}" type="button" data-number="${x.value}" style="--hue:${hue(x.value)}">
        <span class="stage__top"><span class="stage__k">${esc(labels[i])}</span>${active ? `<span class="badge badge--now">${esc(t('timeline.activeNow'))}</span>` : ''}</span>
        <span class="stage__top"><span class="stage__n">${x.value}</span><span class="stage__age">${esc(range)}</span></span>
        <span class="stage__f">${esc(formula)}</span>
        <p>${esc(body)}</p>
        ${left}
      </button>`;
    };

    host.innerHTML = `
      <div class="tl-now">
        ${pin ? nowCard(t('timeline.pinnacles') + ' · ' + t('timeline.pinnacleOrder')[pin.index], pin.value, num(pin.value).pinnacle, hue(pin.value))
              : nowCard(t('timeline.earlyYears'), per ? per.value : c.periods[0].value, t('timeline.earlyYearsBody'), hue(per ? per.value : c.periods[0].value))}
        ${nowCard(t('timeline.challenges') + ' · ' + t('timeline.challengeOrder')[chal.index], chal.value, num(chal.value).challenge, hue(chal.value))}
        ${per ? nowCard(t('timeline.periods') + ' · ' + t('timeline.periodOrder')[per.index], per.value, num(per.value).essence, hue(per.value)) : ''}
      </div>

      <div class="panel tl-bar-wrap reveal">
        <div class="tl-bar">${bar}
          <div class="tl-marker" style="left:${markerPos.toFixed(3)}%"><span class="tl-marker__lbl${markerPos < 16 ? ' is-start' : markerPos > 84 ? ' is-end' : ''}">${esc(t('timeline.youAreHere', { age }))}</span></div>
        </div>
        <div class="tl-axis">${axis}</div>
      </div>

      <section class="block">
        <header class="block__head"><div><h2>${esc(t('timeline.pinnacles'))}</h2></div></header>
        <div class="tl-cards">${c.pinnacles.map((x, i) => stageCard(x, 'pinnacle', i, Boolean(pin && pin.index === i))).join('')}</div>
      </section>

      <section class="block">
        <header class="block__head"><div><h2>${esc(t('timeline.challenges'))}</h2><p>${esc(t('timeline.challengeNote'))}</p></div></header>
        <div class="tl-cards">${chalStages.map((x, i) => stageCard(x, 'challenge', i, Boolean(pin && pin.index === i))).join('')}</div>
      </section>

      <section class="block">
        <header class="block__head"><div><h2>${esc(t('timeline.periods'))}</h2></div></header>
        <div class="tl-cards">${c.periods.map((x, i) => stageCard(x, 'period', i, Boolean(per && per.index === i))).join('')}</div>
      </section>`;
    host.onclick = (e) => {
      if (e.target.closest('[data-open-profile]')) { openProfileModal(); return; }
      const b = e.target.closest('[data-number]');
      if (b) { sfx.tap(); openDrawer(Number(b.dataset.number)); }
    };
  }

  /* ---------------- cycles view ---------------- */
  let cycCal = null;
  function renderCycles() {
    const p = activeProfile(); const host = $('#cycBody');
    const sel = state.cycDate;
    $('#cycDateLabel').textContent = fmtDate(sel, 'long');
    $('#scrubber').hidden = !p;
    if (!p) {
      $('#cycCal').hidden = true; $('#cycCal').innerHTML = ''; cycCal = null;
      host.innerHTML = `<div class="empty"><h2>${esc(t('cycles.noProfile'))}</h2>
        <button class="btn btn--primary" type="button" data-open-profile>${esc(t('cycles.addDate'))}</button></div>`;
      host.onclick = (e) => { if (e.target.closest('[data-open-profile]')) openProfileModal(); };
      return;
    }
    const pd = N.personalDay(p.month, p.day, sel.y, sel.m, sel.d);
    const card = (key, value, formula, flabel, meaning, h) => `<article class="cyc-card reveal" style="--hue:${h}">
      <span class="cyc-card__k">${esc(key)}</span>
      <span class="cyc-card__n">${value}</span>
      <span class="cyc-card__f">${esc(formula)}</span>
      <span class="cyc-card__fl">${esc(flabel)}</span>
      <p class="cyc-card__m">${esc(meaning)}</p>
    </article>`;

    const cards = `<div class="cyc-cards">
      ${card(t('cycles.personalYear'), pd.yearValue, t('cycles.yearFormula', { bm: p.month, bd: p.day, year: sel.y, sum: pd.yearSum, value: pd.yearValue }), t('cycles.yearFormulaLabel'), num(pd.yearValue).cycle, hue(pd.yearValue))}
      ${card(t('cycles.personalMonth'), pd.monthValue, t('cycles.monthFormula', { py: pd.yearValue, month: sel.m, sum: pd.monthSum, value: pd.monthValue }), t('cycles.monthFormulaLabel'), num(pd.monthValue).cycle, hue(pd.monthValue))}
      ${card(t('cycles.personalDay'), pd.value, t('cycles.dayFormula', { pm: pd.monthValue, day: sel.d, sum: pd.sum, value: pd.value }), t('cycles.dayFormulaLabel'), num(pd.value).cycle, hue(pd.value))}
    </div>`;

    const dim = N.daysInMonth(sel.y, sel.m);
    const firstDow = (new Date(sel.y, sel.m - 1, 1).getDay() + 6) % 7;
    const tod = todayObj();
    let cells = '';
    for (let i = 0; i < firstDow; i += 1) cells += '<span class="hm-cell hm-cell--pad"></span>';
    for (let d = 1; d <= dim; d += 1) {
      const v = N.personalDay(p.month, p.day, sel.y, sel.m, d).value;
      const isToday = tod.y === sel.y && tod.m === sel.m && tod.d === d;
      const isSel = d === sel.d;
      cells += `<button type="button" class="hm-cell${isToday ? ' is-today' : ''}${isSel ? ' is-sel' : ''}" data-day="${d}" style="--hue:${hue(v)}" aria-label="${d} ${esc(monthName(sel.m))}: ${v}"${isSel ? ' aria-current="date"' : ''}>
        <span class="hm-cell__d">${d}</span><span class="hm-cell__n">${v}</span></button>`;
    }
    const legend = N.DIGITS.map((d) => `<span style="--hue:${hue(d)}"><i></i>${d}</span>`).join('');

    const months = N.personalYearMonths(p.month, p.day, sel.y);
    const strip = months.map((m, i) => `<button type="button" class="ys-cell${i + 1 === sel.m ? ' is-now' : ''}" data-month="${i + 1}" style="--hue:${hue(m.value)}" aria-label="${esc(monthName(i + 1))}: ${m.value}">
      <span class="ys-cell__m">${esc(monthShort(i + 1))}</span><span class="ys-cell__n">${m.value}</span><span class="ys-bar"></span></button>`).join('');

    host.innerHTML = `${cards}
      <div class="cyc-lower">
        <section class="panel reveal" style="padding:16px">
          <div class="hm-head">
            <div><h2 style="font-size:1.06rem">${esc(t('cycles.heatmapTitle'))}</h2><p style="font-size:.78rem;color:var(--muted);margin-top:2px">${esc(t('cycles.heatmapHint'))}</p></div>
            <div class="hm-nav">
              <button class="icon-btn" type="button" data-cyc="pm" aria-label="${esc(t('cycles.prevMonth'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-left"/></svg></button>
              <span class="hm-title">${esc(monthName(sel.m))} ${sel.y}</span>
              <button class="icon-btn" type="button" data-cyc="nm" aria-label="${esc(t('cycles.nextMonth'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-right"/></svg></button>
            </div>
          </div>
          <div class="hm-week" style="margin-top:12px">${t('cycles.weekdays').map((d) => `<span>${esc(d)}</span>`).join('')}</div>
          <div class="hm-grid">${cells}</div>
          <div class="hm-legend">${legend}</div>
        </section>
        <div style="display:grid;gap:16px">
          <section class="panel reveal" style="padding:16px">
            <div class="hm-head"><div><h2 style="font-size:1.06rem">${esc(t('cycles.yearStripTitle'))}</h2>
              <p style="font-size:.78rem;color:var(--muted);margin-top:2px">${esc(t('cycles.yearStripHint', { year: sel.y }))}</p></div>
              <div class="hm-nav">
                <button class="icon-btn" type="button" data-cyc="py" aria-label="${esc(t('cycles.prevYear'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-left"/></svg></button>
                <button class="icon-btn" type="button" data-cyc="ny" aria-label="${esc(t('cycles.nextYear'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-right"/></svg></button>
              </div>
            </div>
            <div class="ys-grid" style="margin-top:12px">${strip}</div>
          </section>
          <div class="advice reveal" style="--hue:${hue(pd.value)}">
            <h3>${esc(t('cycles.advice'))} · ${esc(t('cycles.personalDay'))} ${pd.value}</h3>
            <p>${esc(num(pd.value).cycle)}</p>
            <div class="advice__meta"><span>${esc(fmtDate(sel, 'long'))}</span><span>·</span><span>${esc(num(pd.value).title)}</span></div>
            <button class="btn btn--ghost btn--sm" type="button" data-number="${pd.value}">${esc(t('atlas.openNumber', { n: pd.value }))}</button>
          </div>
          <p class="arith-note">${esc(t('cycles.cycleNote'))}</p>
        </div>
      </div>`;

    host.onclick = (e) => {
      const day = e.target.closest('[data-day]');
      if (day) { state.cycDate = { y: sel.y, m: sel.m, d: Number(day.dataset.day) }; sfx.tap(); renderCycles(); renderChrome(); return; }
      const mo = e.target.closest('[data-month]');
      if (mo) {
        const m = Number(mo.dataset.month);
        state.cycDate = { y: sel.y, m, d: Math.min(sel.d, N.daysInMonth(sel.y, m)) };
        sfx.tap(); renderCycles(); renderChrome(); return;
      }
      const act = e.target.closest('[data-cyc]');
      if (act) {
        const a = act.dataset.cyc;
        if (a === 'pm' || a === 'nm') {
          const d = new Date(sel.y, sel.m - 1 + (a === 'pm' ? -1 : 1), 1);
          state.cycDate = { y: d.getFullYear(), m: d.getMonth() + 1, d: Math.min(sel.d, N.daysInMonth(d.getFullYear(), d.getMonth() + 1)) };
        } else {
          const y = sel.y + (a === 'py' ? -1 : 1);
          state.cycDate = { y, m: sel.m, d: Math.min(sel.d, N.daysInMonth(y, sel.m)) };
        }
        sfx.tap(); renderCycles(); renderChrome(); return;
      }
      const nb = e.target.closest('[data-number]');
      if (nb) { sfx.tap(); openDrawer(Number(nb.dataset.number)); }
    };
    observeReveals(host);
  }

  function toggleCycCal() {
    const host = $('#cycCal');
    if (!host.hidden) { host.hidden = true; host.innerHTML = ''; cycCal = null; return; }
    cycCal = createCalendar({
      value: state.cycDate, allowClear: false, minYear: 1900, maxYear: new Date().getFullYear() + 10,
      onPick(v) { if (!v) return; state.cycDate = v; host.hidden = true; host.innerHTML = ''; cycCal = null; renderCycles(); renderChrome(); },
    });
    host.innerHTML = ''; host.appendChild(cycCal.el); host.hidden = false;
  }

  /* ---------------- bond view ---------------- */
  let bondDateField = null;
  function renderBond() {
    const p = activeProfile(); const c = chart(); const host = $('#bondBody');
    if (!p) {
      host.innerHTML = `<div class="empty"><h2>${esc(t('bond.needProfile'))}</h2>
        <button class="btn btn--primary" type="button" data-open-profile>${esc(t('empty.cta'))}</button></div>`;
      host.onclick = (e) => { if (e.target.closest('[data-open-profile]')) openProfileModal(); };
      return;
    }
    const mini = (ch) => `<div class="bond-mini">${ch.core.map((k) => `<div style="--hue:${hue(k.value)}"><span>${esc(t('chart.core.' + k.key))}</span><b>${k.value}</b></div>`).join('')}</div>`;
    const person = (ch, name, date) => `<div class="bond-person" style="--hue:${hue(ch.lifePath.value)}">
      <span class="bond-person__n">${ch.lifePath.value}</span>
      <span><strong>${esc(name)}</strong><small>${esc(fmtDate(date))}</small></span></div>`;

    const journalOptions = state.profiles.filter((x) => x.id !== p.id)
      .map((x) => `<option value="${esc(x.id)}">${esc(x.name)} · ${x.day}/${x.month}/${x.year}</option>`).join('');

    host.innerHTML = `
      <div class="bond-top">
        <section class="panel bond-side">
          <span class="bond-side__k">${esc(t('bond.you'))}</span>
          ${person(c, p.name, { y: p.year, m: p.month, d: p.day })}
          ${mini(c)}
        </section>
        <div class="bond-vs">
          <span class="bond-vs__ring" aria-hidden="true"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="27"/><circle cx="22" cy="30" r="13"/><circle cx="38" cy="30" r="13"/></svg></span>
          <button class="icon-btn" type="button" id="bondSwap" aria-label="${esc(t('bond.swap'))}" data-tip="${esc(t('bond.swap'))}"><svg class="ico" aria-hidden="true"><use href="#i-swap"/></svg></button>
        </div>
        <section class="panel bond-side">
          <span class="bond-side__k">${esc(t('bond.partner'))}</span>
          <div class="field">
            <label class="field__label" for="bondName">${esc(t('bond.partnerName'))}</label>
            <input id="bondName" type="text" value="${esc(state.bond.name)}" placeholder="${esc(t('form.namePlaceholder'))}" />
          </div>
          <div class="field">
            <span class="field__label">${esc(t('bond.partnerDate'))}</span>
            <div class="datefield" id="bondDate" data-datefield="bond"></div>
          </div>
          ${journalOptions ? `<label class="select-wrap"><span class="sr-only">${esc(t('bond.fromJournal'))}</span>
            <select id="bondPick"><option value="">${esc(t('bond.fromJournal'))}</option>${journalOptions}</select>
            <svg class="ico ico--sm" aria-hidden="true"><use href="#i-down"/></svg></label>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" type="button" id="bondGo"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-bond"/></svg>${esc(t('bond.calculate'))}</button>
            <button class="btn btn--ghost btn--sm" type="button" id="bondClear">${esc(t('bond.clear'))}</button>
          </div>
          <p class="field__err" id="bondErr" hidden></p>
        </section>
      </div>
      <div id="bondResult"></div>`;

    bondDateField = createDateField($('#bondDate'), { value: state.bond.date, max: new Date(), onChange(v) { state.bond.date = v; persist(); } });
    $('#bondName').addEventListener('input', (e) => { state.bond.name = e.target.value; });
    $('#bondName').addEventListener('change', persist);
    const pick = $('#bondPick');
    if (pick) pick.addEventListener('change', () => {
      const x = state.profiles.find((q) => q.id === pick.value);
      if (!x) return;
      state.bond = { name: x.name, date: { y: x.year, m: x.month, d: x.day } };
      $('#bondName').value = x.name; bondDateField.set(state.bond.date); persist(); renderBond(); sfx.tap();
    });
    $('#bondGo').addEventListener('click', computeBond);
    $('#bondClear').addEventListener('click', () => { state.bond = { name: '', date: null }; persist(); renderBond(); });
    $('#bondSwap').addEventListener('click', () => {
      if (!state.bond.name || !state.bond.date) return;
      const mine = { name: p.name, date: { y: p.year, m: p.month, d: p.day } };
      const theirs = { name: state.bond.name, date: state.bond.date };
      upsertProfile({ name: theirs.name, month: theirs.date.m, day: theirs.date.d, year: theirs.date.y }, true);
      state.bond = { name: mine.name, date: mine.date };
      persist(); renderBond(); renderChrome(); sfx.flip();
    });
    host.onclick = (e) => {
      const nb = e.target.closest('[data-number]');
      if (nb) { sfx.tap(); openDrawer(Number(nb.dataset.number)); }
    };
    if (state.bond.name && state.bond.date) computeBond(true);
    observeReveals(host);
  }

  function computeBond(quiet) {
    const p = activeProfile(); const c = chart();
    const err = $('#bondErr');
    const name = N.normalizeName(state.bond.name);
    const date = state.bond.date;
    const letters = N.stripDiacritics(name).replace(/[^a-zA-Z]/g, '');
    if (letters.length < 2) { err.textContent = t('validation.partnerName'); err.hidden = false; if (!quiet) sfx.remove(); return; }
    if (!date || !N.isValidDate(date.y, date.m, date.d)) { err.textContent = t('validation.partnerDate'); err.hidden = false; if (!quiet) sfx.remove(); return; }
    err.hidden = true;
    const other = N.buildChart({ id: 'bond', name, month: date.m, day: date.d, year: date.y }, {});
    const res = N.compatibility(c, other);
    const band = t('bond.bands.' + res.band);
    const bandHue = res.band === 'radiant' ? 'var(--d4)' : res.band === 'harmonious' ? 'var(--d9)' : res.band === 'dynamic' ? 'var(--d5)' : 'var(--d3)';
    const circ = 2 * Math.PI * 88;
    const off = circ * (1 - res.score / 100);

    const aspectRow = (a) => `<div class="aspect reveal" style="--hue:${hue(a.left)}">
      <div class="aspect__top">
        <span class="aspect__k">${esc(t('chart.core.' + a.key))}</span>
        <span class="aspect__pair"><b style="--hue:${hue(a.left)}">${a.left}</b><i>×</i><b style="--hue:${hue(a.right)}">${a.right}</b></span>
        <span class="aspect__score">${a.score}</span>
      </div>
      <div class="aspect__bar"><div class="aspect__fill" style="width:${a.score}%"></div></div>
      <p>${esc(t('bond.aspectNote.' + a.key))}${a.mirrored ? ' ' + esc(t('bond.mirrored')) : ''}</p>
    </div>`;

    $('#bondResult').innerHTML = `
      <div class="bond-result" style="margin-top:18px">
        <section class="panel dial-panel reveal" style="--hue:${bandHue}">
          <div class="dial">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <defs><linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style="stop-color:var(--d3)"/><stop offset="50%" style="stop-color:var(--d7)"/><stop offset="100%" style="stop-color:var(--d9)"/>
              </linearGradient></defs>
              <circle class="dial__track" cx="100" cy="100" r="88"/>
              <circle class="dial__val" cx="100" cy="100" r="88" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
            </svg>
            <div class="dial__mid"><span class="dial__num">${res.score}</span><span class="dial__cap">${esc(t('bond.score'))}</span></div>
          </div>
          <div class="dial-band"><h3>${esc(band.title)}</h3><p>${esc(band.body)}</p></div>
          <p class="dial-weights">${esc(t('bond.weights'))}</p>
        </section>
        <div style="display:grid;gap:14px">
          <section class="block">
            <header class="block__head"><div><h2>${esc(t('bond.aspectsTitle'))}</h2></div>
              <button class="btn btn--ghost btn--sm" type="button" data-number="${other.lifePath.value}">${esc(other.profile.name)} · ${esc(t('chart.lifePath'))} ${other.lifePath.value}</button>
            </header>
            <div class="aspects">${res.aspects.map(aspectRow).join('')}</div>
          </section>
          <div class="bond-edges">
            <div class="read-card" style="--hue:${hue(res.strongest.left)}"><h3>${esc(t('bond.strongest'))}</h3>
              <p>${esc(t('chart.core.' + res.strongest.key))} · ${res.strongest.left} × ${res.strongest.right} — ${res.strongest.score}/100</p></div>
            <div class="read-card" style="--hue:${hue(res.weakest.left)}"><h3>${esc(t('bond.weakest'))}</h3>
              <p>${esc(t('chart.core.' + res.weakest.key))} · ${res.weakest.left} × ${res.weakest.right} — ${res.weakest.score}/100</p></div>
          </div>
        </div>
      </div>`;
    observeReveals($('#bondResult'));
    if (!quiet) { sfx.reveal(); $('#bondResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }

  /* ---------------- atlas view ---------------- */
  function renderAtlas() {
    const c = chart();
    const q = fold(state.atlas.q.trim());
    let list = N.ALL_NUMBERS.slice();
    if (state.atlas.filter === 'single') list = list.filter((n) => n < 10);
    if (state.atlas.filter === 'master') list = list.filter((n) => n > 9);
    if (q) {
      list = list.filter((n) => {
        const info = num(n);
        return String(n).includes(q) || fold(info.title).includes(q) || fold(info.tag).includes(q) ||
          fold(info.keywords.join(' ')).includes(q) || fold(info.essence).includes(q);
      });
    }
    if (state.atlas.sort === 'alpha') list.sort((a, b) => num(a).title.localeCompare(num(b).title, lang === 'vi' ? 'vi' : 'en'));
    else list.sort((a, b) => a - b);

    $('#atlasCount').textContent = list.length === 1 ? t('atlas.resultsOne') : t('atlas.results', { n: list.length });
    const owned = {};
    if (c) c.core.forEach((k) => { (owned[k.value] = owned[k.value] || []).push(k.key); });

    $('#atlasGrid').innerHTML = list.length ? list.map((n) => {
      const info = num(n);
      const own = owned[n] || [];
      return `<button class="atlas-card reveal" type="button" data-number="${n}" style="--hue:${hue(n)}">
        <span class="atlas-card__top"><span class="atlas-card__n">${n}</span>
          ${n > 9 ? `<span class="badge">${esc(t('common.master'))}</span>` : ''}</span>
        <h3>${esc(info.title)}</h3>
        <span class="atlas-card__tag">${esc(info.tag)}</span>
        <p>${esc(info.essence)}</p>
        <span class="chips">${info.keywords.slice(0, 3).map((k) => `<span class="chip">${esc(k)}</span>`).join('')}</span>
        ${own.length ? `<span class="atlas-card__own">${own.map((k) => `<span>${esc(t('chart.core.' + k))}</span>`).join('')}</span>` : ''}
      </button>`;
    }).join('') : `<div class="atlas-empty">${esc(t('atlas.noResults', { q: state.atlas.q }))}</div>`;

    $('#atlasGrid').onclick = (e) => { const b = e.target.closest('[data-number]'); if (b) { sfx.tap(); openDrawer(Number(b.dataset.number)); } };

    const cols = {};
    Object.keys(N.LETTER_VALUES).forEach((L) => { const v = N.LETTER_VALUES[L]; (cols[v] = cols[v] || []).push(L); });
    $('#letterTable').innerHTML = N.DIGITS.map((d) => `<div class="lt-col" style="--hue:${hue(d)}">
      <span class="lt-col__n">${d}</span><span class="lt-col__l">${cols[d].join(' ')}</span></div>`).join('');

    $('#yExamples').innerHTML = t('atlas.yExamples').map((ex) => {
      const label = ex.verdict === 'both' ? `${t('toast.vowel')} + ${t('toast.consonant')}` : t('toast.' + ex.verdict);
      return `<div class="y-ex"><span class="y-ex__n">${esc(ex.name)}</span>
        <span class="y-ex__v" data-v="${esc(ex.verdict)}">${esc(label)}</span><p>${esc(ex.why)}</p></div>`;
    }).join('');
    observeReveals($('#viewAtlas'));
  }

  /* ---------------- drawer ---------------- */
  function openDrawer(n, tab) {
    state.drawer.n = n;
    if (tab) state.drawer.tab = tab;
    renderDrawer();
    openOverlay($('#drawer'));
  }

  function renderDrawer() {
    const n = state.drawer.n; const info = num(n); const c = chart();
    const drawer = $('#drawer');
    drawer.style.setProperty('--hue', hue(n));
    $('#drawerNum').textContent = n;
    $('#drawerTitle').textContent = info.title;
    $('#drawerTag').textContent = `${t('drawer.number', { n })} · ${info.tag}${n > 9 ? ' · ' + t('common.master') : ''}`;
    $$('#drawerTabs .seg__btn').forEach((b) => {
      const on = b.dataset.dtab === state.drawer.tab;
      b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on));
    });

    if (state.drawer.tab === 'meaning') {
      $('#drawerBody').innerHTML = `
        <div class="dsec"><p>${esc(info.essence)}</p></div>
        <div class="chips">${info.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join('')}</div>
        <div class="dsec"><h3>${esc(t('drawer.strengths'))}</h3><ul class="read-list">${info.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
        <div class="dsec"><h3>${esc(t('drawer.shadows'))}</h3><ul class="read-list read-list--shadow">${info.shadows.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
        <div class="dsec"><h3>${esc(t('drawer.love'))}</h3><p>${esc(info.love)}</p></div>
        <div class="dsec"><h3>${esc(t('drawer.work'))}</h3><p>${esc(info.work)}</p></div>
        <div class="dsec"><h3>${esc(t('drawer.asPinnacle'))}</h3><p>${esc(info.pinnacle)}</p></div>
        <div class="dsec"><h3>${esc(t('drawer.asChallenge'))}</h3><p>${esc(info.challenge)}</p></div>
        <div class="dsec"><h3>${esc(t('drawer.asCycle'))}</h3><p>${esc(info.cycle)}</p></div>`;
    } else {
      const hits = c ? c.core.filter((k) => k.value === n) : [];
      const pinHits = c ? c.pinnacles.filter((x) => x.value === n) : [];
      const chalHits = c ? c.challenges.filter((x) => x.value === n) : [];
      const perHits = c ? c.periods.filter((x) => x.value === n) : [];
      const p = activeProfile();
      const age = p ? N.ageOn({ year: p.year, month: p.month, day: p.day }) : 0;
      const pd = p ? N.personalDay(p.month, p.day, state.cycDate.y, state.cycDate.m, state.cycDate.d) : null;
      const cycHits = pd ? [pd.yearValue, pd.monthValue, pd.value].filter((v) => v === n) : [];
      let html = '';
      if (!c) html = `<p class="dnote">${esc(t('drawer.notInChart'))}</p>`;
      else if (!hits.length && !pinHits.length && !chalHits.length && !perHits.length && !cycHits.length) html = `<p class="dnote">${esc(t('drawer.notInChart'))}</p>`;
      else {
        html += `<div class="dsec"><h3>${esc(t('drawer.appearsIn'))}</h3><div class="dctx">`;
        hits.forEach((k) => { html += `<div class="dctx__row"><strong>${esc(t('drawer.contexts.' + k.key))}</strong><p>${esc(info.as[k.key])}</p></div>`; });
        pinHits.forEach((x) => { html += `<div class="dctx__row"><strong>${esc(t('timeline.pinnacleOrder')[x.index])} · ${x.endAge == null ? t('timeline.rangeOpen', { start: x.startAge }) : t('timeline.range', { start: x.startAge, end: x.endAge })}</strong><p>${esc(info.pinnacle)}</p></div>`; });
        chalHits.forEach((x) => { html += `<div class="dctx__row"><strong>${esc(t('timeline.challengeOrder')[x.index])}</strong><p>${esc(info.challenge)}</p></div>`; });
        perHits.forEach((x) => { html += `<div class="dctx__row"><strong>${esc(t('timeline.periodOrder')[x.index])}</strong><p>${esc(info.essence)}</p></div>`; });
        if (cycHits.length) html += `<div class="dctx__row"><strong>${esc(t('nav.cycles'))} · ${esc(fmtDate(state.cycDate))}</strong><p>${esc(info.cycle)}</p></div>`;
        html += '</div></div>';
        const activePin = N.currentPinnacle(c, age);
        if (activePin && activePin.value === n) html += `<p class="dnote" style="--hue:${hue(n)}">${esc(t('timeline.activeNow'))} — ${esc(t('timeline.yearsLeft', { n: activePin.endAge - age }))}</p>`;
      }
      $('#drawerBody').innerHTML = html;
    }
    $('#drawerBody').scrollTop = 0;
  }

  /* ---------------- journal ---------------- */
  function upsertProfile(data, activate) {
    const sig = signature(data);
    let found = state.profiles.find((x) => signature(x) === sig);
    if (found) {
      Object.assign(found, data, { id: found.id });
      if (data.currentName != null) found.currentName = data.currentName;
    } else {
      found = Object.assign({ id: uid(), createdAt: Date.now(), example: false, currentName: '' }, data);
      state.profiles.unshift(found);
    }
    if (activate) { state.activeId = found.id; chartCache = null; }
    return found;
  }

  function renderJournal() {
    const q = fold(state.journal.q.trim());
    let list = state.profiles.slice();
    if (q) list = list.filter((p) => fold(p.name).includes(q) || fold(p.note).includes(q) || fold(p.currentName).includes(q));
    if (state.journal.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, lang === 'vi' ? 'vi' : 'en'));
    else if (state.journal.sort === 'lifepath') list.sort((a, b) => N.lifePath(a.month, a.day, a.year).value - N.lifePath(b.month, b.day, b.year).value);
    else list.sort((a, b) => b.createdAt - a.createdAt);

    const host = $('#journalList');
    if (!list.length) {
      host.innerHTML = `<div class="journal__empty"><strong>${esc(q ? t('journal.noResults', { q: state.journal.q }) : t('journal.empty'))}</strong>
        <p>${esc(t('journal.emptyHint'))}</p></div>`;
    } else {
      host.innerHTML = list.map((p) => {
        const lp = N.lifePath(p.month, p.day, p.year).value;
        const checked = state.journal.selected.includes(p.id);
        return `<div class="jrow${p.id === state.activeId ? ' is-active' : ''}${checked ? ' is-checked' : ''}" style="--hue:${hue(lp)}" data-id="${esc(p.id)}">
          ${state.journal.selectMode ? `<button class="jcheck${checked ? ' is-on' : ''}" type="button" data-check="${esc(p.id)}" aria-pressed="${checked}" aria-label="${esc(p.name)}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-check"/></svg></button>` : ''}
          <span class="jrow__n">${lp}</span>
          <span class="jrow__t"><strong>${esc(p.name)}</strong><small>${p.day}/${p.month}/${p.year}${p.note ? ' · ' + esc(p.note) : ''}</small>
            <span class="jrow__tags">${p.example ? `<span class="badge">${esc(t('journal.example'))}</span>` : ''}${p.id === state.activeId ? `<span class="badge badge--now">${esc(t('journal.active'))}</span>` : ''}</span>
          </span>
          <span class="jrow__act">
            <button class="icon-btn" type="button" data-open="${esc(p.id)}" aria-label="${esc(t('journal.openChart'))}" data-tip="${esc(t('journal.openChart'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-right"/></svg></button>
            <button class="icon-btn" type="button" data-edit="${esc(p.id)}" aria-label="${esc(t('journal.editChart'))}" data-tip="${esc(t('journal.editChart'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-edit"/></svg></button>
            <button class="icon-btn" type="button" data-del="${esc(p.id)}" aria-label="${esc(t('journal.deleteChart'))}" data-tip="${esc(t('journal.deleteChart'))}"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-trash"/></svg></button>
          </span>
        </div>`;
      }).join('');
    }
    $('#journalBulk').hidden = !state.journal.selectMode;
    $('#journalBulkCount').textContent = t('journal.selected', { n: state.journal.selected.length });
    $('#journalSelect').setAttribute('aria-pressed', String(state.journal.selectMode));
    $('#journalDeleteSel').disabled = !state.journal.selected.length;
  }

  function deleteProfiles(ids) {
    const removed = state.profiles.filter((p) => ids.includes(p.id));
    if (!removed.length) return;
    const wasActive = ids.includes(state.activeId);
    state.profiles = state.profiles.filter((p) => !ids.includes(p.id));
    ids.forEach((id) => { delete state.overrides[id]; });
    state.journal.selected = state.journal.selected.filter((id) => !ids.includes(id));
    if (wasActive) { state.activeId = state.profiles[0] ? state.profiles[0].id : null; chartCache = null; }
    persist(); renderJournal(); renderChrome(); renderView();
    sfx.remove();
    const label = removed.length === 1 ? t('journal.deleted', { name: removed[0].name }) : t('journal.deletedMany', { n: removed.length });
    toast(label, {
      icon: 'i-trash', tone: 'var(--danger)', action: t('common.undo'),
      onAction() {
        state.profiles = state.profiles.concat(removed);
        if (wasActive) { state.activeId = removed[0].id; chartCache = null; }
        persist(); renderJournal(); renderChrome(); renderView();
        toast(removed.length === 1 ? t('journal.restored', { name: removed[0].name }) : t('journal.restoredMany', { n: removed.length }), { icon: 'i-undo' });
      },
    });
  }

  /* ---------------- profile modal ---------------- */
  let profileDateField = null;
  let editingId = null;
  function openProfileModal(id) {
    editingId = id || null;
    const p = editingId ? state.profiles.find((x) => x.id === editingId) : null;
    $('#profileModalTitle').textContent = p ? t('form.editTitle') : t('form.title');
    $('#profileSubmit').querySelector('span').textContent = p ? t('form.submitEdit') : t('form.submit');
    $('#pName').value = p ? p.name : '';
    $('#pCurrent').value = p ? (p.currentName || '') : '';
    $$('#profileForm .field').forEach((f) => f.classList.remove('is-bad'));
    $('#pNameErr').hidden = true; $('#pDateErr').hidden = true;
    profileDateField = createDateField($('#pDate'), {
      value: p ? { y: p.year, m: p.month, d: p.day } : null, max: new Date(),
      onChange() { $('#pDateErr').hidden = true; $('#pDate').closest('.field').classList.remove('is-bad'); },
    });
    openOverlay($('#profileModal'));
    window.setTimeout(() => $('#pName').focus(), 60);
  }

  function submitProfile(e) {
    e.preventDefault();
    const name = N.normalizeName($('#pName').value);
    const currentName = N.normalizeName($('#pCurrent').value);
    const date = profileDateField ? profileDateField.get() : null;
    let bad = false;
    const letters = N.stripDiacritics(name).replace(/[^a-zA-Z]/g, '');
    const nameField = $('#pName').closest('.field');
    const dateField = $('#pDate').closest('.field');
    nameField.classList.remove('is-bad'); dateField.classList.remove('is-bad');
    $('#pNameErr').hidden = true; $('#pDateErr').hidden = true;

    if (!name) { $('#pNameErr').textContent = t('validation.nameRequired'); $('#pNameErr').hidden = false; nameField.classList.add('is-bad'); bad = true; }
    else if (letters.length < 2) { $('#pNameErr').textContent = t('validation.nameLetters'); $('#pNameErr').hidden = false; nameField.classList.add('is-bad'); bad = true; }
    if (!date) { $('#pDateErr').textContent = t('validation.dateRequired'); $('#pDateErr').hidden = false; dateField.classList.add('is-bad'); bad = true; }
    else if (!N.isValidDate(date.y, date.m, date.d)) { $('#pDateErr').textContent = t('validation.dateInvalid'); $('#pDateErr').hidden = false; dateField.classList.add('is-bad'); bad = true; }
    else if (asDate(date) > new Date()) { $('#pDateErr').textContent = t('validation.dateFuture'); $('#pDateErr').hidden = false; dateField.classList.add('is-bad'); bad = true; }
    if (bad) { sfx.remove(); toast(t('validation.fixFields'), { icon: 'i-info', tone: 'var(--danger)' }); return; }

    const existing = editingId ? state.profiles.find((x) => x.id === editingId) : null;
    let profile;
    if (existing) {
      const nameChanged = N.normalizeName(existing.name).toLowerCase() !== name.toLowerCase();
      Object.assign(existing, { name, currentName, month: date.m, day: date.d, year: date.y, example: false });
      if (nameChanged) { delete state.overrides[existing.id]; existing.note = ''; }
      profile = existing;
      state.activeId = profile.id;
      toast(t('toast.profileUpdated'), { icon: 'i-check' });
    } else {
      profile = upsertProfile({ name, currentName, month: date.m, day: date.d, year: date.y, example: false }, true);
      state.banner = false;
      toast(t('toast.profileSet', { name: profile.name }), { icon: 'i-spark' });
    }
    chartCache = null;
    state.cycDate = todayObj();
    persist();
    closeOverlay($('#profileModal'));
    goto('chart', true);
    renderChrome();
    sfx.reveal();
    const hero = $('#heroNum');
    if (hero) { hero.animate([{ transform: 'scale(0.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(0.16,1,0.3,1)' }); }
  }

  /* ---------------- export ---------------- */
  function summaryText() {
    const p = activeProfile(); const c = chart();
    if (!p || !c) return '';
    const L = [];
    L.push(t('export.summaryHead'));
    L.push(`${t('export.summaryName')}: ${p.name}`);
    if (p.currentName) L.push(`${t('chart.nameShiftCurrent')}: ${p.currentName}`);
    L.push(`${t('export.summaryBirth')}: ${fmtDate({ y: p.year, m: p.month, d: p.day }, 'long')}`);
    L.push('');
    L.push(t('export.summaryCore').toUpperCase());
    c.core.forEach((k) => L.push(`  ${t('chart.core.' + k.key)}: ${k.value} — ${num(k.value).title}`));
    L.push('');
    L.push(t('export.summaryLedger').toUpperCase());
    L.push(`  ${t('chart.totalsVowels')}: ${c.name.vowels.map((l) => l.char).join('')} = ${c.name.vowelTotal} → ${c.soul.reduced}`);
    L.push(`  ${t('chart.totalsConsonants')}: ${c.name.consonants.map((l) => l.char).join('')} = ${c.name.consonantTotal} → ${c.personality.reduced}`);
    L.push(`  ${t('chart.yRuleTitle')}: ${t('chart.yRuleBody')}`);
    L.push('');
    L.push(t('export.summaryPinnacles').toUpperCase());
    c.pinnacles.forEach((x, i) => L.push(`  ${t('timeline.pinnacleOrder')[i]}: ${x.formula.join(' ')} = ${x.value} (${x.endAge == null ? t('timeline.rangeOpen', { start: x.startAge }) : t('timeline.range', { start: x.startAge, end: x.endAge })})`));
    L.push('');
    L.push(t('export.summaryChallenges').toUpperCase());
    c.challenges.forEach((x, i) => L.push(`  ${t('timeline.challengeOrder')[i]}: ${x.formula.join(' ')} = ${x.value}`));
    const sel = state.cycDate;
    const pd = N.personalDay(p.month, p.day, sel.y, sel.m, sel.d);
    L.push('');
    L.push(`${t('export.summaryCycles').toUpperCase()} (${fmtDate(sel, 'long')})`);
    L.push(`  ${t('cycles.personalYear')}: ${pd.yearValue} · ${t('cycles.personalMonth')}: ${pd.monthValue} · ${t('cycles.personalDay')}: ${pd.value}`);
    L.push('');
    L.push(num(c.lifePath.value).essence);
    return L.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  function shareLink() {
    const p = activeProfile(); if (!p) return '';
    const payload = { n: p.name, c: p.currentName || '', m: p.month, d: p.day, y: p.year };
    const base = location.href.split('#')[0];
    return `${base}#c=${encodeURIComponent(JSON.stringify(payload))}`;
  }

  function buildPrintSheet() {
    const p = activeProfile(); const c = chart();
    if (!p || !c) return false;
    const rows = c.core.map((k) => `<tr><td>${esc(t('chart.core.' + k.key))}</td><td><b>${k.value}</b></td><td>${esc(num(k.value).title)}</td><td>${esc(t('chart.coreHow.' + k.key))}</td></tr>`).join('');
    const pin = c.pinnacles.map((x, i) => `<tr><td>${esc(t('timeline.pinnacleOrder')[i])}</td><td>${x.value}</td><td>${esc(x.formula.join(' '))}</td><td>${x.endAge == null ? t('timeline.rangeOpen', { start: x.startAge }) : t('timeline.range', { start: x.startAge, end: x.endAge })}</td></tr>`).join('');
    const chal = c.challenges.map((x, i) => `<tr><td>${esc(t('timeline.challengeOrder')[i])}</td><td>${x.value}</td><td>${esc(x.formula.join(' '))}</td></tr>`).join('');
    $('#printSheet').innerHTML = `
      <h1>${esc(p.name)}</h1>
      <p class="ps-meta">${esc(t('export.summaryBirth'))}: ${esc(fmtDate({ y: p.year, m: p.month, d: p.day }, 'long'))}${p.currentName ? ' · ' + esc(t('chart.nameShiftCurrent')) + ': ' + esc(p.currentName) : ''}</p>
      <h2>${esc(t('export.summaryCore'))}</h2>
      <table><tbody>${rows}</tbody></table>
      <h2>${esc(t('chart.readingTitle'))}</h2>
      <p>${esc(num(c.lifePath.value).essence)}</p>
      <p>${esc(num(c.lifePath.value).love)}</p>
      <p>${esc(num(c.lifePath.value).work)}</p>
      <h2>${esc(t('export.summaryLedger'))}</h2>
      <p>${esc(t('chart.totalsVowels'))}: ${esc(c.name.vowels.map((l) => l.char).join(' '))} = ${c.name.vowelTotal} → ${c.soul.reduced}<br/>
      ${esc(t('chart.totalsConsonants'))}: ${esc(c.name.consonants.map((l) => l.char).join(' '))} = ${c.name.consonantTotal} → ${c.personality.reduced}</p>
      <p>${esc(t('chart.yRuleBody'))}</p>
      <h2>${esc(t('export.summaryPinnacles'))}</h2><table><tbody>${pin}</tbody></table>
      <h2>${esc(t('export.summaryChallenges'))}</h2><table><tbody>${chal}</tbody></table>
      <p class="ps-meta">${esc(t('footer.note'))}</p>`;
    return true;
  }

  function doExport(kind) {
    toggleExport(false);
    const p = activeProfile();
    if (!p) { openProfileModal(); return; }
    if (kind === 'copy') {
      copyText(summaryText()).then((ok) => toast(ok ? t('export.copied') : t('export.failed'), { icon: ok ? 'i-copy' : 'i-info', tone: ok ? 'var(--brass)' : 'var(--warn)' }));
    } else if (kind === 'link') {
      copyText(shareLink()).then((ok) => toast(ok ? t('export.linkCopied') : t('export.failed'), { icon: ok ? 'i-link' : 'i-info', tone: ok ? 'var(--brass)' : 'var(--warn)' }));
    } else if (kind === 'download') {
      const blob = new Blob([summaryText()], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `numeros-${N.stripDiacritics(p.name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast(t('export.downloaded'), { icon: 'i-download' });
    } else if (kind === 'print') {
      if (buildPrintSheet()) { toast(t('export.printReady'), { icon: 'i-print' }); window.setTimeout(() => window.print(), 220); }
    }
    sfx.tap();
  }

  function toggleExport(force) {
    const menu = $('#exportMenu'); const btn = $('#exportBtn');
    const open = force == null ? menu.hidden : force;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  /* ---------------- language / theme ---------------- */
  function setLanguage(next) {
    lang = next === 'vi' ? 'vi' : 'en';
    applyStaticI18n(); buildNav(); renderChrome(); renderView();
    if (!$('#journal').hidden) renderJournal();
    if (!$('#drawer').hidden) renderDrawer();
    if (!$('#profileModal').hidden) {
      const v = profileDateField ? profileDateField.get() : null;
      profileDateField = createDateField($('#pDate'), { value: v, max: new Date(), onChange() {} });
    }
    persist();
  }
  function setTheme(next) {
    state.theme = next;
    document.documentElement.dataset.theme = next;
    persist(); renderChrome();
    toast(next === 'obsidian' ? t('toast.themeDark') : t('toast.themeLight'), { icon: next === 'obsidian' ? 'i-moon' : 'i-sun' });
  }

  /* ---------------- share link intake ---------------- */
  function readShareLink() {
    const m = location.hash.match(/^#c=(.+)$/);
    if (!m) return false;
    try {
      const data = JSON.parse(decodeURIComponent(m[1]));
      if (!data || !data.n || !N.isValidDate(data.y, data.m, data.d)) return false;
      const p = upsertProfile({ name: N.normalizeName(data.n), currentName: N.normalizeName(data.c || ''), month: data.m, day: data.d, year: data.y, example: false }, true);
      state.banner = false; chartCache = null; persist();
      toast(t('toast.linkLoaded'), { icon: 'i-link' });
      return p;
    } catch (e) { return false; }
  }

  /* ---------------- events ---------------- */
  function wire() {
    document.addEventListener('click', (e) => {
      const gotoBtn = e.target.closest('[data-goto]');
      if (gotoBtn) { goto(gotoBtn.dataset.goto); return; }
      const ex = e.target.closest('[data-example]');
      if (ex) {
        const list = t('examples'); const item = list[Number(ex.dataset.example)];
        if (!item) return;
        const found = state.profiles.find((p) => p.name === item.name && p.year === item.year);
        state.activeId = found ? found.id : upsertProfile({ name: item.name, month: item.month, day: item.day, year: item.year, note: item.note, example: true }, true).id;
        state.banner = true; chartCache = null; persist();
        goto('chart', true); renderChrome(); sfx.reveal();
        toast(t('toast.exampleLoaded'), { icon: 'i-spark' });
        return;
      }
      if (!e.target.closest('.menu-wrap')) toggleExport(false);
      if (!e.target.closest('#cycCal') && !e.target.closest('#cycDateBtn') && !$('#cycCal').hidden) {
        $('#cycCal').hidden = true; $('#cycCal').innerHTML = ''; cycCal = null;
      }
    });

    $('#profileChip').addEventListener('click', () => openProfileModal(state.activeId));
    $('#emptyStart').addEventListener('click', () => openProfileModal());
    $('#bannerAction').addEventListener('click', () => openProfileModal());
    $('#bannerDismiss').addEventListener('click', () => { state.banner = false; persist(); renderChrome(); });
    $('#profileClose').addEventListener('click', () => closeOverlay($('#profileModal')));
    $('#profileCancel').addEventListener('click', () => closeOverlay($('#profileModal')));
    $('#profileForm').addEventListener('submit', submitProfile);
    $('#pName').addEventListener('input', () => { $('#pNameErr').hidden = true; $('#pName').closest('.field').classList.remove('is-bad'); });

    $('#scrim').addEventListener('click', closeTop);
    $('#drawerClose').addEventListener('click', () => closeOverlay($('#drawer')));
    $('#drawerTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dtab]'); if (!b) return;
      state.drawer.tab = b.dataset.dtab; renderDrawer(); sfx.tap();
    });

    $('#journalBtn').addEventListener('click', () => { renderJournal(); openOverlay($('#journal')); });
    $('#journalClose').addEventListener('click', () => closeOverlay($('#journal')));
    $('#journalAdd').addEventListener('click', () => {
      closeOverlay($('#journal'));
      openProfileModal();
    });
    $('#journalSearch').addEventListener('input', (e) => { state.journal.q = e.target.value; renderJournal(); });
    $('#journalSort').addEventListener('change', (e) => { state.journal.sort = e.target.value; renderJournal(); });
    $('#journalSelect').addEventListener('click', () => {
      state.journal.selectMode = !state.journal.selectMode;
      state.journal.selected = [];
      renderJournal(); sfx.tap();
    });
    $('#journalSelectAll').addEventListener('click', () => {
      state.journal.selected = state.journal.selected.length === state.profiles.length ? [] : state.profiles.map((p) => p.id);
      renderJournal();
    });
    $('#journalDeleteSel').addEventListener('click', () => deleteProfiles(state.journal.selected.slice()));
    $('#journalList').addEventListener('click', (e) => {
      const check = e.target.closest('[data-check]');
      if (check) {
        const id = check.dataset.check;
        const i = state.journal.selected.indexOf(id);
        if (i >= 0) state.journal.selected.splice(i, 1); else state.journal.selected.push(id);
        renderJournal(); sfx.tap(); return;
      }
      const open = e.target.closest('[data-open]');
      if (open) {
        state.activeId = open.dataset.open; chartCache = null; state.banner = Boolean(activeProfile() && activeProfile().example);
        persist(); closeOverlay($('#journal')); goto('chart', true); renderChrome(); sfx.reveal(); return;
      }
      const edit = e.target.closest('[data-edit]');
      if (edit) { closeOverlay($('#journal')); openProfileModal(edit.dataset.edit); return; }
      const del = e.target.closest('[data-del]');
      if (del) { deleteProfiles([del.dataset.del]); return; }
      const row = e.target.closest('.jrow');
      if (row && !state.journal.selectMode) {
        state.activeId = row.dataset.id; chartCache = null; state.banner = Boolean(activeProfile() && activeProfile().example);
        persist(); closeOverlay($('#journal')); goto('chart', true); renderChrome(); sfx.reveal();
      }
    });

    $('#langSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b && b.dataset.lang !== lang) { setLanguage(b.dataset.lang); sfx.tap(); } });
    $('#themeBtn').addEventListener('click', () => { setTheme(state.theme === 'obsidian' ? 'parchment' : 'obsidian'); sfx.tap(); });
    $('#soundBtn').addEventListener('click', () => {
      state.sound = !state.sound; persist(); renderChrome();
      if (state.sound) sfx.tap();
      toast(state.sound ? t('toast.soundOn') : t('toast.soundOff'), { icon: state.sound ? 'i-sound-on' : 'i-sound-off' });
    });
    $('#exportBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleExport(); sfx.tap(); });
    $('#exportMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-export]'); if (b) doExport(b.dataset.export); });

    $('#ledgerFilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]'); if (!b) return;
      state.ledgerFilter = b.dataset.filter;
      $$('#ledgerFilter .seg__btn').forEach((x) => x.classList.toggle('is-on', x === b));
      renderLedger(chart()); sfx.tap();
    });
    $('#arithToggle').addEventListener('click', () => {
      state.arithOpen = !state.arithOpen; renderReading(chart()); sfx.tap();
      if (state.arithOpen) observeReveals($('#arithmetic'));
    });

    $('#cycPrev').addEventListener('click', () => { state.cycDate = shiftDays(state.cycDate, -1); renderCycles(); renderChrome(); sfx.tap(); });
    $('#cycNext').addEventListener('click', () => { state.cycDate = shiftDays(state.cycDate, 1); renderCycles(); renderChrome(); sfx.tap(); });
    $('#cycToday').addEventListener('click', () => { state.cycDate = todayObj(); renderCycles(); renderChrome(); sfx.tap(); });
    $('#cycDateBtn').addEventListener('click', () => { toggleCycCal(); sfx.tap(); });

    $('#atlasSearch').addEventListener('input', (e) => { state.atlas.q = e.target.value; renderAtlas(); });
    $('#atlasFilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]'); if (!b) return;
      state.atlas.filter = b.dataset.filter;
      $$('#atlasFilter .seg__btn').forEach((x) => x.classList.toggle('is-on', x === b));
      renderAtlas(); sfx.tap();
    });
    $('#atlasSort').addEventListener('change', (e) => { state.atlas.sort = e.target.value; renderAtlas(); });

    window.addEventListener('hashchange', () => { if (readShareLink()) { goto('chart', true); renderChrome(); } });
    window.addEventListener('beforeprint', buildPrintSheet);
  }

  /* ---------------- init ---------------- */
  function init() {
    restore();
    document.documentElement.dataset.theme = state.theme;
    applyStaticI18n();
    buildNav();
    readShareLink();
    wire();
    initSky();
    goto(state.view, true);
    renderChrome();
    observeReveals(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();