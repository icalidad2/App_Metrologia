// src/lib/utils.js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utilidad para clases de Tailwind (versión robusta o simple según tengas instalado)
// Si no tienes clsx/tailwind-merge instalados, usa la versión simple que tenías:
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/* =========================================
   HELPERS METROLOGÍA
   ========================================= */

// Convierte a número de forma segura
export function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Calcula min/max con tolerancias
export function calcMinMax(nominal, tolSup, tolInf) {
  const n = toNumberOrNull(nominal);
  const ts = toNumberOrNull(tolSup);
  const ti = toNumberOrNull(tolInf);
  if (n === null || ts === null || ti === null) return { min: null, max: null };
  return { min: n - Math.abs(ti), max: n + Math.abs(ts) };
}