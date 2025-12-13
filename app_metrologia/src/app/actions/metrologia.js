"use server";

import "server-only";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";
const APPS_SCRIPT_INTERNAL_KEY = process.env.APPS_SCRIPT_INTERNAL_KEY || "";

function assertEnv_() {
  if (!APPS_SCRIPT_URL) throw new Error("Falta APPS_SCRIPT_URL en variables de entorno.");
  if (!APPS_SCRIPT_INTERNAL_KEY) throw new Error("Falta APPS_SCRIPT_INTERNAL_KEY en variables de entorno.");
}

async function fetchAppsScript_(params = {}, options = {}) {
  assertEnv_();
  const url = new URL(APPS_SCRIPT_URL);
  // key por query (server-to-server)
  url.searchParams.set("key", APPS_SCRIPT_INTERNAL_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });

  const resp = await fetch(url.toString(), {
    // Apps Script suele redirigir (302) a googleusercontent; fetch lo sigue por defecto
    redirect: "follow",
    cache: "no-store",
    ...options
  });

  // Apps Script devuelve JSON si tu doGet/doPost usa ContentService JSON
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    // si algo devolvió HTML, te lo dejamos como error legible
    return { ok: false, error: `Respuesta no JSON desde Apps Script: ${text.slice(0, 180)}...` };
  }
  return json;
}

// GET products
export async function apiProducts() {
  try {
    const out = await fetchAppsScript_({ r: "products" });
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// GET dimensions by product_id
export async function apiDimensions(product_id) {
  try {
    const out = await fetchAppsScript_({ r: "dimensions", product_id });
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// POST measurements (crea muestreo + inserta mediciones)
export async function apiPostMeasurements(payload) {
  try {
    const out = await fetchAppsScript_(
      { r: "measurements" },
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// GET history
export async function apiHistory(filters = {}) {
  try {
    const out = await fetchAppsScript_({
      r: "history",
      product_id: filters.product_id || "",
      lot: filters.lot || "",
      cavity: filters.cavity ?? "",
      from: filters.from || "",
      to: filters.to || "",
      limit: filters.limit ?? 200
    });
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}