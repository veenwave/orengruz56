import {
  getSupabaseAsync,
  isSupabaseConfigured,
  publicImageUrl
} from "./supabase-client.js";

const CFG = window.SITE_CONFIG || {};
const supabase = isSupabaseConfigured ? await getSupabaseAsync() : null;
const $ = (id) => document.getElementById(id);
const slug = String(CFG.tenantSlug || "");

let currentUser = null;
let activeTab = "materials";

function status(message, type = "") {
  const el = $("dashboardStatus");
  if (!el) return;

  el.textContent = message;
  el.className = `admin-status ${type}`;
}

function loginStatus(message, type = "error") {
  const el = $("loginStatus");
  el.textContent = message;
  el.className = `admin-status ${type}`;
}

function money(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0
  }).format(Number(value) || 0) + " ₽";
}

function make(tag, className, text) {
  const el = document.createElement(tag);

  if (className) el.className = className;
  if (text !== undefined && text !== null) {
    el.textContent = text;
  }

  return el;
}

function setLoggedIn(show) {
  $("loginCard").classList.toggle("hidden", show);
  $("dashboard").classList.toggle("hidden", !show);
}

async function verifyMembership(user) {
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_slug,role")
    .eq("tenant_slug", slug)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "У этой учётной записи нет доступа к панели именно этой компании. Обратитесь к разработчику сайта."
    );
  }

  return data;
}

