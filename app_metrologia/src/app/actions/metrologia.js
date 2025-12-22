"use server";

import "server-only";
import { SCRIPT_ROUTES } from "@/lib/config";

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
    ...options
  });

  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return { ok: false, error: `Error Apps Script (Posible HTML o Timeout): ${text.slice(0, 100)}...` };
  }
}

/* ==================================================================================
   HELPERS DE NORMALIZACIÓN DE DATOS
   ================================================================================== */

function normalizeMeasurement(m) {
  if (!m) return null;
  const rawCavity = m.cavity ?? m.cavidad ?? m.muestreo?.cavity ?? (Array.isArray(m.cavities) ? m.cavities[0] : null);

  return {
    ...m,
    cavity: rawCavity !== null && rawCavity !== undefined ? String(rawCavity) : "N/A",
    value: Number(m.value ?? m.valor ?? 0),
    timestamp: m.timestamp ?? m.fecha ?? null,
    id: m.id ?? `${m.lot}-${rawCavity}-${Math.random().toString(36).slice(2)}`
  };
}

/* ==================================================================================
   API ACTIONS: METROLOGÍA BÁSICA
   ================================================================================== */

// 1. PRODUCTOS (Respuesta completa para manejo de errores manual)
export async function apiProducts() {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.PRODUCTS },
      { next: { revalidate: 3600 } }
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ✅ 1.1 PRODUCTOS (Formato Array Directo)
// Esta es la que usa el Tablero de Bitácora para el "Join" de nombres
export async function apiGetProducts() {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.PRODUCTS },
      { next: { revalidate: 3600 } }
    );
    return out?.ok ? out.data : [];
  } catch (e) {
    console.error("Error obteniendo productos:", e);
    return [];
  }
}

// 2. DIMENSIONES
export async function apiDimensions(product_id) {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.DIMENSIONS, product_id },
      { next: { revalidate: 3600 } }
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 3. HISTORIAL (Con Normalización)
export async function apiHistory(filters = {}) {
  try {
    const rawData = await fetchAppsScript_({
      r: SCRIPT_ROUTES.HISTORY,
      product_id: filters.product_id || "",
      lot: filters.lot || "",
      cavity: filters.cavity ?? "",
      from: filters.from || "",
      to: filters.to || "",
      limit: filters.limit ?? 200
    }, { 
      next: { revalidate: 300 } 
    });

    if (Array.isArray(rawData)) {
      return rawData.map(normalizeMeasurement);
    } 
    else if (rawData?.data && Array.isArray(rawData.data)) {
      return { 
        ...rawData, 
        data: rawData.data.map(normalizeMeasurement) 
      };
    }
    return rawData;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 4. GUARDAR MEDICIÓN
export async function apiPostMeasurements(payload) {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.MEASUREMENTS },
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 5. COLORES
export async function apiColors() {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.COLORS },
      { next: { revalidate: 3600 } }
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* ==================================================================================
   MÓDULO BITÁCORA & APPSHEET (INTEGRACIÓN)
   ================================================================================== */

// A. Obtener Órdenes Activas desde AppSheet (Filtradas por Origen)
export async function apiGetActiveOrders(sourceType) {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.ORDERS, source: sourceType }, 
      { next: { revalidate: 0 } } // Sin caché para tiempo real
    );
    return out?.ok ? out.data : [];
  } catch (e) {
    console.error("Error fetching orders:", e);
    return [];
  }
}

// B. Obtener Historial Completo de Bitácora
export async function apiGetFullLogbook() {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.LOGBOOK_FULL }, 
      { next: { revalidate: 0 } }
    );
    return out?.ok ? out.data : [];
  } catch (e) {
    console.error("Error fetching logbook:", e);
    return [];
  }
}

// C. Crear Nuevo Turno (Sesión)
export async function apiCreateLogbookSession(payload) {
  // payload: { turno, inspector }
  try {
    return await fetchAppsScript_(
      { r: SCRIPT_ROUTES.LOGBOOK_CREATE },
      {
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// D. Agregar Evento (Incidencia)
export async function apiAddLogbookEvent(payload) {
  // payload: { bitacora_id, mensaje, prioridad, orden }
  try {
    return await fetchAppsScript_(
      { r: SCRIPT_ROUTES.LOGBOOK_ADD_EVENT },
      {
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );
  } catch (e) {
    return { ok: false, error: e.message };
  }
}