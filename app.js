import { fetchPublicTable, isSupabaseConfigured, publicImageUrl } from "./supabase-client.js";

const CFG = window.SITE_CONFIG || {};

const DEFAULTS = {
  materials: [
    { id: "demo-sand", name: "Песок речной", description: "Мытый песок для бетона и стяжки", price_per_ton: 650, density: 1.5, image_path: "", _fallback: "assets/default-sand.jpg" },
    { id: "demo-quarry", name: "Песок карьерный", description: "Для кладки, подушки и засыпки", price_per_ton: 480, density: 1.45, image_path: "", _fallback: "assets/default-sand.jpg" },
    { id: "demo-gravel-small", name: "Щебень 5–20 мм", description: "Для фундамента и бетона", price_per_ton: 1250, density: 1.4, image_path: "", _fallback: "assets/default-gravel.jpg" },
    { id: "demo-gravel-large", name: "Щебень 20–40 мм", description: "Для парковки и заезда", price_per_ton: 1150, density: 1.4, image_path: "", _fallback: "assets/default-gravel.jpg" },
    { id: "demo-pgs", name: "ПГС / ОПГС", description: "Песчано-гравийная смесь", price_per_ton: 720, density: 1.6, image_path: "", _fallback: "assets/default-gravel.jpg" },
    { id: "demo-soil", name: "Чернозём", description: "Плодородный слой для сада и участка", price_per_ton: 600, density: 1.2, image_path: "", _fallback: "assets/default-soil.jpg" }
  ],
  trucks: [
    { id: "demo-zil", name: "ГАЗон / ЗИЛ Самосвал", description: "Компактный самосвал для узких проездов", max_tons: 5, base_delivery_price: 2000, class_key: "small", image_path: "", _fallback: "assets/default-truckZil.jpg" },
    { id: "demo-kamaz", name: "КАМАЗ Самосвал", description: "Для стройки частного дома и фундамента", max_tons: 15, base_delivery_price: 2500, class_key: "medium", image_path: "", _fallback: "assets/default-truckKamaz.jpg" },
    { id: "demo-shacman", name: "Shacman 4-осный", description: "Большой объём для отсыпки участка или дороги", max_tons: 30, base_delivery_price: 4000, class_key: "large", image_path: "", _fallback: "assets/default-truckShacman.jpg" }
  ],
  zones: [
    { id: "demo-city", key: "city", name: "Оренбург", price_small: 2000, price_medium: 2500, price_large: 4000 },
    { id: "demo-east", key: "near_east", name: "Пригородный / Нежинка", price_small: 2400, price_medium: 3000, price_large: 4600 },
    { id: "demo-south", key: "near_south", name: "Ивановка / Весенний", price_small: 2300, price_medium: 2900, price_large: 4500 },
    { id: "demo-north", key: "near_north", name: "Подгородняя Покровка", price_small: 2400, price_medium: 3000, price_large: 4600 },
    { id: "demo-dachi", key: "dachi", name: "СНТ Дубки / Ростоши", price_small: 2500, price_medium: 3200, price_large: 5000 },
    { id: "demo-far", key: "far", name: "Дальний пригород", price_small: 3500, price_medium: 4300, price_large: 6500 }
  ]
};

const state = {
  materials: [...DEFAULTS.materials],
  trucks: [...DEFAULTS.trucks],
  zones: [...DEFAULTS.zones],
  selectedMaterialId: DEFAULTS.materials[0].id,
  tons: 10,
  calcMode: "weight",
  areaLength: 6,
  areaWidth: 4,
  areaDepth: 15,
  zoneKey: "city",
  gate: "normal",
  messenger: CFG.preferredMessenger === "telegram" ? "telegram" : "max",
  lastMessage: "",
  liveDataReady: true
};

const $ = (id) => document.getElementById(id);

const money = (value) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })
    .format(Math.round(Number(value) || 0)) + " ₽";

