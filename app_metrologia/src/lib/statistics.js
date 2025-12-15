import { toNumberOrNull } from "@/lib/utils";

export function calculateStats(values, nominal, tolSup, tolInf) {
  // Limpieza de datos
  const data = values.map(toNumberOrNull).filter((v) => v !== null);
  const n = data.length;

  if (n < 2) return null; // Necesitamos al menos 2 datos para desviación estándar

  // 1. Básicos
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const min = Math.min(...data);
  const max = Math.max(...data);

  // 2. Desviación Estándar (Muestral)
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
  const sigma = Math.sqrt(variance);

  // 3. Límites de Especificación
  // Asumimos que tolSup/tolInf son relativos (ej: +0.1, -0.1) o absolutos si ya vienen calculados.
  // Usaremos la lógica de tu utils.js: nominal +/- abs(tol)
  const usl = nominal + Math.abs(tolSup); // Upper Spec Limit
  const lsl = nominal - Math.abs(tolInf); // Lower Spec Limit

  // 4. Capacidad de Proceso (Cp, Cpk)
  // Cp = (USL - LSL) / 6σ
  const cp = sigma > 0 ? (usl - lsl) / (6 * sigma) : 0;

  // Cpk = min(Cpu, Cpl)
  const cpu = sigma > 0 ? (usl - mean) / (3 * sigma) : 0;
  const cpl = sigma > 0 ? (mean - lsl) / (3 * sigma) : 0;
  const cpk = Math.min(cpu, cpl);

  return {
    n,
    mean,
    min,
    max,
    sigma,
    cp,
    cpk,
    usl,
    lsl,
    nominal
  };
}