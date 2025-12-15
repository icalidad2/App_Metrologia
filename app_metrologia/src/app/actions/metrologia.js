"use server";

import "server-only";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";
const APPS_SCRIPT_INTERNAL_KEY = process.env.APPS_SCRIPT_INTERNAL_KEY || "";

function assertEnv_() {
  if (!APPS_SCRIPT_URL) throw new Error("Falta APPS_SCRIPT_URL en variables de entorno.");
  if (!APPS_SCRIPT_INTERNAL_KEY) throw new Error("Falta APPS_SCRIPT_INTERNAL_KEY en variables de entorno.");
}

// Helper genérico optimizado para caché
async function fetchAppsScript_(params = {}, options = {}) {
  assertEnv_();
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("key", APPS_SCRIPT_INTERNAL_KEY);
  
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  const resp = await fetch(url.toString(), {
    redirect: "follow",
    // Quitamos "no-store" por defecto para permitir caché personalizada
    ...options
  });

  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return { ok: false, error: `Error Apps Script: ${text.slice(0, 100)}...` };
  }
}

/* ==================================================================================
   API ACTIONS CON CACHÉ (VELOCIDAD EXTREMA)
   ================================================================================== */

// 1. PRODUCTOS: Catálogo estático. 
// Se guarda en caché por 1 hora (3600 segundos).
export async function apiProducts() {
  try {
    const out = await fetchAppsScript_(
      { r: "products" },
      { next: { revalidate: 3600 } } // <--- ¡AQUÍ ESTÁ EL TRUCO!
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 2. DIMENSIONES: Especificaciones técnicas.
// Se guarda en caché por 1 hora. Al abrir el modal será instantáneo la segunda vez.
export async function apiDimensions(product_id) {
  try {
    const out = await fetchAppsScript_(
      { r: "dimensions", product_id },
      { next: { revalidate: 3600 } } // <--- CACHÉ DE 1 HORA
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 3. HISTORIAL: Datos analíticos.
// Se guarda por 5 minutos (300s). Suficiente para navegar rápido sin datos viejos.
export async function apiHistory(filters = {}) {
  try {
    // Generamos una "key" única para el caché basada en los filtros
    // (Next.js lo hace automático por URL, pero esto ayuda a entenderlo)
    const out = await fetchAppsScript_({
      r: "history",
      product_id: filters.product_id || "",
      lot: filters.lot || "",
      cavity: filters.cavity ?? "",
      from: filters.from || "",
      to: filters.to || "",
      limit: filters.limit ?? 200
    }, { 
      next: { revalidate: 300 } // <--- CACHÉ DE 5 MINUTOS
    });
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 4. GUARDAR MEDICIÓN: Siempre en vivo.
// Los POST no se cachean por seguridad e integridad.
export async function apiPostMeasurements(payload) {
  try {
    const out = await fetchAppsScript_(
      { r: "measurements" },
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store" // <--- IMPORTANTE: Nunca cachear escrituras
      }
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}