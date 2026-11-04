const cfg = window.SITE_CONFIG || {};
const configured = Boolean(
  cfg.supabaseUrl &&
  cfg.supabasePublishableKey &&
  !cfg.supabaseUrl.includes("YOUR_PROJECT_REF") &&
  !cfg.supabasePublishableKey.includes("YOUR_SUPABASE")
);

export const isSupabaseConfigured = configured;

const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
  "https://unpkg.com/@supabase/supabase-js@2/dist/esm/wrapper.mjs",
  "https://esm.sh/@supabase/supabase-js@2"
];

let clientPromise = null;

export async function getSupabaseAsync() {
  if (!configured) {
    throw new Error("Сначала укажите Supabase URL и Publishable key в site-config.js.");
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      for (const url of CDN_URLS) {
        try {
          const mod = await import(url);
          if (mod && typeof mod.createClient === "function") {
            return mod.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage
              },
              global: { headers: { "X-Client-Info": "orengruz-static-template/1.1" } }
            });
          }
        } catch (e) {}
      }
      throw new Error("Не удалось загрузить клиент Supabase ни с одного CDN.");
    })();
  }
  return clientPromise;
}

// Fast direct REST query for public catalog (0 KB external libraries, works without esm.sh!)
export async function fetchPublicTable(table, slug) {
  const base = cfg.supabaseUrl.replace(/\/$/, "");
  const url = `${base}/rest/v1/${table}?tenant_slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&order=sort_order.asc`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": cfg.supabasePublishableKey,
        "Authorization": `Bearer ${cfg.supabasePublishableKey}`,
        "Accept": "application/json"
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export function publicImageUrl(path) {
  if (!path || !configured) return "";
  const base = cfg.supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/tenant-assets/${encodeURI(path)}`;
}