const safeText = (value, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function imageFor(item) {
  if (item.image_path) return publicImageUrl(item.image_path);
  if (item._fallback) return item._fallback;

  if (item.class_key === "small") return "assets/default-truckZil.jpg";
  if (item.class_key === "large") return "assets/default-truckShacman.jpg";
  if (item.class_key === "medium") return "assets/default-truckKamaz.jpg";

  const name = String(item.name || "").toLowerCase();

  if (name.includes("черноз") || name.includes("земл")) return "assets/default-soil.jpg";
  if (name.includes("щеб") || name.includes("пгс") || name.includes("грав")) return "assets/default-gravel.jpg";

  return "assets/default-sand.jpg";
}

function selectedMaterial() {
  return state.materials.find(
    (x) => String(x.id) === String(state.selectedMaterialId)
  ) || state.materials[0];
}

function zoneNow() {
  return state.zones.find((x) => x.key === state.zoneKey) || state.zones[0] || {
    name: CFG.city || "Город",
    price_small: 0,
    price_medium: 0,
    price_large: 0
  };
}

function validHttpsUrl(value, fallback = "") {
  try {
    const u = new URL(value || fallback);
    return u.protocol === "https:" ? u.href : fallback;
  } catch {
    return fallback;
  }
}

function applyCompanyConfig() {
  document.title = safeText(
    CFG.pageTitle,
    `${safeText(CFG.companyName, "Компания")} — доставка материалов`
  );

  setText("brandName", safeText(CFG.companyName, "Название компании"));
  setText("footerBrand", safeText(CFG.companyName, "Компания"));
  setText("brandTagline", safeText(CFG.tagline, `Доставка по городу ${safeText(CFG.city, "")}`));
  setText("footerCity", `Доставка по городу ${safeText(CFG.city, "и району")}`);
  setText("headerPhoneText", safeText(CFG.phoneDisplay, "Позвонить"));
  setText("heroTitle", safeText(CFG.heroTitle, "Доставка сыпучих материалов"));
  setText("heroText", safeText(CFG.heroText, "Рассчитайте примерную стоимость онлайн."));

  const tel = String(CFG.phoneTel || "").replace(/[^+\d]/g, "");
  $("headerPhone").href = /^\+?\d{10,15}$/.test(tel) ? `tel:${tel}` : "#calculator";

  if (!CFG.maxUrl || CFG.maxUrl === "https://max.ru/") {
    $("maxChoice").title = "Впишите ссылку на MAX в site-config.js";
  }

  if (!CFG.telegramUrl || CFG.telegramUrl === "https://t.me/") {
    $("telegramChoice").title = "Впишите ссылку на Telegram в site-config.js";
  }

  if (CFG.preferredMessenger === "max") {
    $("telegramChoice").classList.add("configured-hidden");
  }

  if (CFG.preferredMessenger === "telegram") {
    $("maxChoice").classList.add("configured-hidden");
  }

  const hero = $("heroPhoto");

  if (hero) {
    hero.src = validHttpsUrl(CFG.heroImage, "") ||
      (String(CFG.heroImage || "").startsWith("assets/")
        ? CFG.heroImage
        : "assets/default-hero.jpg");
  }

  if (/^#[0-9a-f]{6}$/i.test(String(CFG.accentColor || ""))) {
    document.documentElement.style.setProperty("--amber", CFG.accentColor);
  }

  const mark = document.querySelector(".brand-mark");
  if (mark) mark.textContent = safeText(CFG.logoEmoji, "🚛");
}

function loadCachedData() {
  try {
    const slug = String(CFG.tenantSlug || "default");
    const raw = localStorage.getItem(`orengruz_cache_${slug}`);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.materials) && parsed.materials.length) {
      state.materials = parsed.materials;
      state.trucks = parsed.trucks || state.trucks;
      state.zones = parsed.zones || state.zones;
      state.selectedMaterialId = state.materials[0].id;
      state.zoneKey = state.zones[0].key;
    }
  } catch (e) {}
}

