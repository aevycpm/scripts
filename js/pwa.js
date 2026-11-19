/* Aevy — web app (PWA) support: service worker, install button/banner, update + offline notices.
   Android (Chrome/Edge/Samsung) and Windows (Edge/Chrome) fire "beforeinstallprompt"; iOS Safari gets a how-to. */
(function () {
  'use strict';
  var DISMISS = 'aevy_pwa_dismissed', INSTALLED = 'aevy_pwa_installed';
  var standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;
  var deferred = null, banner = null;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---- service worker ---- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version of Aevy is ready.', 'Reload', function () { location.reload(); });
          });
        });
      }).catch(function () {});
    });
  }

  /* ---- tiny toast ---- */
  var toastEl;
  function toast(msg, action, fn, ms) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pwa-toast notranslate'; toastEl.setAttribute('translate', 'no'); toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = ''; var s = document.createElement('span'); s.textContent = msg; toastEl.appendChild(s);
    if (action) { var b = document.createElement('button'); b.type = 'button'; b.textContent = action; b.onclick = function () { toastEl.classList.remove('on'); fn && fn(); }; toastEl.appendChild(b); }
    requestAnimationFrame(function () { toastEl.classList.add('on'); });
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, ms || 8000);
  }
  window.addEventListener('offline', function () { toast("You're offline. Pages you've opened still work.", null, null, 5000); });
  window.addEventListener('online', function () { toast('Back online.', null, null, 2500); });

  /* ---- install ---- */
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|chrome|android/i.test(navigator.userAgent);

  function install() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (c) { if (c.outcome === 'accepted') ls(INSTALLED, '1'); deferred = null; refresh(); });
    } else if (isIOS) {
      toast('Tap Share, then "Add to Home Screen".', null, null, 9000);
    } else {
      toast('Open your browser menu and choose "Install app" (or "Add to Home screen").', null, null, 9000);
    }
  }

  /* menu row inside the existing header menu (Help group) */
  function addMenuRow() {
    var list = document.querySelector('#hdr-menu .hdr-sec:nth-of-type(3) .hdr-list, #hdr-menu .hdr-list:last-of-type');
    if (!list || document.getElementById('pwa-menu-row')) return;
    var a = document.createElement('a');
    a.href = '#'; a.id = 'pwa-menu-row'; a.className = 'hdr-row'; a.hidden = true;
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg><span>Install app</span>';
    a.addEventListener('click', function (e) { e.preventDefault(); install(); });
    list.appendChild(a);
  }

  function canOffer() { return !standalone && !ls(INSTALLED) && (deferred || (isIOS && isSafari)); }

  function refresh() {
    var row = document.getElementById('pwa-menu-row'); if (row) row.hidden = !canOffer();
    if (!canOffer() && banner) { banner.remove(); banner = null; }
  }

  function showBanner() {
    if (banner || !canOffer()) return;
    var d = parseInt(ls(DISMISS), 10); if (d && Date.now() - d < 14 * 864e5) return;
    banner = document.createElement('div'); banner.className = 'pwa-banner notranslate'; banner.setAttribute('translate', 'no'); banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-label', 'Install Aevy');
    banner.innerHTML = '<img src="assets/icons/icon-96.png" width="44" height="44" alt="">' +
      '<div class="pwa-banner__t"><b>Install Aevy</b><span>' + (deferred ? 'Get the app on your device. Fast, full screen, works offline.' : 'Tap Share, then "Add to Home Screen".') + '</span></div>' +
      (deferred ? '<button type="button" class="pwa-banner__go">Install</button>' : '') +
      '<button type="button" class="pwa-banner__x" aria-label="Dismiss">×</button>';
    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('on'); });
    var go = banner.querySelector('.pwa-banner__go'); if (go) go.onclick = install;
    banner.querySelector('.pwa-banner__x').onclick = function () { ls(DISMISS, String(Date.now())); banner.remove(); banner = null; };
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; refresh(); setTimeout(showBanner, 6000); });
  window.addEventListener('appinstalled', function () { ls(INSTALLED, '1'); deferred = null; refresh(); toast('Aevy installed.', null, null, 3000); });

  function init() {
    if (standalone) document.documentElement.classList.add('is-app');
    addMenuRow(); refresh();
    if (isIOS && isSafari) setTimeout(showBanner, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.AevyPWA = { install: install, isInstalled: function () { return standalone; } };
})();
