/* ==========================================================================
   Aevy — Region & Language selector
   Mounts a flag-and-name dropdown into the header on every page.
   - Auto-detects country (IP geolocation, falling back to timezone) and
     language (browser locale), shown as a one-time "Detected: 🇧🇩 …" hint.
   - Persists the user's explicit choice in localStorage so it sticks
     across pages and repeat visits.
   - Applies translations to any element carrying data-i18n="key" via a
     small dictionary (js/i18n.js). Falls back to the original English
     text for any key/language not yet translated, so nothing breaks.
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'rcpm_locale_v1';
  const DETECT_DISMISS_KEY = 'rcpm_locale_detect_dismissed_v1';

  /* Language, native name, flag, and default region shown for that language. */
  const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English', flag: '🇺🇸', region: 'United States' },
    { code: 'en-GB', name: 'English (UK)', native: 'English (UK)', flag: '🇬🇧', region: 'United Kingdom' },
    { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸', region: 'Spain' },
    { code: 'es-MX', name: 'Spanish (Mexico)', native: 'Español (México)', flag: '🇲🇽', region: 'Mexico' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português (Brasil)', flag: '🇧🇷', region: 'Brazil' },
    { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇵🇹', region: 'Portugal' },
    { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷', region: 'France' },
    { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪', region: 'Germany' },
    { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹', region: 'Italy' },
    { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺', region: 'Russia' },
    { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷', region: 'Turkey' },
    { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦', region: 'Saudi Arabia', rtl: true },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', region: 'India' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇧🇩', region: 'Bangladesh' },
    { code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰', region: 'Pakistan', rtl: true },
    { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩', region: 'Indonesia' },
    { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾', region: 'Malaysia' },
    { code: 'th', name: 'Thai', native: 'ไทย', flag: '🇹🇭', region: 'Thailand' },
    { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳', region: 'Vietnam' },
    { code: 'tl', name: 'Filipino', native: 'Filipino', flag: '🇵🇭', region: 'Philippines' },
    { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵', region: 'Japan' },
    { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷', region: 'South Korea' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文', flag: '🇨🇳', region: 'China' },
    { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱', region: 'Netherlands' },
    { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱', region: 'Poland' },
    { code: 'uk', name: 'Ukrainian', native: 'Українська', flag: '🇺🇦', region: 'Ukraine' }
  ];

  /* ISO country code → { language code to preselect, country display name, flag } */
  const COUNTRY_MAP = {
    US: { lang: 'en', name: 'United States', flag: '🇺🇸' },
    GB: { lang: 'en-GB', name: 'United Kingdom', flag: '🇬🇧' },
    CA: { lang: 'en', name: 'Canada', flag: '🇨🇦' },
    AU: { lang: 'en', name: 'Australia', flag: '🇦🇺' },
    ES: { lang: 'es', name: 'Spain', flag: '🇪🇸' },
    MX: { lang: 'es-MX', name: 'Mexico', flag: '🇲🇽' },
    AR: { lang: 'es', name: 'Argentina', flag: '🇦🇷' },
    BR: { lang: 'pt-BR', name: 'Brazil', flag: '🇧🇷' },
    PT: { lang: 'pt', name: 'Portugal', flag: '🇵🇹' },
    FR: { lang: 'fr', name: 'France', flag: '🇫🇷' },
    DE: { lang: 'de', name: 'Germany', flag: '🇩🇪' },
    IT: { lang: 'it', name: 'Italy', flag: '🇮🇹' },
    RU: { lang: 'ru', name: 'Russia', flag: '🇷🇺' },
    TR: { lang: 'tr', name: 'Turkey', flag: '🇹🇷' },
    SA: { lang: 'ar', name: 'Saudi Arabia', flag: '🇸🇦' },
    AE: { lang: 'ar', name: 'United Arab Emirates', flag: '🇦🇪' },
    EG: { lang: 'ar', name: 'Egypt', flag: '🇪🇬' },
    IN: { lang: 'hi', name: 'India', flag: '🇮🇳' },
    BD: { lang: 'bn', name: 'Bangladesh', flag: '🇧🇩' },
    PK: { lang: 'ur', name: 'Pakistan', flag: '🇵🇰' },
    ID: { lang: 'id', name: 'Indonesia', flag: '🇮🇩' },
    MY: { lang: 'ms', name: 'Malaysia', flag: '🇲🇾' },
    TH: { lang: 'th', name: 'Thailand', flag: '🇹🇭' },
    VN: { lang: 'vi', name: 'Vietnam', flag: '🇻🇳' },
    PH: { lang: 'tl', name: 'Philippines', flag: '🇵🇭' },
    JP: { lang: 'ja', name: 'Japan', flag: '🇯🇵' },
    KR: { lang: 'ko', name: 'South Korea', flag: '🇰🇷' },
    CN: { lang: 'zh-CN', name: 'China', flag: '🇨🇳' },
    NL: { lang: 'nl', name: 'Netherlands', flag: '🇳🇱' },
    PL: { lang: 'pl', name: 'Poland', flag: '🇵🇱' },
    UA: { lang: 'uk', name: 'Ukraine', flag: '🇺🇦' }
  };

  /* Rough timezone → country fallback, used only if IP geolocation is
     unavailable (offline, blocked, or the request times out). */
  const TZ_COUNTRY_HINTS = [
    [/^Asia\/Dhaka$/, 'BD'], [/^Asia\/Kolkata|Calcutta$/, 'IN'], [/^Asia\/Karachi$/, 'PK'],
    [/^Asia\/Jakarta|Makassar|Jayapura$/, 'ID'], [/^Asia\/Kuala_Lumpur|Kuching$/, 'MY'],
    [/^Asia\/Bangkok$/, 'TH'], [/^Asia\/Ho_Chi_Minh|Saigon$/, 'VN'], [/^Asia\/Manila$/, 'PH'],
    [/^Asia\/Tokyo$/, 'JP'], [/^Asia\/Seoul$/, 'KR'], [/^Asia\/Shanghai|Chongqing|Urumqi$/, 'CN'],
    [/^Asia\/Riyadh$/, 'SA'], [/^Asia\/Dubai$/, 'AE'], [/^Africa\/Cairo$/, 'EG'],
    [/^Europe\/London$/, 'GB'], [/^Europe\/Madrid$/, 'ES'], [/^Europe\/Lisbon$/, 'PT'],
    [/^Europe\/Paris$/, 'FR'], [/^Europe\/Berlin$/, 'DE'], [/^Europe\/Rome$/, 'IT'],
    [/^Europe\/Moscow$/, 'RU'], [/^Europe\/Istanbul$/, 'TR'], [/^Europe\/Amsterdam$/, 'NL'],
    [/^Europe\/Warsaw$/, 'PL'], [/^Europe\/Kyiv|Kiev$/, 'UA'],
    [/^America\/Sao_Paulo|Bahia|Fortaleza$/, 'BR'], [/^America\/Mexico_City|Tijuana$/, 'MX'],
    [/^America\/Argentina/, 'AR'], [/^America\/Toronto|Vancouver|Winnipeg/, 'CA'],
    [/^Australia\//, 'AU'], [/^America\//, 'US']
  ];

  function langByCode(code) {
    return LANGUAGES.find((l) => l.code === code) || LANGUAGES.find((l) => l.code === code.split('-')[0]);
  }

  function guessCountryFromTimezone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      for (const [re, cc] of TZ_COUNTRY_HINTS) if (re.test(tz)) return cc;
    } catch (e) { /* ignore */ }
    return null;
  }

  function guessLangFromBrowser() {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return langByCode(nav) || LANGUAGES[0];
  }

  async function detectCountry() {
    // Best-effort IP geolocation, race against a short timeout so the UI
    // never hangs waiting on a network call. Falls back to timezone.
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.country_code && COUNTRY_MAP[data.country_code]) {
          return data.country_code;
        }
      }
    } catch (e) { /* fall through to timezone guess */ }
    return guessCountryFromTimezone();
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function applyLocale(state) {
    document.documentElement.lang = (state.langCode || 'en').split('-')[0];
    const lang = langByCode(state.langCode) || LANGUAGES[0];
    document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr';
    if (window.RCPM_I18N && typeof window.RCPM_I18N.apply === 'function') {
      window.RCPM_I18N.apply(state.langCode);
    }
    document.dispatchEvent(new CustomEvent('rcpm:localechange', { detail: state }));
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function buildWidget() {
    const wrap = el(`
      <div class="rcpm-locale">
        <button type="button" class="rcpm-locale__trigger" aria-haspopup="listbox" aria-expanded="false">
          <span class="rcpm-locale__flag">🌐</span>
          <span class="rcpm-locale__name"></span>
          <span class="rcpm-locale__label">Region</span>
          <svg class="rcpm-locale__chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="rcpm-locale__panel" role="listbox" aria-label="Choose language and region">
          <div class="rcpm-locale__detect" hidden>
            <span class="rcpm-locale__detect-text"></span>
            <div class="rcpm-locale__detect-actions">
              <button type="button" class="rcpm-locale__detect-accept">Use this</button>
              <button type="button" class="rcpm-locale__detect-dismiss">Dismiss</button>
            </div>
          </div>
          <div class="rcpm-locale__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input type="text" placeholder="Search language or country…" aria-label="Search languages">
          </div>
          <ul class="rcpm-locale__list"></ul>
        </div>
      </div>
    `);
    return wrap;
  }

  function renderList(listEl, filter, onPick) {
    const q = (filter || '').trim().toLowerCase();
    listEl.innerHTML = '';
    const items = LANGUAGES.filter((l) =>
      !q || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.region.toLowerCase().includes(q)
    );
    if (!items.length) {
      listEl.appendChild(el(`<li class="rcpm-locale__empty">No matches</li>`));
      return;
    }
    items.forEach((l) => {
      const item = el(`
        <li>
          <button type="button" class="rcpm-locale__item" data-code="${l.code}">
            <span class="rcpm-locale__item-flag">${l.flag}</span>
            <span class="rcpm-locale__item-text">
              <span class="rcpm-locale__item-native">${l.native}</span>
              <span class="rcpm-locale__item-region">${l.region}</span>
            </span>
          </button>
        </li>
      `);
      item.querySelector('button').addEventListener('click', () => onPick(l));
      listEl.appendChild(item);
    });
  }

  async function init() {
    const mountPoint = document.querySelector('[data-locale-mount]');
    const headerActions = document.querySelector('.header-actions');
    if (!mountPoint && !headerActions) return;

    const widget = buildWidget();
    if (mountPoint) mountPoint.appendChild(widget);
    else headerActions.insertBefore(widget, headerActions.firstChild);

    const trigger = widget.querySelector('.rcpm-locale__trigger');
    const flagEl = widget.querySelector('.rcpm-locale__flag');
    const labelEl = widget.querySelector('.rcpm-locale__label');
    const nameEl = widget.querySelector('.rcpm-locale__name');
    const panel = widget.querySelector('.rcpm-locale__panel');
    const searchInput = widget.querySelector('.rcpm-locale__search input');
    const listEl = widget.querySelector('.rcpm-locale__list');
    const detectBox = widget.querySelector('.rcpm-locale__detect');
    const detectText = widget.querySelector('.rcpm-locale__detect-text');
    const detectAccept = widget.querySelector('.rcpm-locale__detect-accept');
    const detectDismiss = widget.querySelector('.rcpm-locale__detect-dismiss');

    function setTrigger(state) {
      flagEl.textContent = state.flag || '🌐';
      labelEl.textContent = state.short || 'Region';
      nameEl.textContent = state.langName || 'English';
      trigger.setAttribute('title', `${state.langName || 'English'} · ${state.countryName || ''}`.trim());
    }

    function choose(country, lang, opts) {
      const state = {
        countryCode: country ? country.code : null,
        countryName: country ? country.name : (lang && lang.region) || '',
        flag: country ? country.flag : (lang && lang.flag) || '🌐',
        langCode: lang.code,
        langName: lang.native,
        short: lang.code.split('-')[0].toUpperCase()
      };
      save(state);
      document.documentElement.classList.remove('has-locale-hint');
      setTrigger(state);
      applyLocale(state);
      if (!(opts && opts.silent)) closePanel();
    }

    function openPanel() {
      panel.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      searchInput.value = '';
      renderList(listEl, '', (l) => choose(
        l.code === (saved && saved.langCode) ? { code: saved.countryCode, name: saved.countryName, flag: saved.flag } : null,
        l
      ));
      setTimeout(() => searchInput.focus(), 50);
    }
    function closePanel() {
      panel.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', () => {
      panel.classList.contains('open') ? closePanel() : openPanel();
    });
    document.addEventListener('click', (e) => {
      if (!widget.contains(e.target)) closePanel();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });
    searchInput.addEventListener('input', () => {
      renderList(listEl, searchInput.value, (l) => choose(null, l));
    });

    /* ---------------- Resolve initial state ---------------- */
    let saved = loadSaved();
    if (saved) {
      setTrigger(saved);
      applyLocale(saved);
    } else {
      // No explicit choice yet — default to English until detection resolves.
      setTrigger({ flag: '🌐', short: 'EN' });
      document.documentElement.lang = 'en';
    }

    const dismissed = sessionStorage.getItem(DETECT_DISMISS_KEY);
    if (!saved && !dismissed) {
      const [cc] = await Promise.all([detectCountry()]);
      const mapped = cc && COUNTRY_MAP[cc];
      const browserLang = guessLangFromBrowser();
      const lang = mapped ? langByCode(mapped.lang) || browserLang : browserLang;
      const country = mapped ? { code: cc, name: mapped.name, flag: mapped.flag } : null;

      if (lang) {
        detectText.textContent = country
          ? `Looks like you're in ${country.flag} ${country.name} — switch to ${lang.native}?`
          : `Switch site language to ${lang.native}?`;
        detectBox.hidden = false;
        document.documentElement.classList.add('has-locale-hint');
        detectAccept.addEventListener('click', () => {
          choose(country, lang, { silent: true });
          detectBox.hidden = true;
          document.documentElement.classList.remove('has-locale-hint');
        });
        detectDismiss.addEventListener('click', () => {
          detectBox.hidden = true;
          document.documentElement.classList.remove('has-locale-hint');
          try { sessionStorage.setItem(DETECT_DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
        });
        // Surface the suggestion the first time the panel opens.
        trigger.addEventListener('click', () => { /* panel already shows detectBox */ }, { once: true });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