async function loadTenantData() {
  if (!isSupabaseConfigured) return;

  try {
    const slug = String(CFG.tenantSlug || "");
    const [materials, trucks, zones] = await Promise.all([
      fetchPublicTable("materials", slug),
      fetchPublicTable("trucks", slug),
      fetchPublicTable("delivery_zones", slug)
    ]);

    if (!materials.length || !trucks.length || !zones.length) return;

    state.materials = materials;
    state.trucks = trucks;
    state.zones = zones;
    if (!state.materials.some((x) => String(x.id) === String(state.selectedMaterialId))) {
      state.selectedMaterialId = state.materials[0].id;
    }
    if (!state.zones.some((x) => x.key === state.zoneKey)) {
      state.zoneKey = state.zones[0].key;
    }
    state.liveDataReady = true;
    $("backendNotice").hidden = true;

    try {
      localStorage.setItem(`orengruz_cache_${slug}`, JSON.stringify({ materials, trucks, zones }));
    } catch (e) {}

    renderZones();
    renderDetails();
    renderMaterials();
    updateUI();
  } catch (error) {
    console.warn("Работаем на кэшированном/базовом прайсе (мобильная сеть ограничила доступ к Supabase):", error);
    state.liveDataReady = true;
    $("backendNotice").hidden = true;
  }
}

/* ===== КАРТОЧКИ МАТЕРИАЛОВ ===== */

function renderMaterials() {
  const grid = $("materialGrid");
  grid.replaceChildren();

  state.materials.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "material-choice";
    button.dataset.materialId = String(item.id);

    const img = document.createElement("img");
    img.src = imageFor(item);
    img.alt = "";
    img.loading = "lazy";

    const copy = document.createElement("span");

    const name = document.createElement("strong");
    name.textContent = item.name;

    const price = document.createElement("small");
    price.textContent = `${money(item.price_per_ton)} / т`;

    copy.append(name, price);
    button.append(img, copy);

    button.addEventListener("click", () => {
      state.selectedMaterialId = item.id;
      updateUI();
    });

    grid.append(button);
  });

  updateMaterialSelection();
}

