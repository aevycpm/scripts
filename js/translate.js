/* ==========================================================================
   Aevy — whole-page translation
   The language picker (js/locale.js) used to translate only the 7 menu words in js/i18n.js.
   This module translates EVERYTHING on the page, including cards, buttons, posts and text that
   JavaScript draws later, using Google's free website translation engine.
   - Reacts to the picker (event "rcpm:localechange") and to the saved choice on every page load.
   - Picking English again restores the original text (one reload).
   - Names, usernames, file names, code and the brand are never translated (translate="no").
   The language picker itself and every [data-i18n] element are marked translate="no": the picker must keep
   showing native names (Español, বাংলা ...) and the data-i18n nav words are already set by js/i18n.js, so letting
   Google translate them a second time garbles them.
   If the engine cannot load (blocked network), the page falls back to the nav dictionary in js/i18n.js.
   ========================================================================== */
(function () {
  'use strict';
  var KEY = 'rcpm_locale_v1', loaded = false;
  var MAP = { 'en-GB': 'en', 'es-MX': 'es', 'pt-BR': 'pt', 'zh-CN': 'zh-CN' };

  function target(code) { code = code || 'en'; return MAP[code] || code.split('-')[0]; }
  function saved() { try { return JSON.parse(localStorage.getItem(KEY)).langCode; } catch (e) { return 'en'; } }
  function active() { return /(?:^|;\s*)googtrans=\/en\/(?!en(?:;|$))[^;]+/.test(document.cookie); }
  function setCookie(v) {
    var gone = v ? '' : ';expires=Thu, 01 Jan 1970 00:00:00 GMT', val = 'googtrans=' + (v || '') + ';path=/' + gone;
    document.cookie = val; document.cookie = val + ';domain=' + location.hostname;
  }
  function combo() { return document.querySelector('select.goog-te-combo'); }

  function load(done) {
    if (loaded) { done(); return; }
    loaded = true;
    var d = document.createElement('div'); d.id = 'aevy-gt'; d.className = 'notranslate'; d.setAttribute('translate', 'no'); document.body.appendChild(d);
    window.googleTranslateElementInit = function () {
      try { new window.google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'aevy-gt'); } catch (e) {}
      done();
    };
    var s = document.createElement('script'); s.async = true; s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.onerror = function () { setCookie(''); };   /* engine blocked: stay in English, do not keep a dead cookie */
    document.head.appendChild(s);
  }

  function set(lang) {
    var t = target(lang);
    if (t === 'en') { if (active()) { setCookie(''); location.reload(); } return; }
    setCookie('/en/' + t);
    load(function () {
      var n = 0, iv = setInterval(function () {
        var c = combo();
        if (c) { clearInterval(iv); if (c.value !== t) { c.value = t; c.dispatchEvent(new Event('change')); } }
        else if (++n > 50) clearInterval(iv);
      }, 100);
    });
  }

  /* things that must stay exactly as written */
  var KEEP = '.rcpm-locale, [data-i18n], .brand, .rc-who small, .pf-name .pf-nm, .pf-handle, .fd-file b, .fd-title, .fd-hname, .rc-code, code, pre, .fd-file__ico, .fd-ver, .rc-av';
  var queued = false;
  function mark() {
    queued = false;
    document.querySelectorAll(KEEP).forEach(function (n) { if (n.getAttribute('translate') !== 'no') n.setAttribute('translate', 'no'); });
  }
  function watch() {
    mark();
    new MutationObserver(function () { if (!queued) { queued = true; setTimeout(mark, 150); } }).observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    watch();
    var l = saved(); if (target(l) !== 'en') set(l);
    document.addEventListener('rcpm:localechange', function (e) { set(e.detail && e.detail.langCode); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.AevyTranslate = { set: set };
})();
