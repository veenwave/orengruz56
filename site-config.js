/* =====================================================================
   НАСТРОЙКИ КОНКРЕТНОГО КЛИЕНТА — МЕНЯТЬ ТОЛЬКО ЭТОТ ФАЙЛ ПЕРЕД ЗАПУСКОМ
   Один и тот же шаблон можно копировать для разных компаний.
   Не вставляйте сюда пароли, Bot Token, service_role или другие секреты.
   ===================================================================== */
window.SITE_CONFIG = Object.freeze({
  // Уникальный slug компании в общей базе. Для каждого клиента — свой.
  tenantSlug: "orengruz56",

  // Эти данные настраивает разработчик, а не владелец через админ-панель.
  companyName: "ОренГруз56",
  phoneDisplay: "+7 (3532) 60-75-80",
  phoneTel: "+73532607580",
  city: "Оренбург",
  tagline: "Подача от 2 часов • Оренбург и район",
  pageTitle: "ОренГруз56 — доставка сыпучих материалов в Оренбурге",
  heroTitle: "Доставка песка, щебня, ПГС и чернозёма в Оренбурге",
  heroText: "Самосвалы для частных участков и крупных строек. Рассчитайте примерную стоимость доставки онлайн.",
  heroImage: "assets/default-hero.jpg",
  logoEmoji: "🚛",
  accentColor: "#f5a900",

  // Ссылки на реальные профили/чаты компании. Оставьте пустым, если канал не используется.
  maxUrl: "https://web.max.ru/0",
  telegramUrl: "https://t.me/dewdfe",
  preferredMessenger: "both", // max | telegram | both

  // Публичные параметры Supabase. Publishable/anon key предназначен для браузера.
  // SERVICE ROLE KEY, пароли и Bot Token сюда НИКОГДА не добавлять.
  supabaseUrl: "https://mmlgatsvoocjuibuvzuh.supabase.co",
  supabasePublishableKey: "sb_publishable_REi6KTjLuobHDr2Du7_SpA_pWQApO-v",

  // Ориентировочный диапазон в калькуляторе (± проценты).
  priceSpreadPercent: 7
});