function updateMaterialSelection() {
  document.querySelectorAll(".material-choice").forEach((button) => {
    const isActive =
      button.dataset.materialId === String(state.selectedMaterialId);

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderZones() {
  const select = $("zoneSelect");
  select.replaceChildren();

  state.zones.forEach((zone) => {
    const option = document.createElement("option");
    option.value = zone.key;
    option.textContent = zone.name;
    select.append(option);
  });

  if (state.zones.some((z) => z.key === state.zoneKey)) {
    select.value = state.zoneKey;
  } else if (state.zones[0]) {
    state.zoneKey = state.zones[0].key;
    select.value = state.zoneKey;
  }
}

function renderDetails() {
  const catalog = $("catalogGrid");
  catalog.replaceChildren();

  state.materials.forEach((m) => {
    const card = document.createElement("article");
    card.className = "catalog-card";

    const img = document.createElement("img");
    img.src = imageFor(m);
    img.alt = m.name;
    img.loading = "lazy";

    const body = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = m.name;

    const desc = document.createElement("p");
    desc.textContent = m.description || "Сыпучий материал";

    const price = document.createElement("small");
    price.textContent = `${money(m.price_per_ton)} за тонну`;

    body.append(title, desc, price);
    card.append(img, body);
    catalog.append(card);
  });

  const fleet = $("fleetGrid");
  fleet.replaceChildren();

  state.trucks.forEach((t) => {
    const card = document.createElement("article");
    card.className = "fleet-card";

    const img = document.createElement("img");
    img.src = imageFor(t);
    img.alt = t.name;
    img.loading = "lazy";

    const body = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = t.name;

    const desc = document.createElement("p");
    desc.textContent = t.description || `Грузоподъёмность до ${t.max_tons} т`;

    body.append(title, desc);
    card.append(img, body);
    fleet.append(card);
  });
}

function recalculateTonsFromArea() {
  const m = selectedMaterial();
  const volume = state.areaLength * state.areaWidth * (state.areaDepth / 100);

  state.tons = Math.max(1, Math.ceil(volume * Number(m?.density || 1.4)));

  setText(
    "areaResult",
    `Площадь: ${(state.areaLength * state.areaWidth).toFixed(1)} м² · Объём: ${volume.toFixed(2)} м³ · Масса: примерно ${state.tons} т`
  );
}

function recommendedTruck() {
  const trucks = [...state.trucks].sort(
    (a, b) => Number(a.max_tons) - Number(b.max_tons)
  );

  if (!trucks.length) return null;

  if (state.gate === "narrow") {
    const compact = trucks.filter((t) => t.class_key === "small");

    return compact.find((t) => Number(t.max_tons) >= state.tons) ||
      compact[0] ||
      trucks.find((t) => Number(t.max_tons) >= state.tons) ||
      trucks[0];
  }

  if (state.gate === "side") {
    const sideUnload = trucks.filter((t) => t.side_unload);

    return sideUnload.find((t) => Number(t.max_tons) >= state.tons) ||
      sideUnload[sideUnload.length - 1] ||
      trucks.find((t) => t.class_key === "medium" && Number(t.max_tons) >= state.tons) ||
      trucks[0];
  }

  return trucks.find((t) => Number(t.max_tons) >= state.tons) ||
    trucks[trucks.length - 1];
}

function truckTripCount(truck) {
  const capacity = Math.max(
    0.1,
    Number(truck?.max_tons) || state.tons || 1
  );

  return Math.max(1, Math.ceil(state.tons / capacity));
}

/* ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ===== */

function updateUI() {
  if (!state.materials.length) return;

  if (state.calcMode === "area") {
    recalculateTonsFromArea();
  }

  const material = selectedMaterial();
  const truck = recommendedTruck();
  const zone = zoneNow();

  if (!material || !truck) return;

  const density = Number(material.density) || 1.4;
  const cubes = state.tons / density;

  const classKey = ["small", "medium", "large"].includes(truck.class_key)
    ? truck.class_key
    : "medium";

  const rawZonePrice = zone[`price_${classKey}`];

  const deliveryBase =
    rawZonePrice !== null && rawZonePrice !== undefined
      ? Number(rawZonePrice)
      : Number(truck.base_delivery_price || 0);

  const trips = truckTripCount(truck);
  const delivery = deliveryBase * trips;
  const materialCost = state.tons * Number(material.price_per_ton || 0);
  const total = materialCost + delivery;

  const spread =
    Math.max(0, Math.min(30, Number(CFG.priceSpreadPercent) || 7)) / 100;

  const low = total * (1 - spread);
  const high = total * (1 + spread);

  // Обновляем только выделение, не пересоздаём карточки и изображения.
  updateMaterialSelection();

  setText("densityBadge", `Плотность ${density.toLocaleString("ru-RU")} т/м³`);
  setText("tonsValue", String(state.tons));
  setText("cubesValue", `≈ ${cubes.toFixed(1).replace(".", ",")} м³`);

  $("tonsRange").value = String(state.tons);

  document.querySelectorAll("[data-tons]").forEach((b) => {
    b.classList.toggle("selected", Number(b.dataset.tons) === state.tons);
  });

  setText("summaryQuantity", `${state.tons} т (≈ ${cubes.toFixed(1).replace(".", ",")} м³)`);
  setText("summaryMaterial", material.name);
  setText("summaryTruck", truck.name);

  const truckNote =
    truck.description || `Грузоподъёмность до ${truck.max_tons} т`;

  const sideNote =
    state.gate === "side" && !truck.side_unload
      ? " В автопарке нет подтверждённой техники с боковой выгрузкой — уточните у менеджера."
      : "";

  setText(
    "summaryTruckNote",
    `${truckNote} · ${trips} ${trips === 1 ? "рейс" : trips < 5 ? "рейса" : "рейсов"}.${sideNote}`
  );

  // Меняем фотографию только тогда, когда действительно выбран другой материал.
  const summaryPhoto = $("summaryPhoto");
  const nextPhoto = imageFor(material);

  if (summaryPhoto && summaryPhoto.getAttribute("src") !== nextPhoto) {
    summaryPhoto.src = nextPhoto;
  }

  setText("materialRate", `Материал (${money(material.price_per_ton)}/т):`);
  setText("materialCost", money(materialCost));
  setText("deliveryRate", `Доставка (${zone.name}):`);
  setText("deliveryCost", `~${money(delivery)}${trips > 1 ? ` · ${trips} рейса` : ""}`);
  setText("totalPrice", `от ${money(low)} до ${money(high)}`);

  if (state.calcMode === "area") {
    const volume = state.areaLength * state.areaWidth * (state.areaDepth / 100);

    setText(
      "areaResult",
      `Площадь: ${(state.areaLength * state.areaWidth).toFixed(1)} м² · Объём: ${volume.toFixed(2)} м³ · Масса: примерно ${state.tons} т`
    );
  }
}

function setMode(mode) {
  if (mode === "weight") {
    state.tons = Math.max(1, Math.min(30, state.tons));
  }

  state.calcMode = mode;

  $("weightPanel").hidden = mode !== "weight";
  $("areaPanel").hidden = mode !== "area";

  $("weightModeBtn").classList.toggle("active", mode === "weight");
  $("areaModeBtn").classList.toggle("active", mode === "area");

  updateUI();
}

/* ===== МАСКА ТЕЛЕФОНА ===== */

function formatPhoneInput(value) {
  let digits = String(value).replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  } else if (digits.startsWith("9")) {
    digits = "7" + digits;
  } else if (!digits.startsWith("7")) {
    digits = "7" + digits;
  }

  digits = digits.slice(0, 11);

  let out = "+7";

  if (digits.length > 1) {
    out += " (" + digits.slice(1, 4);
  }

  if (digits.length >= 4) {
    out += ") " + digits.slice(4, 7);
  }

  if (digits.length >= 7) {
    out += "-" + digits.slice(7, 9);
  }

  if (digits.length >= 9) {
    out += "-" + digits.slice(9, 11);
  }

  return out;
}

function validCustomerPhone(value) {
  const digits = value.replace(/\D/g, "");

  return digits.length === 11 &&
    digits[0] === "7" &&
    !/^([0-9])\1{6}$/.test(digits.slice(4));
}

function countDigitsBefore(value, position) {
  return value.slice(0, position).replace(/\D/g, "").length;
}

function positionAfterDigits(value, count) {
  if (count <= 0) return 0;

  let digitsFound = 0;

  for (let i = 0; i < value.length; i++) {
    if (/\d/.test(value[i])) {
      digitsFound++;
    }

    if (digitsFound >= count) {
      return i + 1;
    }
  }

  return value.length;
}

function setupPhoneInput() {
  const input = $("customerPhone");

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Backspace" && event.key !== "Delete") return;

    const start = input.selectionStart;
    const end = input.selectionEnd;

    if (start !== end) return;

    const value = input.value;

    if (event.key === "Backspace" && start > 0) {
      let position = start - 1;

      while (position >= 0 && !/\d/.test(value[position])) {
        position--;
      }

      if (position >= 0) {
        event.preventDefault();

        const newValue =
          value.slice(0, position) +
          value.slice(position + 1);

        input.value = formatPhoneInput(newValue);

        const digitsBefore = countDigitsBefore(
          value.slice(0, position),
          position
        );

        const newPosition = positionAfterDigits(
          input.value,
          digitsBefore
        );

        input.setSelectionRange(newPosition, newPosition);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    if (event.key === "Delete" && start < value.length) {
      let position = start;

      while (position < value.length && !/\d/.test(value[position])) {
        position++;
      }

      if (position < value.length) {
        event.preventDefault();

        const newValue =
          value.slice(0, position) +
          value.slice(position + 1);

        input.value = formatPhoneInput(newValue);

        const digitsBefore = countDigitsBefore(value, start);

        const newPosition = positionAfterDigits(
          input.value,
          digitsBefore
        );

        input.setSelectionRange(newPosition, newPosition);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });

  input.addEventListener("input", (event) => {
    const target = event.target;
    const cursor = target.selectionStart ?? target.value.length;
    const digitsBefore = countDigitsBefore(target.value, cursor);

    const formatted = formatPhoneInput(target.value);

    target.value = formatted;

    const newPosition = positionAfterDigits(
      formatted,
      digitsBefore
    );

    target.setSelectionRange(newPosition, newPosition);

    $("phoneError").hidden = true;
  });

  input.addEventListener("paste", () => {
    setTimeout(() => {
      input.value = formatPhoneInput(input.value);

      const position = input.value.length;
      input.setSelectionRange(position, position);
    }, 0);
  });
}

/* ===== КОПИРОВАНИЕ И ЗАЯВКИ ===== */

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const el = document.createElement("textarea");

    el.value = value;
    el.style.position = "fixed";
    el.style.opacity = "0";

    document.body.append(el);
    el.select();

    const ok = document.execCommand("copy");

    el.remove();
    return ok;
  }
}

function messengerUrl(channel, message) {
  if (channel === "telegram") {
    const base = validHttpsUrl(CFG.telegramUrl, "https://t.me/");
    const isShare = base === "https://t.me/";

    return isShare
      ? `https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(message)}`
      : `${base.replace(/\/$/, "")}?text=${encodeURIComponent(message)}`;
  }

  return validHttpsUrl(CFG.maxUrl, "https://max.ru/");
}

function buildMessage() {
  const material = selectedMaterial();
  const truck = recommendedTruck();
  const zone = zoneNow();

  const date = $("deliveryDate").value;
  const [y, m, d] = date.split("-");
  const dateRu = `${d}.${m}.${y}`;

  const time = $("deliveryTime").value || "По согласованию";
  const phone = $("customerPhone").value.trim();
  const address = $("customerAddress").value.trim() || "Не указан";

  const materialCost = state.tons * Number(material.price_per_ton || 0);

  const classKey = ["small", "medium", "large"].includes(truck.class_key)
    ? truck.class_key
    : "medium";

  const rawZonePrice = zone[`price_${classKey}`];

  const deliveryBase =
    rawZonePrice !== null && rawZonePrice !== undefined
      ? Number(rawZonePrice)
      : Number(truck.base_delivery_price || 0);

  const trips = truckTripCount(truck);
  const delivery = deliveryBase * trips;
  const total = materialCost + delivery;

  const spread =
    Math.max(0, Math.min(30, Number(CFG.priceSpreadPercent) || 7)) / 100;

  return [
    `Заявка на доставку — ${safeText(CFG.companyName, "Компания")}`,
    `Материал: ${material.name}`,
    `Количество: ${state.tons} т (около ${(state.tons / Number(material.density || 1.4)).toFixed(1)} м³)`,
    `Техника: ${truck.name}`,
    `Количество рейсов: ${trips}`,
    `Район: ${zone.name}`,
    `Дата: ${dateRu}, ${time}`,
    `Ориентировочная стоимость: от ${money(total * (1 - spread))} до ${money(total * (1 + spread))}`,
    `Телефон: ${phone}`,
    `Адрес / ориентир: ${address}`
  ].join("\n");
}

function showError(message) {
  const el = $("phoneError");
  el.textContent = message;
  el.hidden = false;
}

/* ===== ИНИЦИАЛИЗАЦИЯ ===== */

function initializeControls() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateIso =
    `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  $("deliveryDate").min = dateIso;
  $("deliveryDate").value = dateIso;

  $("tonsRange").addEventListener("input", (e) => {
    state.tons = Number(e.target.value);

    if (state.calcMode === "area") {
      setMode("weight");
    }

    updateUI();
  });

  document.querySelectorAll("[data-tons]").forEach((b) => {
    b.addEventListener("click", () => {
      state.tons = Number(b.dataset.tons);

      if (state.calcMode === "area") {
        setMode("weight");
      }

      updateUI();
    });
  });

  $("weightModeBtn").addEventListener("click", () => setMode("weight"));
  $("areaModeBtn").addEventListener("click", () => setMode("area"));

  ["areaLength", "areaWidth", "areaDepth"].forEach((id) => {
    $(id).addEventListener("input", () => {
      state.areaLength = Math.max(.5, Math.min(200, Number($("areaLength").value) || 1));
      state.areaWidth = Math.max(.5, Math.min(200, Number($("areaWidth").value) || 1));
      state.areaDepth = Math.max(1, Math.min(150, Number($("areaDepth").value) || 1));

      updateUI();
    });
  });

  $("zoneSelect").addEventListener("change", (e) => {
    state.zoneKey = e.target.value;
    updateUI();
  });

  $("gateSelect").addEventListener("change", (e) => {
    state.gate = e.target.value;
    updateUI();
  });

  setupPhoneInput();

  $("maxChoice").addEventListener("click", () => {
    state.messenger = "max";
    $("maxChoice").classList.add("active");
    $("telegramChoice").classList.remove("active");
  });

  $("telegramChoice").addEventListener("click", () => {
    state.messenger = "telegram";
    $("telegramChoice").classList.add("active");
    $("maxChoice").classList.remove("active");
  });

  $("geoButton").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showError("Ваш браузер не поддерживает геолокацию. Введите адрес вручную.");
      return;
    }

    $("geoButton").textContent = "Определяем местоположение…";

    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const url = `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=17`;
      const field = $("customerAddress");

      field.value =
        `${field.value.trim()} ${field.value.trim() ? "| " : ""}Метка участка: ${url}`;

      $("geoButton").textContent = "✓ Геолокация добавлена";

    }, () => {
      $("geoButton").textContent = "📍 Прикрепить геолокацию участка";
      showError("Не удалось получить геолокацию. Разрешите доступ или введите адрес вручную.");
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000
    });
  });

  $("orderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("phoneError").hidden = true;

    if (!state.liveDataReady) {
      showError("Сайт пока работает в режиме предпросмотра. Отправка заявки будет доступна после подключения базы и загрузки реальных цен компании.");
      return;
    }

    const phone = $("customerPhone").value.trim();

    if (!validCustomerPhone(phone)) {
      showError("Введите полный российский номер телефона, например +7 (912) 345-67-89.");
      $("customerPhone").focus();
      return;
    }

    if (!$("deliveryDate").value) {
      showError("Выберите дату доставки.");
      return;
    }

    if ($("deliveryDate").value < dateIso) {
      showError("Дата доставки не может быть в прошлом.");
      return;
    }

    state.lastMessage = buildMessage();

    await copyText(state.lastMessage);

    $("orderMessage").textContent = state.lastMessage;
    $("openMessenger").href = messengerUrl(state.messenger, state.lastMessage);
    $("openMessenger").textContent =
      state.messenger === "max" ? "Открыть MAX" : "Открыть Telegram";

    const note = $("orderResult").querySelector("small");

    note.textContent =
      state.messenger === "max"
        ? "Текст заявки скопирован. Откройте чат компании в MAX, вставьте текст и нажмите «Отправить». Сайт не заявляет, что сообщение уже доставлено."
        : "Проверьте подготовленное сообщение в Telegram и нажмите «Отправить». Сайт не заявляет, что сообщение уже доставлено.";

    $("orderResult").hidden = false;

    $("orderResult").scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  });

  $("copyMessage").addEventListener("click", async () => {
    const ok = await copyText(state.lastMessage);

    $("copyMessage").textContent =
      ok ? "Скопировано" : "Не удалось скопировать";

    setTimeout(() => {
      $("copyMessage").textContent = "Скопировать";
    }, 1800);
  });

  $("detailsToggle").addEventListener("click", () => {
    const isOpen = !$("detailsBody").hidden;

    $("detailsBody").hidden = isOpen;
    $("detailsToggle").setAttribute("aria-expanded", String(!isOpen));

    setText("detailsChevron", isOpen ? "＋" : "−");
  });
}

/* ===== ЗАПУСК ===== */

(function start() {
  applyCompanyConfig();
  loadCachedData();
  initializeControls();

  // Отрисовываем калькулятор МГНОВЕННО (за 0.05 сек), не дожидаясь ответа сети!
  renderZones();
  renderDetails();
  renderMaterials();
  updateUI();

  if (CFG.preferredMessenger === "telegram") {
    $("telegramChoice").click();
  } else {
    $("maxChoice").click();
  }

  // В фоне подтягиваем свежие цены из Supabase без блокировки интерфейса
  loadTenantData();
})();