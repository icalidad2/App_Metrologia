import { toNumberOrNull } from "@/lib/utils";

export function calculateStats(values, nominal, tolSup, tolInf) {
  if (!values || !Array.isArray(values)) return null;

  // LIMPIEZA DE DATOS: Soporta { value: 10 } y [10, 11]
  const data = values.map((v) => {
    if (typeof v === 'object' && v !== null) {
      // Intenta leer 'value' (API) o 'valor' (Google Sheets raw), si no, null
      const rawVal = v.value !== undefined ? v.value : v.valor;
      return toNumberOrNull(rawVal);
    }
    return toNumberOrNull(v);
  }).filter((v) => v !== null && !isNaN(v));

  const n = data.length;
  if (n < 2) return null; 

  // 1. Básicos
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const min = Math.min(...data);
  const max = Math.max(...data);

  // 2. Desviación Estándar
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
  const sigma = Math.sqrt(variance);

  // 3. Límites
  const usl = nominal + Math.abs(tolSup);
  const lsl = nominal - Math.abs(tolInf);

  // 4. Capacidad (Cpk)
  const cpu = sigma > 0 ? (usl - mean) / (3 * sigma) : 0;
  const cpl = sigma > 0 ? (mean - lsl) / (3 * sigma) : 0;
  const cpk = Math.min(cpu, cpl);

  return { n, mean, min, max, sigma, cpk, usl, lsl, nominal };
}