/* ==========================================================================
   Aevy — Header v2 behaviour
   - Menu drawer, Settings sheet and expanding search (one open at a time)
   - Hide on scroll down / reveal on scroll up, scroll-progress hairline
   - Theme (light / dark / system) and "reduce animations" preference
   - Account block in the menu (guest buttons or signed-in links)
   Everything is optional: if a piece of markup is missing it is skipped.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var THEME_KEY = 'aevy_theme';
  var MOTION_KEY = 'aevy_motion';
  var mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  var mqPhone = window.matchMedia ? window.matchMedia('(max-width: 640px)') : { matches: false };

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function store(key, val) { try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (e) { /* private mode */ } }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------------------------------------------------------------- Theme */
  function resolveTheme(pref) { return (pref === 'dark' || (pref === 'system' && mqDark.matches)) ? 'dark' : 'light'; }

  function applyTheme(pref, animate) {
    if (animate) {
      root.classList.add('theme-anim');
      setTimeout(function () { root.classList.remove('theme-anim'); }, 450);
    }
    var theme = resolveTheme(pref);
    root.setAttribute('data-theme', theme);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B0E14' : '#2563EB');
    var seg = $('.hdr-seg');
    if (seg) {
      var order = ['light', 'dark', 'system'];
      seg.style.setProperty('--seg', Math.max(0, order.indexOf(pref)));
      $$('[data-theme-set]', seg).forEach(function (b) {
        b.setAttribute('aria-checked', b.getAttribute('data-theme-set') === pref ? 'true' : 'false');
      });
    }
  }

  function themePref() { var p = read(THEME_KEY); return (p === 'light' || p === 'dark') ? p : 'system'; }

  /* ---------------------------------------------------------------- Motion */
  function motionReduced() {
    var m = read(MOTION_KEY);
    if (m === 'reduced') return true;
    if (m === 'full') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function applyMotion() {
    var reduced = motionReduced();
    if (reduced) root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion');
    var box = $('[data-motion-toggle]');
    if (box) box.checked = reduced;
  }

  function init() {
    var header = document.getElementById('aevy-header');
    if (!header) return;

    var scrim = $('.hdr-scrim');
    var panels = { menu: $('#hdr-menu'), settings: $('#hdr-settings'), search: $('#hdr-search') };
    var buttons = {};
    $$('[data-hdr-toggle]').forEach(function (b) { buttons[b.getAttribute('data-hdr-toggle')] = b; });

    var current = null;
    var lastFocus = null;
    var settleTimer = null;
    var locked = false;

    /* panels start closed and unreachable by keyboard */
    Object.keys(panels).forEach(function (k) { if (panels[k]) panels[k].inert = true; });

    /* ---------------------------------------------------------- Scroll lock */
    function lock() {
      if (locked) return;
      var sw = window.innerWidth - root.clientWidth;
      root.classList.add('hdr-lock');
      if (sw > 0) document.body.style.paddingRight = sw + 'px';   /* keeps the page from jumping when the scrollbar disappears */
      locked = true;
    }
    function unlock() {
      if (!locked) return;
      root.classList.remove('hdr-lock');
      document.body.style.paddingRight = '';
      locked = false;
    }

    /* ---------------------------------------------------------- Open / close */
    function focusables(p) {
      return $$('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])', p)
        .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
    }

    function open(name) {
      var p = panels[name];
      if (!p || current === name) return;
      if (current) close(true);
      current = name;
      lastFocus = document.activeElement;
      showHeader();
      if (buttons[name]) buttons[name].setAttribute('aria-expanded', 'true');
      p.inert = false;
      p.setAttribute('aria-hidden', 'false');

      if (name === 'search') {
        p.classList.add('open');
        clearTimeout(settleTimer);
        settleTimer = setTimeout(function () { p.classList.add('settled'); }, 420);   /* lets suggestions overflow once the bar is fully open */
        var input = $('input', p);
        if (input) setTimeout(function () { if (current === 'search') input.focus({ preventScroll: true }); }, 80);   /* skip if it was already closed again */
        return;
      }

      void p.offsetWidth;                       /* commit the closed state so the transition runs */
      p.classList.add('open');
      if (scrim) scrim.classList.add('show');
      if (name === 'menu' || mqPhone.matches) lock();
      setTimeout(function () { if (current === name) { p.setAttribute('tabindex', '-1'); p.focus({ preventScroll: true }); } }, 60);

      /* first visit: a language suggestion is waiting, so unfold the list for the person */
      if (name === 'settings' && root.classList.contains('has-locale-hint')) {
        setTimeout(function () {
          var t = $('.rcpm-locale__trigger', p);
          if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
        }, 320);
      }
    }

    function close(silent) {
      if (!current) return;
      var name = current;
      var p = panels[name];
      current = null;
      if (buttons[name]) buttons[name].setAttribute('aria-expanded', 'false');
      if (p) {
        p.classList.remove('open');
        p.setAttribute('aria-hidden', 'true');
        p.inert = true;
        if (name === 'search') { clearTimeout(settleTimer); p.classList.remove('settled'); }
      }
      if (name !== 'search' && scrim) scrim.classList.remove('show');
      unlock();
      if (!silent && lastFocus && lastFocus.focus && document.contains(lastFocus)) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }

    function toggle(name) { if (current === name) close(); else open(name); }

    $$('[data-hdr-toggle]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); toggle(b.getAttribute('data-hdr-toggle')); });
    });
    /* other parts of the page (e.g. the footer) can ask for a panel */
    document.addEventListener('aevy:open', function (e) { if (e.detail && panels[e.detail]) open(e.detail); });
    $$('[data-hdr-close]').forEach(function (el) { el.addEventListener('click', function () { close(); }); });

    /* links inside the menu: close first so hash links (#main etc.) feel instant */
    if (panels.menu) {
      panels.menu.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a[href]') : null;
        if (a && (a.getAttribute('href') || '').charAt(0) === '#') close(true);
      });
    }

    /* tap outside the search bar closes it */
    document.addEventListener('pointerdown', function (e) {
      if (current === 'search' && !header.contains(e.target)) close(true);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && current) { e.preventDefault(); close(); return; }

      if (e.key === 'Tab' && current && current !== 'search') {
        var list = focusables(panels[current]);
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panels[current])) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }

      var t = e.target || {};
      var typing = /^(input|textarea|select)$/i.test(t.tagName || '') || t.isContentEditable;
      if (((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) || ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k')) {
        if (!panels.search) return;
        e.preventDefault();
        toggle('search');
      }
    });

    window.addEventListener('pageshow', function (ev) { if (ev.persisted) close(true); });
    window.addEventListener('resize', function () {
      if (current === 'settings') { if (mqPhone.matches) lock(); else unlock(); }
    });

    /* ---------------------------------------------------------- Hide on scroll */
    var hidden = false, ticking = false, lastY = window.pageYOffset || 0, dir = 0, anchor = lastY;

    function showHeader() { if (hidden) { header.classList.remove('is-hidden'); hidden = false; } }
    function hideHeader() {
      if (hidden || current) return;
      if (header.contains(document.activeElement) && /^(input|textarea)$/i.test(document.activeElement.tagName)) return;
      header.classList.add('is-hidden'); hidden = true;
    }

    function onScroll() {
      ticking = false;
      var y = Math.max(0, window.pageYOffset || root.scrollTop || 0);
      var max = root.scrollHeight - window.innerHeight;
      header.classList.toggle('is-scrolled', y > 8);
      header.style.setProperty('--scroll-p', max > 0 ? Math.min(1, y / max).toFixed(3) : '0');

      if (current || y < 90) { showHeader(); lastY = y; anchor = y; return; }
      if (y > lastY) {                                  /* moving down */
        if (dir !== 1) { dir = 1; anchor = y; }
        if (y - anchor > 28) hideHeader();
      } else if (y < lastY) {                           /* moving up */
        if (dir !== -1) { dir = -1; anchor = y; }
        if (anchor - y > 14) showHeader();
      }
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    /* bring it back on keyboard focus or when the pointer touches the top edge */
    header.addEventListener('focusin', showHeader);
    document.addEventListener('mousemove', function (e) { if (e.clientY < 14) showHeader(); }, { passive: true });

    /* ---------------------------------------------------------- Theme + motion controls */
    applyTheme(themePref(), false);
    $$('[data-theme-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pref = b.getAttribute('data-theme-set');
        store(THEME_KEY, pref === 'system' ? null : pref);
        applyTheme(pref, true);
      });
    });
    var onSys = function () { if (themePref() === 'system') applyTheme('system', true); };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onSys); else if (mqDark.addListener) mqDark.addListener(onSys);

    applyMotion();
    var box = $('[data-motion-toggle]');
    if (box) box.addEventListener('change', function () { store(MOTION_KEY, box.checked ? 'reduced' : 'full'); applyMotion(); });

    /* keep several open tabs in step */
    window.addEventListener('storage', function (e) {
      if (e.key === THEME_KEY) applyTheme(themePref(), true);
      if (e.key === MOTION_KEY) applyMotion();
    });

    /* ---------------------------------------------------------- Account block in the menu */
    var host = $('[data-hdr-account]');
    var guestHTML = host ? host.innerHTML : '';
    var ICONS = {
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
      out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>'
    };

    function renderAccount() {
      if (!host) return;
      var A = window.RowanAuth;
      var u = A && A.getCurrentUser ? A.getCurrentUser() : null;
      if (!u) { host.innerHTML = guestHTML; return; }
      var shown = u.name || u.username || 'Account';
      var init = String(shown).trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || '?';
      var img = /^https:\/\//i.test(u.avatar || '') ? u.avatar : '';
      host.innerHTML =
        '<div class="hdr-me"><span class="hdr-me__av">' + (img ? '<img src="' + esc(img) + '" alt="">' : esc(init)) + '</span>' +
        '<span class="hdr-me__t"><b>' + esc(shown) + '</b>' + (u.username ? '<small>@' + esc(u.username) + '</small>' : '') + '</span></div>' +
        '<div class="hdr-list">' +
        '<a class="hdr-row" href="profile.html">' + ICONS.user + '<span>My Profile</span></a>' +
        '<a class="hdr-row" href="profile.html#downloads">' + ICONS.dl + '<span>My Downloads</span></a>' +
        '<button type="button" class="hdr-row hdr-row--danger" data-hdr-logout>' + ICONS.out + '<span>Log out</span></button>' +
        '</div>';
      var out = $('[data-hdr-logout]', host);
      if (out) out.addEventListener('click', function () {
        var p = A.logout ? A.logout() : null;
        Promise.resolve(p).then(function () { window.location.href = 'index.html'; });
      });
    }
    if (window.RowanAuth && window.RowanAuth.ready && window.RowanAuth.ready.then) window.RowanAuth.ready.then(renderAccount, renderAccount);
    window.addEventListener('rowan:auth', renderAccount);
  }

  /* run the theme as early as possible, even before the DOM is ready (the inline <head> snippet already did the first pass) */
  applyTheme(themePref(), false);
  applyMotion();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
