/* ==========================================================================
   Aevy — Shared JS
   Header scroll state, mobile nav, dropdowns, search suggestions,
   FAQ accordion, view toggle, password visibility, toast helper, modal helper.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Header scroll shadow ---------------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------- Hamburger / mobile nav ---------------- */
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileNav && mobileNav.parentElement && mobileNav.parentElement.tagName === 'HEADER') {
    document.body.appendChild(mobileNav);
  }
  let mobileNavBackdrop = document.querySelector('.mobile-nav-backdrop');
  if (!mobileNavBackdrop) {
    mobileNavBackdrop = document.createElement('div');
    mobileNavBackdrop.className = 'mobile-nav-backdrop';
    document.body.appendChild(mobileNavBackdrop);
  }

  if (mobileNav && !mobileNav.querySelector('.mobile-nav__header')) {
    const mobileNavHeader = document.createElement('div');
    mobileNavHeader.className = 'mobile-nav__header';
    const mobileNavBrand = document.createElement('div');
    mobileNavBrand.className = 'mobile-nav__brand';
    const brandLogo = document.querySelector('.brand__mark')?.cloneNode(true);
    const brandName = document.querySelector('.brand__name')?.cloneNode(true);
    if (brandLogo) mobileNavBrand.appendChild(brandLogo);
    if (brandName) mobileNavBrand.appendChild(brandName);
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'mobile-nav-close';
    closeButton.setAttribute('aria-label', 'Close menu');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => closeMobileNav());
    mobileNavHeader.appendChild(mobileNavBrand);
    mobileNavHeader.appendChild(closeButton);
    mobileNav.prepend(mobileNavHeader);
  }

  /* Inject icons into mobile nav links (only once) */
  if (mobileNav) {
    const navIcons = {
      'index.html': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
      'scripts.html': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>',
      'games.html': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="4"/><path d="M6 12h4M8 10v4M15.5 11.5h.01M18 13h.01"/></svg>',
      'apps.html': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
      'support.html': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.5"/><path d="M12 17.2h.01"/></svg>'
    };
    mobileNav.querySelectorAll('ul a[href]').forEach(a => {
      if (a.querySelector('.nav-ic')) return;
      const href = a.getAttribute('href').split('/').pop();
      const icon = navIcons[href];
      if (!icon) return;
      const wrap = document.createElement('span');
      wrap.className = 'nav-ic';
      wrap.innerHTML = icon;
      a.prepend(wrap);
    });
  }

  const closeMobileNav = () => {
    if (!hamburger || !mobileNav) return;
    hamburger.classList.remove('open');
    mobileNav.classList.remove('open');
    mobileNav.style.visibility = 'hidden';
    mobileNav.style.opacity = '0';
    mobileNav.style.pointerEvents = 'none';
    mobileNavBackdrop.classList.remove('show');
    document.body.classList.remove('nav-open');
    // Restore the iOS-safe scroll lock (see openMobileNav for why this is needed).
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
    }
    hamburger.setAttribute('aria-expanded', 'false');
  };

  const openMobileNav = () => {
    if (!hamburger || !mobileNav) return;
    // Lock the body with position:fixed (not just overflow:hidden) so iOS Safari
    // can't rubber-band scroll the page behind the menu — that's what made the
    // menu appear to "stop working" after the page had been scrolled.
    const scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${scrollY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    hamburger.classList.add('open');
    mobileNav.classList.add('open');
    mobileNav.style.visibility = 'visible';
    mobileNav.style.opacity = '1';
    mobileNav.style.pointerEvents = 'auto';
    mobileNavBackdrop.classList.add('show');
    document.body.classList.add('nav-open');
    hamburger.setAttribute('aria-expanded', 'true');
  };

  if (hamburger && mobileNav) {
    hamburger.type = 'button';
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-controls', mobileNav.id || 'mobile-nav-menu');
    if (!mobileNav.id) mobileNav.id = 'mobile-nav-menu';

    hamburger.addEventListener('click', (event) => {
      event.stopPropagation();
      if (mobileNav.classList.contains('open')) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });

    mobileNavBackdrop.addEventListener('click', closeMobileNav);

    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMobileNav);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mobileNav.classList.contains('open')) {
        closeMobileNav();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) closeMobileNav();
    });

    document.addEventListener('click', (event) => {
      if (!mobileNav.classList.contains('open')) return;
      if (!mobileNav.contains(event.target) && !hamburger.contains(event.target)) {
        closeMobileNav();
      }
    });
  }

  /* ---------------- User dropdown ---------------- */
  document.querySelectorAll('.user-menu').forEach(menu => {
    const chip = menu.querySelector('.user-chip');
    const dropdown = menu.querySelector('.user-dropdown');
    if (!chip || !dropdown) return;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.user-dropdown.show').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.search-suggestions.show').forEach(d => d.classList.remove('show'));
  });

  /* ---------------- Header search suggestions ---------------- */
  const SEARCH_TARGETS = [
    { label: 'everything', page: 'index.html' },
    { label: 'Apps', page: 'apps.html' },
    { label: 'Scripts', page: 'scripts.html' },
    { label: 'Games', page: 'games.html' },
  ];
  document.querySelectorAll('.header-search').forEach(box => {
    const input = box.querySelector('input');
    const list = box.querySelector('.search-suggestions');
    if (!input || !list) return;
    input.placeholder = 'Search Aevy...';
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('input', () => {
      const q = input.value.trim();
      list.innerHTML = '';
      if (!q) { list.classList.remove('show'); return; }
      SEARCH_TARGETS.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${t.page}?q=${encodeURIComponent(q)}"><span>Search "${escapeHtml(q)}"</span><span class="muted">in ${t.label}</span></a>`;
        list.appendChild(li);
      });
      list.classList.add('show');
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) { e.preventDefault(); location.href = 'index.html?q=' + encodeURIComponent(input.value.trim()); }
    });
  });

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
  }

  /* ---------------- FAQ accordion ---------------- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-question');
    const a = item.querySelector('.faq-answer');
    if (!q || !a) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      item.parentElement.querySelectorAll('.faq-item.open').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-answer').style.maxHeight = null;
        }
      });
      item.classList.toggle('open', !isOpen);
      a.style.maxHeight = !isOpen ? a.scrollHeight + 'px' : null;
    });
  });

  /* ---------------- Grid / list view toggle ---------------- */
  document.querySelectorAll('.view-toggle').forEach(toggle => {
    const buttons = toggle.querySelectorAll('button');
    const grid = document.querySelector('.product-grid');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (!grid) return;
        grid.classList.toggle('list-view', btn.dataset.view === 'list');
      });
    });
  });

  /* ---------------- Category filter (sidebar) ---------------- */
  document.querySelectorAll('.category-list button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-list button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.category;
      document.querySelectorAll('[data-cat-item]').forEach(card => {
        const show = cat === 'all' || card.dataset.catItem === cat;
        card.style.display = show ? '' : 'none';
      });
      const countEl = document.querySelector('.results-count');
      if (countEl) {
        const visible = document.querySelectorAll('[data-cat-item]:not([style*="display: none"])').length;
        countEl.textContent = `${visible} Result${visible === 1 ? '' : 's'} Found`;
      }
    });
  });

  /* ---------------- Password visibility toggle ---------------- */
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  /* ---------------- Password strength meter ---------------- */
  document.querySelectorAll('[data-strength-target]').forEach(input => {
    const meter = document.querySelector(input.dataset.strengthTarget);
    if (!meter) return;
    const bars = meter.querySelectorAll('span');
    input.addEventListener('input', () => {
      const val = input.value;
      let score = 0;
      if (val.length >= 6) score++;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
      if (/\d/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      const colors = ['var(--color-border)', 'var(--color-danger)', 'var(--color-warning)', 'var(--color-primary)', 'var(--color-success)'];
      bars.forEach((bar, i) => {
        bar.style.background = i < score ? colors[score] : 'var(--color-border)';
      });
    });
  });

  /* ---------------- Profile tabs ---------------- */
  document.querySelectorAll('.profile-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.profile-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector(`[data-panel="${target}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  /* ---------------- Modal helper (data-modal-open / data-modal-close) ---------------- */
  document.querySelectorAll('[data-modal-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById(btn.dataset.modalOpen);
      if (modal) modal.classList.add('open');
    });
  });
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay')?.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  /* ---------------- Toast helper (global) ---------------- */
  window.showToast = function (message, type = 'success') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 300ms ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  };

  /* ---------------- Ripple effect on buttons ---------------- */
  document.querySelectorAll('.btn').forEach(btn => {
    btn.classList.add('ripple-container');
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple-effect';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });

  /* ---------------- Demo form submit handlers ---------------- */
  document.querySelectorAll('form[data-demo-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      window.showToast(form.dataset.demoForm || 'Submitted successfully!', 'success');
      form.reset();
    });
  });

  /* ---------------- Download button demo feedback ---------------- */
  document.querySelectorAll('[data-download]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.showToast(`${btn.dataset.download} download started`, 'success');
    });
  });

  /* ---------------- Scroll reveal ---------------- */
  const revealEls = document.querySelectorAll('.will-reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  }

});
