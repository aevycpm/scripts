/* ==========================================================================
   Aevy — Footer v2 behaviour
   - Fade/rise reveal when the footer scrolls into view (armed only when JS runs)
   - Back-to-top, "Settings" chip (opens the header's Settings panel), live year
   - Flags <html data-authed> so the call-to-action matches signed-in/out state
   ========================================================================== */
(function () {
  'use strict';

  function init() {
    var footer = document.querySelector('.ftr');
    if (!footer) return;

    /* year */
    var yr = footer.querySelector('[data-year]');
    if (yr) yr.textContent = String(new Date().getFullYear());

    /* reveal */
    var items = footer.querySelectorAll('[data-rv]');
    items.forEach(function (el, i) { el.style.setProperty('--d', String(i)); });
    if ('IntersectionObserver' in window) {
      footer.classList.add('is-armed');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { footer.classList.add('in'); io.disconnect(); }
        });
      }, { threshold: 0.08 });
      io.observe(footer);
    }

    /* back to top */
    var top = footer.querySelector('[data-ftr-top]');
    if (top) top.addEventListener('click', function () {
      var calm = document.documentElement.getAttribute('data-motion') === 'reduced';
      window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
    });

    /* settings chip → header.js opens the panel */
    var st = footer.querySelector('[data-ftr-settings]');
    if (st) st.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('aevy:open', { detail: 'settings' }));
    });

    /* signed-in state */
    function paintAuth() {
      var A = window.RowanAuth;
      var u = A && A.getCurrentUser ? A.getCurrentUser() : null;
      if (u) document.documentElement.setAttribute('data-authed', ''); else document.documentElement.removeAttribute('data-authed');
    }
    if (window.RowanAuth && window.RowanAuth.ready && window.RowanAuth.ready.then) window.RowanAuth.ready.then(paintAuth, paintAuth);
    window.addEventListener('rowan:auth', paintAuth);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
