/* ==========================================================================
   Aevy — i18n dictionary
   Small, hand-maintained translation table for the site chrome (nav +
   auth buttons) that data-i18n hooks reference. Add more keys/languages
   here as pages get fully localized — anything missing quietly falls
   back to the original English text already in the HTML, so partial
   coverage never breaks the page.
   ========================================================================== */
(function () {
  'use strict';

  const DICT = {
    en:    { 'nav.home': 'Home', 'nav.scripts': 'Scripts', 'nav.games': 'Games', 'nav.apps': 'Apps', 'nav.support': 'Support', 'nav.login': 'Login', 'nav.signup': 'Sign Up' },
    es:    { 'nav.home': 'Inicio', 'nav.scripts': 'Scripts', 'nav.games': 'Juegos', 'nav.apps': 'Apps', 'nav.support': 'Soporte', 'nav.login': 'Acceder', 'nav.signup': 'Registrarse' },
    pt:    { 'nav.home': 'Início', 'nav.scripts': 'Scripts', 'nav.games': 'Jogos', 'nav.apps': 'Apps', 'nav.support': 'Suporte', 'nav.login': 'Entrar', 'nav.signup': 'Criar conta' },
    fr:    { 'nav.home': 'Accueil', 'nav.scripts': 'Scripts', 'nav.games': 'Jeux', 'nav.apps': 'Applis', 'nav.support': 'Assistance', 'nav.login': 'Connexion', 'nav.signup': "S'inscrire" },
    de:    { 'nav.home': 'Start', 'nav.scripts': 'Skripte', 'nav.games': 'Spiele', 'nav.apps': 'Apps', 'nav.support': 'Support', 'nav.login': 'Anmelden', 'nav.signup': 'Registrieren' },
    it:    { 'nav.home': 'Home', 'nav.scripts': 'Script', 'nav.games': 'Giochi', 'nav.apps': 'App', 'nav.support': 'Assistenza', 'nav.login': 'Accedi', 'nav.signup': 'Registrati' },
    ru:    { 'nav.home': 'Главная', 'nav.scripts': 'Скрипты', 'nav.games': 'Игры', 'nav.apps': 'Приложения', 'nav.support': 'Поддержка', 'nav.login': 'Войти', 'nav.signup': 'Регистрация' },
    tr:    { 'nav.home': 'Anasayfa', 'nav.scripts': 'Scriptler', 'nav.games': 'Oyunlar', 'nav.apps': 'Uygulamalar', 'nav.support': 'Destek', 'nav.login': 'Giriş Yap', 'nav.signup': 'Kayıt Ol' },
    ar:    { 'nav.home': 'الرئيسية', 'nav.scripts': 'السكربتات', 'nav.games': 'الألعاب', 'nav.apps': 'التطبيقات', 'nav.support': 'الدعم', 'nav.login': 'تسجيل الدخول', 'nav.signup': 'إنشاء حساب' },
    hi:    { 'nav.home': 'होम', 'nav.scripts': 'स्क्रिप्ट्स', 'nav.games': 'गेम्स', 'nav.apps': 'ऐप्स', 'nav.support': 'सहायता', 'nav.login': 'लॉगिन', 'nav.signup': 'साइन अप करें' },
    bn:    { 'nav.home': 'হোম', 'nav.scripts': 'স্ক্রিপ্ট', 'nav.games': 'গেমস', 'nav.apps': 'অ্যাপস', 'nav.support': 'সাপোর্ট', 'nav.login': 'লগইন', 'nav.signup': 'সাইন আপ' },
    ur:    { 'nav.home': 'ہوم', 'nav.scripts': 'اسکرپٹس', 'nav.games': 'گیمز', 'nav.apps': 'ایپس', 'nav.support': 'سپورٹ', 'nav.login': 'لاگ ان', 'nav.signup': 'سائن اپ' },
    id:    { 'nav.home': 'Beranda', 'nav.scripts': 'Skrip', 'nav.games': 'Game', 'nav.apps': 'Aplikasi', 'nav.support': 'Dukungan', 'nav.login': 'Masuk', 'nav.signup': 'Daftar' },
    ms:    { 'nav.home': 'Laman Utama', 'nav.scripts': 'Skrip', 'nav.games': 'Permainan', 'nav.apps': 'Aplikasi', 'nav.support': 'Sokongan', 'nav.login': 'Log Masuk', 'nav.signup': 'Daftar' },
    th:    { 'nav.home': 'หน้าแรก', 'nav.scripts': 'สคริปต์', 'nav.games': 'เกม', 'nav.apps': 'แอป', 'nav.support': 'ฝ่ายสนับสนุน', 'nav.login': 'เข้าสู่ระบบ', 'nav.signup': 'สมัครสมาชิก' },
    vi:    { 'nav.home': 'Trang chủ', 'nav.scripts': 'Script', 'nav.games': 'Trò chơi', 'nav.apps': 'Ứng dụng', 'nav.support': 'Hỗ trợ', 'nav.login': 'Đăng nhập', 'nav.signup': 'Đăng ký' },
    tl:    { 'nav.home': 'Home', 'nav.scripts': 'Scripts', 'nav.games': 'Mga Laro', 'nav.apps': 'Mga App', 'nav.support': 'Suporta', 'nav.login': 'Mag-login', 'nav.signup': 'Mag-sign Up' },
    ja:    { 'nav.home': 'ホーム', 'nav.scripts': 'スクリプト', 'nav.games': 'ゲーム', 'nav.apps': 'アプリ', 'nav.support': 'サポート', 'nav.login': 'ログイン', 'nav.signup': '新規登録' },
    ko:    { 'nav.home': '홈', 'nav.scripts': '스크립트', 'nav.games': '게임', 'nav.apps': '앱', 'nav.support': '고객지원', 'nav.login': '로그인', 'nav.signup': '회원가입' },
    zh:    { 'nav.home': '首页', 'nav.scripts': '脚本', 'nav.games': '游戏', 'nav.apps': '应用', 'nav.support': '支持', 'nav.login': '登录', 'nav.signup': '注册' },
    nl:    { 'nav.home': 'Home', 'nav.scripts': "Scripts", 'nav.games': 'Games', 'nav.apps': "Apps", 'nav.support': 'Ondersteuning', 'nav.login': 'Inloggen', 'nav.signup': 'Registreren' },
    pl:    { 'nav.home': 'Strona główna', 'nav.scripts': 'Skrypty', 'nav.games': 'Gry', 'nav.apps': 'Aplikacje', 'nav.support': 'Wsparcie', 'nav.login': 'Zaloguj się', 'nav.signup': 'Zarejestruj się' },
    uk:    { 'nav.home': 'Головна', 'nav.scripts': 'Скрипти', 'nav.games': 'Ігри', 'nav.apps': 'Додатки', 'nav.support': 'Підтримка', 'nav.login': 'Увійти', 'nav.signup': 'Реєстрація' }
  };

  function normalize(code) {
    if (!code) return 'en';
    if (code.toLowerCase() === 'zh-cn') return 'zh';
    return code.split('-')[0].toLowerCase();
  }

  function apply(langCode) {
    const table = DICT[normalize(langCode)] || DICT.en;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      const text = table[key] || DICT.en[key];
      if (text) node.textContent = text;
    });
  }

  window.RCPM_I18N = { apply, DICT };
})();
