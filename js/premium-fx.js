/* ==========================================================================
   Aevy — Premium Motion Controller
   Loading screen, blurred page transitions, cherry blossom petals,
   floating light blobs, idle character blink flicker, and staggered
   scroll reveals. Pairs with css/premium-fx.css.
   ========================================================================== */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Phones / touch devices: skip the heavy decorative layer entirely.
  const lite = window.matchMedia('(max-width: 860px), (hover: none)').matches;

  /* ---------------- Loading screen ---------------- */
  function initLoader() {
    const loader = document.querySelector('.pfx-loader');
    if (!loader) return;
    const hide = () => loader.classList.add('pfx-loader--hidden');
    // Don't wait for every image: hide once the DOM is parsed, with a short safety net.
    hide();
    setTimeout(hide, 600);
  }

  /* ---------------- Safety net: clear any lingering body filter/transform ----------------
     Prevents position:fixed elements (chat launcher, mobile nav, modals) from ever getting
     trapped relative to <body> instead of the viewport once the intro animation finishes. */
  function clearBodyFxTraps() {
    const clear = () => {
      document.body.style.filter = 'none';
      document.body.style.transform = 'none';
    };
    document.body.addEventListener('animationend', clear);
    setTimeout(clear, 700); // covers browsers that don't fire animationend reliably
  }

  /* ---------------- Blurred crossfade page transitions ---------------- */
  function initPageTransitions() {
    if (reduceMotion || lite) return; // no fake delay before navigating on mobile
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      let url;
      try { url = new URL(href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;

      e.preventDefault();
      document.body.classList.add('pfx-leaving');
      setTimeout(() => { window.location.href = href; }, 120);
    });
  }

  /* ---------------- Cherry blossom petals + floating light blobs ---------------- */
  function initHeroFx() {
    const hero = document.querySelector('.hero');
    if (!hero || reduceMotion || lite) return;

    const fx = document.createElement('div');
    fx.className = 'pfx-hero-fx';
    hero.prepend(fx);

    // Soft moving light blobs
    const blobConfigs = [
      { size: 220, top: '8%', left: '12%', color: 'rgba(124,58,237,0.18)' },
      { size: 260, top: '55%', left: '78%', color: 'rgba(192,38,212,0.15)' },
      { size: 160, top: '75%', left: '30%', color: 'rgba(79,70,229,0.14)' },
    ];
    blobConfigs.forEach((b, i) => {
      const blob = document.createElement('span');
      blob.className = 'pfx-blob';
      blob.style.width = b.size + 'px';
      blob.style.height = b.size + 'px';
      blob.style.top = b.top;
      blob.style.left = b.left;
      blob.style.background = b.color;
      blob.style.animationDelay = (i * 1.4) + 's';
      fx.appendChild(blob);
    });

    // Cherry blossom petals — small SVGs, continuously spawned
    const petalSvg = (hue) => `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1c1.6 1 2.4 2.4 2 4-1 .3-1.8 0-2-1-.2 1-1 1.3-2 1-.4-1.6.4-3 2-4z" fill="${hue}"/>
      </svg>`;
    const colors = ['#F5C6E0', '#F0AFD6', '#E9C7F2', '#F8D6E8'];

    function spawnPetal() {
      const petal = document.createElement('span');
      petal.className = 'pfx-petal';
      const left = Math.random() * 100;
      const size = 12 + Math.random() * 10;
      const fallDuration = 9 + Math.random() * 7;
      const swayDuration = 3 + Math.random() * 2;
      const delay = Math.random() * 0.6;
      petal.style.left = left + '%';
      petal.style.width = size + 'px';
      petal.style.height = size + 'px';
      petal.style.animationDuration = fallDuration + 's, ' + swayDuration + 's';
      petal.style.animationDelay = delay + 's, 0s';
      petal.innerHTML = petalSvg(colors[Math.floor(Math.random() * colors.length)]);
      fx.appendChild(petal);
      setTimeout(() => petal.remove(), (fallDuration + delay) * 1000 + 200);
    }

    for (let i = 0; i < 6; i++) setTimeout(spawnPetal, i * 700);
    let petalCount = 0;
    const petalInterval = setInterval(() => {
      spawnPetal();
      petalCount += 1;
      if (petalCount >= 18) clearInterval(petalInterval); // decorative only — no need to run forever
    }, 1400);
  }

  /* ---------------- Idle character blink flicker ---------------- */
  function initCharacterBlink() {
    const hero = document.querySelector('.hero');
    if (!hero || reduceMotion || lite) return;
    function scheduleBlink() {
      const delay = 4000 + Math.random() * 4000;
      setTimeout(() => {
        hero.classList.add('pfx-blink');
        setTimeout(() => hero.classList.remove('pfx-blink'), 140);
        scheduleBlink();
      }, delay);
    }
    scheduleBlink();
  }

  /* ---------------- Staggered scroll reveals (cards + sections + footer) ---------------- */
  function initStaggerReveal() {
    if (lite || !('IntersectionObserver' in window)) {
      // Mobile: everything is visible immediately (see mobile.css), nothing to observe.
      document.documentElement.classList.add('no-reveal');
      return;
    }

    const groups = document.querySelectorAll('.grid-3, .grid-4, .product-grid');
    const groupObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        Array.from(el.children).forEach((child, i) => {
          child.style.setProperty('--d', (i * 100) + 'ms');
        });
        el.classList.add('pfx-in-view');
        groupObserver.unobserve(el);
      });
    }, { threshold: 0.15 });
    groups.forEach((g) => groupObserver.observe(g));

    const sections = document.querySelectorAll('.section > .container');
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('pfx-in-view');
          sectionObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    sections.forEach((s) => sectionObserver.observe(s));

    const footer = document.querySelector('.site-footer');
    if (footer) {
      const footerObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pfx-in-view');
            footerObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });
      footerObserver.observe(footer);
    }
  }

  const boot = () => {
    initLoader();
    clearBodyFxTraps();
    initPageTransitions();
    initHeroFx();
    initCharacterBlink();
    initStaggerReveal();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