// ЗАГРУЗКА ФОТОГРАФИИ В SUPABASE STORAGE
async function uploadPhoto(file, folder) {
  if (!file) return null;

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowed.includes(file.type)) {
    throw new Error("Допустимы только JPG, PNG или WebP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      "Файл больше 5 МБ. Выберите фотографию меньшего размера."
    );
  }

  const blob = await compressImage(file, 1400, 0.84);

  if (!blob) {
    throw new Error("Не удалось обработать фотографию.");
  }

  const objectName =
    `${slug}/${folder}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase
    .storage
    .from("tenant-assets")
    .upload(objectName, blob, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  console.log("Фотография загружена:", objectName);

  return objectName;
}

// СЖАТИЕ ФОТОГРАФИИ
async function compressImage(file, maxSide, quality) {
  let bitmap;

  if ("createImageBitmap" in window) {
    bitmap = await createImageBitmap(file);
  } else {
    bitmap = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error("Не удалось прочитать фотографию."));
      };

      reader.onload = () => {
        const img = new Image();

        img.onerror = () => {
          reject(new Error("Файл не является корректной фотографией."));
        };

        img.onload = () => resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          drawImage: img,
          close() {}
        });

        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  const ratio = Math.min(
    1,
    maxSide / Math.max(bitmap.width, bitmap.height)
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(
    1,
    Math.round(bitmap.width * ratio)
  );

  canvas.height = Math.max(
    1,
    Math.round(bitmap.height * ratio)
  );

  const ctx = canvas.getContext("2d", {
    alpha: false
  });

  if (!ctx) {
    throw new Error(
      "Не удалось обработать изображение в браузере."
    );
  }

  ctx.drawImage(
    bitmap.drawImage || bitmap,
    0,
    0,
    canvas.width,
    canvas.height
  );

  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error("Не удалось сжать изображение.")
          );
        }
      },
      "image/webp",
      quality
    );
  });
}

// УДАЛЕНИЕ ФОТОГРАФИИ ИЗ STORAGE
async function removeOldPhoto(path) {
  if (!path) return;

  const { error } = await supabase
    .storage
    .from("tenant-assets")
    .remove([path]);

  if (error) {
    console.warn(
      "Не удалось удалить прежнее фото:",
      error.message
    );
  }
}

// ПОЛУЧЕНИЕ ССЫЛКИ НА ИЗОБРАЖЕНИЕ
function imageUrl(path, fallback) {
  return path ? publicImageUrl(path) : fallback;
}

// ПОДБОР СТАНДАРТНОЙ ФОТОГРАФИИ ПО НАЗВАНИЮ МАТЕРИАЛА
function materialFallback(name) {
  const value = String(name || "").toLowerCase();

  if (value.includes("щеб")) {
    return "assets/default-gravel.jpg";
  }

  if (
    value.includes("черноз") ||
    value.includes("грунт")
  ) {
    return "assets/default-soil.jpg";
  }

  if (
    value.includes("пгс") ||
    value.includes("опгс")
  ) {
    return "assets/default-gravel.jpg";
  }

  return "assets/default-sand.jpg";
}

// ПОДБОР СТАНДАРТНОЙ ФОТОГРАФИИ ПО НАЗВАНИЮ ТЕХНИКИ
function truckFallback(name) {
  const value = String(name || "").toLowerCase();

  if (
    value.includes("shacman") ||
    value.includes("шакман") ||
    value.includes("шacман")
  ) {
    return "assets/default-truckShacman.jpg";
  }

  if (
    value.includes("зил") ||
    value.includes("zil")
  ) {
    return "assets/default-truckZil.jpg";
  }

  return "assets/default-truckKamaz.jpg";
}

// СОЗДАНИЕ ПОЛЯ В ФОРМЕ
function makeInput(
  label,
  value,
  key,
  type = "text",
  min = null,
  max = null,
  step = null
) {
  const wrap = make("label", "admin-field");

  wrap.append(make("span", "", label));

  const input = document.createElement("input");

  input.type = type;
  input.dataset.key = key;

  if (value !== null && value !== undefined) {
    input.value = value;
  }

  if (min !== null) input.min = min;
  if (max !== null) input.max = max;
  if (step !== null) input.step = step;

  if (type === "number") {
    input.required = true;
  }

  wrap.append(input);

  return wrap;
}

// ЗАГРУЗКА МАТЕРИАЛОВ
async function loadMaterials() {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("tenant_slug", slug)
    .order("sort_order", {
      ascending: true
    });

  if (error) throw error;

  const list = $("materialsList");
  list.replaceChildren();

  if (!data.length) {
    list.append(
      make(
        "p",
        "admin-help",
        "Материалов пока нет. Добавьте первый материал ниже."
      )
    );
  }

  data.forEach((item) => {
    const form = make("form", "admin-item");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btn = form.querySelector('[type="submit"]');

      btn.disabled = true;
      btn.textContent = "Сохраняем…";

      let uploadedPath = null;

      try {
        const oldPath = item.image_path;

        const file = form
          .querySelector('input[type="file"]')
          .files[0];

        const newPath = file
          ? await uploadPhoto(file, "materials")
          : oldPath;

        if (file) uploadedPath = newPath;

        const payload = {
          name: form.querySelector('[data-key="name"]').value.trim(),

          description: form
            .querySelector('[data-key="description"]')
            .value.trim(),

          price_per_ton: Number(
            form.querySelector('[data-key="price_per_ton"]').value
          ),

          density: Number(
            form.querySelector('[data-key="density"]').value
          ),

          image_path: newPath,

          is_active: form
            .querySelector('[data-key="is_active"]')
            .checked
        };

        if (
          !payload.name ||
          payload.price_per_ton <= 0 ||
          payload.density <= 0
        ) {
          throw new Error(
            "Проверьте название, цену и плотность — значения должны быть корректными."
          );
        }

        const { data: savedData, error: saveError } = await supabase
          .from("materials")
          .update(payload)
          .eq("id", item.id)
          .eq("tenant_slug", slug)
          .select("id, image_path")
          .single();

        if (saveError) throw saveError;

        if (!savedData || savedData.image_path !== newPath) {
          throw new Error(
            "Данные сохранены, но путь к фотографии не совпадает с ожидаемым."
          );
        }

        uploadedPath = null;

        if (file && oldPath) {
          await removeOldPhoto(oldPath);
        }

        status(
          "Материал сохранён. На сайте изменения появятся после обновления страницы.",
          "success"
        );

        await loadMaterials();

      } catch (err) {
        console.error("Ошибка сохранения материала:", err);

        if (uploadedPath) {
          await removeOldPhoto(uploadedPath);
        }

        status(
          err.message || "Не удалось сохранить материал.",
          "error"
        );

        btn.disabled = false;
        btn.textContent = "Сохранить";
      }
    });

    // ПРЕВЬЮ ФОТОГРАФИИ МАТЕРИАЛА
    const preview = document.createElement("img");

    preview.src = imageUrl(
      item.image_path,
      materialFallback(item.name)
    );

    preview.alt = item.name;

    form.append(preview);

    const fields = make("div", "admin-item-fields");

    fields.append(
      makeInput(
        "Название",
        item.name,
        "name"
      ),

      makeInput(
        "Цена за тонну, ₽",
        item.price_per_ton,
        "price_per_ton",
        "number",
        1,
        10000000,
        1
      ),

      makeInput(
        "Плотность, т/м³",
        item.density,
        "density",
        "number",
        0.1,
        10,
        0.01
      ),

      makeInput(
        "Описание",
        item.description || "",
        "description"
      )
    );

    const photo = make("label", "admin-field wide");

    photo.append(
      make("span", "", "Заменить фотографию (до 5 МБ)")
    );

    const file = document.createElement("input");

    file.type = "file";
    file.accept = "image/jpeg,image/png,image/webp";

    photo.append(file);
    fields.append(photo);

    const show = make("label", "admin-help wide");

    const check = document.createElement("input");

    check.type = "checkbox";
    check.checked = item.is_active;
    check.dataset.key = "is_active";

    show.append(
      check,
      document.createTextNode(" Показывать материал на сайте")
    );

    fields.append(show);

    const actions = make("div", "admin-actions wide");

    const save = make(
      "button",
      "admin-primary",
      "Сохранить"
    );

    save.type = "submit";

    const del = make(
      "button",
      "admin-danger",
      "Удалить"
    );

    del.type = "button";

    del.addEventListener("click", async () => {
      if (!confirm(`Удалить материал «${item.name}»?`)) {
        return;
      }

      del.disabled = true;

      const { error: delError } = await supabase
        .from("materials")
        .delete()
        .eq("id", item.id)
        .eq("tenant_slug", slug);

      if (delError) {
        status(delError.message, "error");
        del.disabled = false;
        return;
      }

      await removeOldPhoto(item.image_path);

      status("Материал удалён.", "success");

      await loadMaterials();
    });

    actions.append(save, del);
    fields.append(actions);
    form.append(fields);
    list.append(form);
  });
}

// ЗАГРУЗКА АВТОПАРКА
async function loadTrucks() {
  const { data, error } = await supabase
    .from("trucks")
    .select("*")
    .eq("tenant_slug", slug)
    .order("sort_order", {
      ascending: true
    });

  if (error) throw error;

  const list = $("trucksList");

  list.replaceChildren();

  if (!data.length) {
    list.append(
      make(
        "p",
        "admin-help",
        "Техника пока не добавлена."
      )
    );
  }

  data.forEach((item) => {
    const form = make("form", "admin-item");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btn = form.querySelector('[type="submit"]');

      btn.disabled = true;
      btn.textContent = "Сохраняем…";

      let uploadedPath = null;

      try {
        const oldPath = item.image_path;

        const file = form
          .querySelector('input[type="file"]')
          .files[0];

        const newPath = file
          ? await uploadPhoto(file, "trucks")
          : oldPath;

        if (file) uploadedPath = newPath;

        const payload = {
          name: form.querySelector('[data-key="name"]').value.trim(),

          description: form
            .querySelector('[data-key="description"]')
            .value.trim(),

          max_tons: Number(
            form.querySelector('[data-key="max_tons"]').value
          ),

          base_delivery_price: Number(
            form.querySelector('[data-key="base_delivery_price"]').value
          ),

          class_key: form
            .querySelector('[data-key="class_key"]')
            .value,

          side_unload: form
            .querySelector('[data-key="side_unload"]')
            .checked,

          image_path: newPath,

          is_active: form
            .querySelector('[data-key="is_active"]')
            .checked
        };

        if (
          !payload.name ||
          payload.max_tons <= 0 ||
          payload.base_delivery_price < 0
        ) {
          throw new Error(
            "Проверьте название, грузоподъёмность и цену подачи."
          );
        }

        const { data: savedData, error: saveError } = await supabase
          .from("trucks")
          .update(payload)
          .eq("id", item.id)
          .eq("tenant_slug", slug)
          .select("id, image_path")
          .single();

        if (saveError) throw saveError;

        if (!savedData || savedData.image_path !== newPath) {
          throw new Error(
            "Не удалось подтвердить сохранение фотографии техники."
          );
        }

        uploadedPath = null;

        if (file && oldPath) {
          await removeOldPhoto(oldPath);
        }

        status("Данные техники сохранены.", "success");

        await loadTrucks();

      } catch (err) {
        console.error("Ошибка сохранения техники:", err);

        if (uploadedPath) {
          await removeOldPhoto(uploadedPath);
        }

        status(
          err.message || "Не удалось сохранить технику.",
          "error"
        );

        btn.disabled = false;
        btn.textContent = "Сохранить";
      }
    });

    const preview = document.createElement("img");

    // ТЕПЕРЬ ДЛЯ КАЖДОЙ МАШИНЫ ПОДБИРАЕТСЯ СВОЯ ЗАГЛУШКА
    preview.src = imageUrl(
      item.image_path,
      truckFallback(item.name)
    );

    preview.alt = item.name;

    form.append(preview);

    const fields = make("div", "admin-item-fields");

    fields.append(
      makeInput(
        "Название",
        item.name,
        "name"
      ),

      makeInput(
        "Грузоподъёмность, т",
        item.max_tons,
        "max_tons",
        "number",
        1,
        100,
        1
      ),

      makeInput(
        "Базовая подача, ₽",
        item.base_delivery_price,
        "base_delivery_price",
        "number",
        0,
        10000000,
        100
      )
    );

    const classWrap = make("label", "admin-field");

    classWrap.append(
      make("span", "", "Категория тарифа")
    );

    const classSelect = document.createElement("select");

    classSelect.dataset.key = "class_key";

    [
      ["small", "Малый самосвал"],
      ["medium", "Средний самосвал"],
      ["large", "Большой самосвал"]
    ].forEach(([v, label]) => {
      const o = document.createElement("option");

      o.value = v;
      o.textContent = label;

      classSelect.append(o);
    });

    classSelect.value = item.class_key || "medium";

    classWrap.append(classSelect);
    fields.append(classWrap);

    fields.append(
      makeInput(
        "Описание",
        item.description || "",
        "description"
      )
    );

    const sideWrap = make("label", "admin-help wide");

    const side = document.createElement("input");

    side.type = "checkbox";
    side.checked = Boolean(item.side_unload);
    side.dataset.key = "side_unload";

    sideWrap.append(
      side,
      document.createTextNode(
        " Машина умеет выполнять боковую выгрузку"
      )
    );

    fields.append(sideWrap);

    const photo = make("label", "admin-field wide");

    photo.append(
      make("span", "", "Заменить фотографию (до 5 МБ)")
    );

    const file = document.createElement("input");

    file.type = "file";
    file.accept = "image/jpeg,image/png,image/webp";

    photo.append(file);
    fields.append(photo);

    const show = make("label", "admin-help wide");

    const check = document.createElement("input");

    check.type = "checkbox";
    check.checked = item.is_active;
    check.dataset.key = "is_active";

    show.append(
      check,
      document.createTextNode(" Показывать технику на сайте")
    );

    fields.append(show);

    const actions = make("div", "admin-actions wide");

    const save = make(
      "button",
      "admin-primary",
      "Сохранить"
    );

    save.type = "submit";

    const del = make(
      "button",
      "admin-danger",
      "Удалить"
    );

    del.type = "button";

    del.addEventListener("click", async () => {
      if (!confirm(`Удалить технику «${item.name}»?`)) {
        return;
      }

      del.disabled = true;

      const { error } = await supabase
        .from("trucks")
        .delete()
        .eq("id", item.id)
        .eq("tenant_slug", slug);

      if (error) {
        status(error.message, "error");
        del.disabled = false;
        return;
      }

      await removeOldPhoto(item.image_path);

      status("Техника удалена.", "success");

      await loadTrucks();
    });

    actions.append(save, del);
    fields.append(actions);
    form.append(fields);
    list.append(form);
  });
}

// ЗАГРУЗКА РАЙОНОВ ДОСТАВКИ
async function loadZones() {
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("tenant_slug", slug)
    .order("sort_order", {
      ascending: true
    });

  if (error) throw error;

  const list = $("zonesList");

  list.replaceChildren();

  if (!data.length) {
    list.append(
      make(
        "p",
        "admin-help",
        "Районов пока нет. Добавьте первый район ниже."
      )
    );
  }

  data.forEach((item) => {
    const form = make("form", "zone-editor");

    const name = document.createElement("input");

    name.value = item.name;
    name.required = true;
    name.maxLength = 90;

    const nameWrap = make(
      "label",
      "",
      "Название района"
    );

    nameWrap.append(name);
    form.append(nameWrap);

    const inputs = {};

    [
      ["price_small", "Малый самосвал"],
      ["price_medium", "Средний"],
      ["price_large", "Большой"]
    ].forEach(([key, label]) => {
      const wrap = make(
        "label",
        "",
        label + ", ₽"
      );

      const input = document.createElement("input");

      input.type = "number";
      input.min = "0";
      input.max = "10000000";
      input.step = "100";
      input.value = item[key];
      input.required = true;

      wrap.append(input);
      form.append(wrap);

      inputs[key] = input;
    });

    const actions = make("div", "admin-actions");

    const save = make(
      "button",
      "admin-primary",
      "Сохранить"
    );

    save.type = "submit";

    const del = make(
      "button",
      "admin-danger",
      "Удалить район"
    );

    del.type = "button";
    del.disabled = data.length <= 1;

    del.title = data.length <= 1
      ? "Нельзя удалить последний район доставки"
      : "Удалить район";

    del.addEventListener("click", async () => {
      if (data.length <= 1) return;

      if (!confirm(`Удалить район «${item.name}»?`)) {
        return;
      }

      del.disabled = true;

      const { error: deleteError } = await supabase
        .from("delivery_zones")
        .delete()
        .eq("id", item.id)
        .eq("tenant_slug", slug);

      if (deleteError) {
        status(deleteError.message, "error");
        del.disabled = false;
        return;
      }

      status("Район удалён.", "success");

      await loadZones();
    });

    actions.append(save, del);
    form.append(actions);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      save.disabled = true;
      save.textContent = "…";

      const payload = {
        name: name.value.trim(),

        price_small: Number(inputs.price_small.value),

        price_medium: Number(inputs.price_medium.value),

        price_large: Number(inputs.price_large.value)
      };

      if (
        !payload.name ||
        Object.values(payload).some(
          (v) => typeof v === "number" &&
            (v < 0 || !Number.isFinite(v))
        )
      ) {
        status("Проверьте название и тарифы.", "error");

        save.disabled = false;
        save.textContent = "Сохранить";

        return;
      }

      const { error: updateError } = await supabase
        .from("delivery_zones")
        .update(payload)
        .eq("id", item.id)
        .eq("tenant_slug", slug);

      if (updateError) {
        status(updateError.message, "error");

        save.disabled = false;
        save.textContent = "Сохранить";

        return;
      }

      status("Тариф доставки сохранён.", "success");

      save.disabled = false;
      save.textContent = "Сохранено";
    });

    list.append(form);
  });
}

// ПЕРЕЗАГРУЗКА ВСЕХ ДАННЫХ
async function reloadAll() {
  status("Загружаем данные…");

  try {
    await Promise.all([
      loadMaterials(),
      loadTrucks(),
      loadZones()
    ]);

    status("Данные загружены.", "success");

  } catch (err) {
    console.error("Ошибка загрузки данных:", err);

    status(
      err.message ||
      "Не удалось загрузить данные. Проверьте SQL-настройку и доступы.",
      "error"
    );
  }
}

// ДОБАВЛЕНИЕ МАТЕРИАЛА С ПРОВЕРКОЙ ФОТОГРАФИИ
async function addMaterial(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const button = form.querySelector('[type="submit"]');

  button.disabled = true;
  button.textContent = "Добавляем…";

  let uploadedPath = null;

  try {
    const name = $("newMaterialName").value.trim();

    const price = Number(
      $("newMaterialPrice").value
    );

    const density = Number(
      $("newMaterialDensity").value
    );

    const description = $("newMaterialDescription")
      .value
      .trim();

    const photoInput = $("newMaterialPhoto");

    const photo = photoInput?.files?.[0] || null;

    if (
      !name ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(density) ||
      density <= 0
    ) {
      throw new Error(
        "Укажите название, положительную цену и плотность."
      );
    }

    if (!photo) {
      throw new Error(
        "Выберите фотографию материала перед добавлением."
      );
    }

    uploadedPath = await uploadPhoto(
      photo,
      "materials"
    );

    if (!uploadedPath) {
      throw new Error(
        "Фотография не была загружена."
      );
    }

    console.log(
      "Путь загруженной фотографии:",
      uploadedPath
    );

    const { data, error } = await supabase
      .from("materials")
      .insert({
        tenant_slug: slug,
        name,
        description,
        price_per_ton: price,
        density,
        image_path: uploadedPath,
        is_active: true,
        sort_order: 100
      })
      .select("id, name, image_path")
      .single();

    if (error) throw error;

    console.log(
      "Сохранённый материал:",
      data
    );

    if (
      !data ||
      data.image_path !== uploadedPath
    ) {
      throw new Error(
        "Материал добавлен, но путь к фотографии не сохранился в базе. Проверьте настройки Supabase."
      );
    }

    uploadedPath = null;

    form.reset();

    $("newMaterialPrice").value = "550";
    $("newMaterialDensity").value = "1.4";

    status(
      "Материал и фотография успешно добавлены.",
      "success"
    );

    await loadMaterials();

  } catch (err) {
    console.error(
      "Ошибка добавления материала:",
      err
    );

    if (uploadedPath) {
      await removeOldPhoto(uploadedPath);
    }

    status(
      err.message || "Не удалось добавить материал.",
      "error"
    );

  } finally {
    button.disabled = false;
    button.textContent = "+ Добавить материал";
  }
}

// ДОБАВЛЕНИЕ РАЙОНА
async function addZone(e) {
  e.preventDefault();

  const form = e.currentTarget;

  const button = form.querySelector('[type="submit"]');

  button.disabled = true;
  button.textContent = "Добавляем…";

  try {
    const name = $("newZoneName").value.trim();

    const prices = [
      Number($("newZoneSmall").value),
      Number($("newZoneMedium").value),
      Number($("newZoneLarge").value)
    ];

    if (
      !name ||
      prices.some(
        (v) => !Number.isFinite(v) ||
          v < 0 ||
          v > 10000000
      )
    ) {
      throw new Error(
        "Укажите название района и корректные тарифы."
      );
    }

    const key = `zone_${crypto.randomUUID()
      .replaceAll("-", "")
      .slice(0, 12)}`;

    const { error } = await supabase
      .from("delivery_zones")
      .insert({
        tenant_slug: slug,
        key,
        name,
        price_small: prices[0],
        price_medium: prices[1],
        price_large: prices[2],
        is_active: true,
        sort_order: 100
      });

    if (error) throw error;

    form.reset();

    $("newZoneSmall").value = "2000";
    $("newZoneMedium").value = "2500";
    $("newZoneLarge").value = "4000";

    status(
      "Район доставки добавлен.",
      "success"
    );

    await loadZones();

  } catch (err) {
    console.error("Ошибка добавления района:", err);

    status(
      err.message || "Не удалось добавить район.",
      "error"
    );

  } finally {
    button.disabled = false;
    button.textContent = "+ Добавить район";
  }
}

// ДОБАВЛЕНИЕ ТЕХНИКИ
async function addTruck(e) {
  e.preventDefault();

  const form = e.currentTarget;

  const button = form.querySelector('[type="submit"]');

  button.disabled = true;
  button.textContent = "Добавляем…";

  let uploadedPath = null;

  try {
    const name = $("newTruckName").value.trim();

    const capacity = Number(
      $("newTruckCapacity").value
    );

    const price = Number(
      $("newTruckBasePrice").value
    );

    if (
      !name ||
      !Number.isFinite(capacity) ||
      capacity <= 0 ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        "Проверьте название, грузоподъёмность и цену подачи."
      );
    }

    const photo = $("newTruckPhoto").files[0];

    const path = photo
      ? await uploadPhoto(photo, "trucks")
      : null;

    uploadedPath = path;

    const { data, error } = await supabase
      .from("trucks")
      .insert({
        tenant_slug: slug,
        name,
        description: $("newTruckDescription").value.trim(),
        max_tons: capacity,
        base_delivery_price: price,
        class_key: $("newTruckClass").value,
        side_unload: $("newTruckSideUnload").checked,
        image_path: path,
        is_active: true,
        sort_order: 100
      })
      .select("id, name, image_path")
      .single();

    if (error) throw error;

    if (!data || data.image_path !== path) {
      throw new Error(
        "Не удалось подтвердить сохранение фотографии техники."
      );
    }

    uploadedPath = null;

    form.reset();

    $("newTruckCapacity").value = "15";
    $("newTruckBasePrice").value = "2500";

    status(
      "Техника добавлена.",
      "success"
    );

    await loadTrucks();

  } catch (err) {
    console.error("Ошибка добавления техники:", err);

    if (uploadedPath) {
      await removeOldPhoto(uploadedPath);
    }

    status(
      err.message || "Не удалось добавить технику.",
      "error"
    );

  } finally {
    button.disabled = false;
    button.textContent = "+ Добавить технику";
  }
}

// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
function switchTab(tab) {
  activeTab = tab;

  ["materials", "trucks", "zones"].forEach((name) => {
    $(`${name}Tab`).classList.toggle(
      "hidden",
      name !== tab
    );

    document
      .querySelector(`[data-tab="${name}"]`)
      .classList.toggle(
        "active",
        name === tab
      );
  });
}

// СМЕНА ПАРОЛЯ
async function handleChangePassword(e) {
  e.preventDefault();

  const input = $("newPasswordInput");

  const button = e.currentTarget.querySelector(
    '[type="submit"]'
  );

  const statusEl = $("passwordStatus");

  statusEl.textContent = "";

  if (input.value.length < 10) {
    statusEl.textContent =
      "Пароль должен содержать не менее 10 символов.";

    statusEl.className = "admin-status error";

    return;
  }

  button.disabled = true;
  button.textContent = "Обновляем…";

  try {
    const { error } = await supabase.auth.updateUser({
      password: input.value
    });

    if (error) throw error;

    input.value = "";

    statusEl.textContent = "Пароль изменён.";
    statusEl.className = "admin-status success";

  } catch (err) {
    statusEl.textContent =
      err.message || "Не удалось изменить пароль.";

    statusEl.className = "admin-status error";

  } finally {
    button.disabled = false;
    button.textContent = "Изменить пароль";
  }
}

// ВХОД В ПАНЕЛЬ
async function handleLogin(e) {
  e.preventDefault();

  if (!supabase) {
    loginStatus(
      "Supabase ещё не настроен в site-config.js."
    );

    return;
  }

  const button = e.currentTarget.querySelector(
    '[type="submit"]'
  );

  button.disabled = true;
  button.textContent = "Проверяем…";

  try {
    const { data, error } = await supabase.auth
      .signInWithPassword({
        email: $("emailInput").value.trim(),
        password: $("passwordInput").value
      });

    if (error) throw error;

    currentUser = data.user;

    await verifyMembership(currentUser);

    setLoggedIn(true);

    $("signedInEmail").textContent =
      currentUser.email || "Владелец";

    await reloadAll();

  } catch (err) {
    await supabase.auth.signOut().catch(() => {});

    loginStatus(
      err.message ||
      "Не удалось войти. Проверьте почту и пароль."
    );

  } finally {
    button.disabled = false;
    button.textContent = "Войти в панель";
  }
}

// ЗАПУСК ПАНЕЛИ
async function start() {
  $("adminCompany").textContent =
    `Панель владельца · ${CFG.companyName || "Компания"}`;

  if (
    !slug ||
    !/^[a-z0-9-]{3,50}$/.test(slug)
  ) {
    $("configWarning").classList.remove("hidden");

    loginStatus(
      "Укажите корректный tenantSlug в site-config.js."
    );
  }

  if (!isSupabaseConfigured) {
    $("configWarning").classList.remove("hidden");

    loginStatus(
      "Подключение к базе не настроено. Заполните параметры Supabase в site-config.js."
    );
  }

  $("loginForm").addEventListener(
    "submit",
    handleLogin
  );

  $("addMaterialForm").addEventListener(
    "submit",
    addMaterial
  );

  $("addTruckForm").addEventListener(
    "submit",
    addTruck
  );

  $("addZoneForm").addEventListener(
    "submit",
    addZone
  );

  $("changePasswordForm").addEventListener(
    "submit",
    handleChangePassword
  );

  $("logoutButton").addEventListener(
    "click",
    async () => {
      await supabase.auth.signOut();

      currentUser = null;

      setLoggedIn(false);

      loginStatus(
        "Вы вышли из панели.",
        "success"
      );
    }
  );

  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.addEventListener("click", () => {
      switchTab(b.dataset.tab);
    });
  });

  if (!supabase) return;

  const { data: sessionData } =
    await supabase.auth.getSession();

  if (sessionData.session?.user) {
    try {
      currentUser = sessionData.session.user;

      await verifyMembership(currentUser);

      setLoggedIn(true);

      $("signedInEmail").textContent =
        currentUser.email || "Владелец";

      await reloadAll();

    } catch (err) {
      await supabase.auth.signOut();

      loginStatus(
        err.message || "Нет доступа к панели."
      );
    }
  }
}

start();