"use server";

import "server-only";
import { SCRIPT_ROUTES } from "@/lib/config"; // <--- 1. Importamos las rutas centralizadas

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
    // Si falla el parseo, devolvemos un error controlado en lugar de lanzar excepción
    return { ok: false, error: `Error Apps Script (Posible HTML o Timeout): ${text.slice(0, 100)}...` };
  }
}

/* ==================================================================================
   HELPERS DE NORMALIZACIÓN DE DATOS
   ================================================================================== */

// 2. Función para limpiar datos sucios del Sheet antes de enviarlos al Frontend
function normalizeMeasurement(m) {
  if (!m) return null;
  
  // Lógica unificada para encontrar la cavidad
  const rawCavity = m.cavity ?? m.cavidad ?? m.muestreo?.cavity ?? (Array.isArray(m.cavities) ? m.cavities[0] : null);

  return {
    ...m,
    // Estandarizamos siempre a "cavity" como string
    cavity: rawCavity !== null && rawCavity !== undefined ? String(rawCavity) : "N/A",
    // Aseguramos que el valor sea numérico
    value: Number(m.value ?? m.valor ?? 0),
    // Normalizamos fecha si existe
    timestamp: m.timestamp ?? m.fecha ?? null,
    // Preservamos el ID o generamos uno si falta (útil para keys de React)
    id: m.id ?? `${m.lot}-${rawCavity}-${Math.random().toString(36).slice(2)}`
  };
}

/* ==================================================================================
   API ACTIONS CON CACHÉ
   ================================================================================== */

// 1. PRODUCTOS
export async function apiProducts() {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.PRODUCTS }, // Uso de constante
      { next: { revalidate: 3600 } }
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 2. DIMENSIONES
export async function apiDimensions(product_id) {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.DIMENSIONS, product_id }, // Uso de constante
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
      r: SCRIPT_ROUTES.HISTORY, // Uso de constante
      product_id: filters.product_id || "",
      lot: filters.lot || "",
      cavity: filters.cavity ?? "",
      from: filters.from || "",
      to: filters.to || "",
      limit: filters.limit ?? 200
    }, { 
      next: { revalidate: 300 } 
    });

    // 3. Aplicar normalización a la respuesta
    // Caso A: La respuesta es un array directo de mediciones
    if (Array.isArray(rawData)) {
      return rawData.map(normalizeMeasurement);
    } 
    // Caso B: La respuesta es un objeto { ok: true, data: [...] } (común en APIs estructuradas)
    else if (rawData?.data && Array.isArray(rawData.data)) {
      return { 
        ...rawData, 
        data: rawData.data.map(normalizeMeasurement) 
      };
    }

    // Si hubo error o formato desconocido, devolvemos tal cual
    return rawData;

  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 4. GUARDAR MEDICIÓN
export async function apiPostMeasurements(payload) {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.MEASUREMENTS }, // Uso de constante
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

export async function apiColors() {
  try {
    const out = await fetchAppsScript_(
      { r: SCRIPT_ROUTES.COLORS }, // Usa la constante nueva
      { next: { revalidate: 3600 } } // Cache de 1 hora está bien para colores
    );
    return out;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}