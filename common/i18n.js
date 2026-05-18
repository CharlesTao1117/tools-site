/**
 * i18n — Language detection + translation engine
 *
 * Priority order:
 *   1. localStorage('lang')
 *   2. navigator.language (browser setting)
 *   3. Timezone (Asia/Taipei)
 *   4. IP geolocation (async fallback, only on first visit)
 *
 * Usage:
 *   In HTML: <h1 data-i18n="page_title">Fallback English text</h1>
 *   In JS:   i18n.register({ page_title: { en: "...", zh: "..." } })
 *   Toggle:  i18n.toggle()
 */

const i18n = (() => {
  const store = {};    // { key: { en: str, zh: str } }
  let currentLang = 'en';

  /* ── language detection ── */
  function detectLang() {
    const saved = localStorage.getItem('lang');
    if (saved && (saved === 'en' || saved === 'zh')) return saved;

    // Browser language
    const blang = (navigator.language || '').toLowerCase();
    if (blang.startsWith('zh')) return 'zh';

    // Timezone — Taiwan
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'Asia/Taipei') return 'zh';
    } catch (_) { /* ignore */ }

    return 'en'; // default
  }

  /* ── IP geolocation (async, one-time) ── */
  function detectByIP() {
    if (localStorage.getItem('ip_checked')) return;
    localStorage.setItem('ip_checked', '1');

    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then(data => {
        if (data.country_code === 'TW' && !localStorage.getItem('lang')) {
          currentLang = 'zh';
          localStorage.setItem('lang', 'zh');
          apply();
        }
      })
      .catch(() => {
        // fallback: try ip-api.com
        fetch('http://ip-api.com/json/?fields=countryCode', { signal: AbortSignal.timeout(3000) })
          .then(r => r.json())
          .then(data => {
            if (data.countryCode === 'TW' && !localStorage.getItem('lang')) {
              currentLang = 'zh';
              localStorage.setItem('lang', 'zh');
              apply();
            }
          })
          .catch(() => {});
      });
  }

  /* ── apply translations ── */
  function apply() {
    document.documentElement.lang = currentLang;
    const toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.textContent = currentLang === 'en' ? '中文' : 'English';
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const entry = store[key];
      if (!entry) return;

      const text = entry[currentLang];
      if (text === undefined || text === null) return;

      // Handle different element types
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.dataset.i18nType === 'placeholder') {
          el.placeholder = text;
        } else {
          el.value = text;
        }
      } else if (el.tagName === 'IMG') {
        if (el.dataset.i18nType === 'alt') {
          el.alt = text;
        }
      } else if (el.tagName === 'META') {
        el.content = text;
      } else if (el.tagName === 'TITLE') {
        document.title = text;
      } else {
        el.textContent = text;
      }
    });
  }

  /* ── public API ── */
  return {
    get lang() { return currentLang; },
    get isEN() { return currentLang === 'en'; },
    get isZH() { return currentLang === 'zh'; },

    /** Register page-specific translations */
    register(map) {
      Object.assign(store, map);
    },

    /** Register a single key */
    set(key, enText, zhText) {
      store[key] = { en: enText, zh: zhText };
    },

    init() {
      currentLang = detectLang();
      localStorage.setItem('lang', currentLang);
      apply();
      // Async IP detection (won't override explicit choice)
      detectByIP();
    },

    toggle() {
      currentLang = currentLang === 'en' ? 'zh' : 'en';
      localStorage.setItem('lang', currentLang);
      apply();
    },

    apply
  };
})();

/* ── shared translations (used across all pages) ── */
i18n.set('nav_home',     'Home',               '首頁');
i18n.set('nav_qr',       'QR Code Generator',  'QR Code 產生器');
i18n.set('nav_bmi',      'BMI Calculator',     'BMI 計算機');
i18n.set('footer_pages', 'Home · Privacy Policy · Terms · About', '首頁 · 隱私政策 · 服務條款 · 關於我們');
i18n.set('footer_cr',    '© 2026 Free Online Tools', '© 2026 免費線上工具集');
i18n.set('more_coming',  'More tools coming soon...', '更多工具持續新增中...');
i18n.set('related_tools','Related Tools',      '相關工具');
