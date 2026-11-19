/* ==========================================================================
   Aevy — Effects JS
   Smooth in-page scrolling (offset for the sticky header) and a lightweight
   scroll-driven parallax for decorative floating shapes / hero art.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.site-header');

  /* ---------------- Smooth scrolling with sticky-header offset ---------------- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;
    link.addEventListener('click', (e) => {
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      const headerH = header ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 16;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------------- Parallax on decorative elements ---------------- */
  const lite = window.matchMedia('(max-width: 860px), (hover: none)').matches;
  const parallaxEls = lite ? [] : Array.from(document.querySelectorAll('[data-parallax-speed]'));
  if (parallaxEls.length && !reduceMotion) {
    let ticking = false;
    const update = () => {
      const scrollY = window.scrollY;
      parallaxEls.forEach(el => {
        const speed = parseFloat(el.dataset.parallaxSpeed) || 0.15;
        el.style.transform = `translateY(${scrollY * speed}px)`;
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }
});
