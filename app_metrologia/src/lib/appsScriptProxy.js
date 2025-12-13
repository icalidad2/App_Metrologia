// src/lib/appsScriptProxy.js
// Proxy server-side: valida X-API-KEY y llama a Apps Script con key interna.
// Diseñado para Next.js App Router (route handlers).
//
// Env requeridas (solo server):
// - PUBLIC_API_KEY
// - APPS_SCRIPT_URL
// - APPS_SCRIPT_INTERNAL_KEY

function requireEnv(name) {
  const v = process.env[name];
  if (!v || String(v).trim() === "") {
    throw new Error(`Falta configurar la variable de entorno: ${name}`);
  }
  return String(v).trim();
}

export function assertApiKey(request) {
  const expected = requireEnv("PUBLIC_API_KEY");
  const received = request.headers.get("x-api-key") || "";

  if (!received || received !== expected) {
    return { ok: false, status: 401, error: "No autorizado (X-API-KEY inválida)." };
  }
  return { ok: true };
}

export function buildAppsScriptUrl(route, query = {}) {
  const base = requireEnv("APPS_SCRIPT_URL");
  const internalKey = requireEnv("APPS_SCRIPT_INTERNAL_KEY");

  const u = new URL(base);
  u.searchParams.set("r", route);
  u.searchParams.set("key", internalKey);

  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

export async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.headers || {}),
        "Content-Type": "application/json",
      },
    });

    const text = await resp.text();

    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Típico cuando Apps Script devuelve HTML (permisos/login)
      data = { ok: false, error: "Respuesta no-JSON desde Apps Script", raw: text };
    }

    return { resp, data };
  } finally {
    clearTimeout(t);
  }
}

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
