"use client";

import React, { useMemo, useState, useEffect } from "react";
import RunChart from "./RunChart";
import BentoCard from "../ui/BentoCard";
import { Activity, Target, TrendingUp, Layers } from "lucide-react";

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickCavity(m) {
  return (
    m?.cavity ??
    m?.cavidad ??
    m?.muestreo?.cavity ??
    (Array.isArray(m?.cavities) ? m.cavities[0] : null) ??
    null
  );
}

export default function QualityDashboard({ stats, data, rawMeasurements }) {
  // 1. HOOKS PRIMERO
  const [selectedCavity, setSelectedCavity] = useState(null);

  // Effects
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedCavity(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!selectedCavity) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedCavity]);

  // Extraemos valores primitivos para usarlos en las dependencias
  // (Usamos 'undefined' como fallback para saber si no existen)
  const statsMean = stats?.mean;
  const statsLsl = stats?.lsl;
  const statsUsl = stats?.usl;
  const statsSigma = stats?.sigma;

  // Promedio por cavidad
  const cavityRows = useMemo(() => {
    if (!stats) return { rows: [], hasCavities: false };

    const arr = Array.isArray(rawMeasurements) ? rawMeasurements : [];
    const groups = new Map();

    for (const m of arr) {
      const cav = pickCavity(m);
      const v = numOrNull(m?.value ?? m?.valor);
      if (cav === null || v === null) continue;

      const key = String(cav);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
    }

    const cavities = Array.from(groups.keys()).sort((a, b) => {
  const nA = Number(a);
  const nB = Number(b);
  const isNumA = Number.isFinite(nA);
  const isNumB = Number.isFinite(nB);

  // 1. Si ambos son números, orden numérico normal
  if (isNumA && isNumB) return nA - nB;

  // 2. Si uno es número y el otro texto, ponemos los números primero
  if (isNumA) return -1;
  if (isNumB) return 1;

  // 3. Si ambos son texto (ej. "ILEGIBLE" vs "N/A"), orden alfabético
  return String(a).localeCompare(String(b));
});
    const rows = cavities.map((c) => {
      const vals = groups.get(c);
      const nn = vals.length;
      const mean = vals.reduce((s, x) => s + x, 0) / nn;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      
      // CORRECCIÓN: Usamos statsMean en lugar de stats.mean
      const delta = Number.isFinite(statsMean) ? mean - statsMean : 0;

      // CORRECCIÓN: Usamos statsLsl y statsUsl
      const lsl = Number.isFinite(statsLsl) ? statsLsl : null;
      const usl = Number.isFinite(statsUsl) ? statsUsl : null;

      const out = (lsl !== null && mean < lsl) || (usl !== null && mean > usl);

      return { cavity: c, n: nn, mean, min, max, delta, out };
    });

    return { rows, hasCavities: rows.length > 0 };
  }, [rawMeasurements, stats, statsMean, statsLsl, statsUsl]); 
  // Ahora sí las usamos dentro, así que ESLint estará feliz.

  // Reporte filtrado por cavidad
  const cavityReport = useMemo(() => {
    if (!selectedCavity || !stats) return null;

    const arr = Array.isArray(rawMeasurements) ? rawMeasurements : [];
    const filtered = arr.filter((m) => String(pickCavity(m)) === String(selectedCavity));

    const values = filtered
      .map((m) => numOrNull(m?.value ?? m?.valor))
      .filter((v) => v !== null);

    const nn = values.length;
    const mean = nn ? values.reduce((s, x) => s + x, 0) / nn : null;
    const min = nn ? Math.min(...values) : null;
    const max = nn ? Math.max(...values) : null;

    // CORRECCIÓN: Usamos las variables extraídas
    const lsl = Number.isFinite(statsLsl) ? statsLsl : null;
    const usl = Number.isFinite(statsUsl) ? statsUsl : null;

    const outCount =
      nn && (lsl !== null || usl !== null)
        ? values.filter((v) => (lsl !== null && v < lsl) || (usl !== null && v > usl)).length
        : 0;

    return { filtered, values, n: nn, mean, min, max, outCount, lsl, usl };
  }, [selectedCavity, rawMeasurements, stats, statsLsl, statsUsl]);

  // 2. RETURN CONDICIONAL
  if (!stats) return <div className="p-4 text-slate-400">Esperando datos...</div>;

  // 3. Variables derivadas
  const n = Number(stats.n ?? 0);
  const enoughSample = n >= 25;
  const capable = Number(stats.cpk) >= 1.33;

  const status = !enoughSample
    ? { label: "MUESTRA INSUFICIENTE", dot: "bg-amber-500", pill: "bg-amber-50 border-amber-100", text: "text-amber-700" }
    : capable
    ? { label: "PROCESO ESTABLE", dot: "bg-emerald-500", pill: "bg-emerald-50 border-emerald-100", text: "text-emerald-700" }
    : { label: "REVISAR PROCESO", dot: "bg-rose-500", pill: "bg-rose-50 border-rose-100", text: "text-rose-700" };

  const cpk = Number(stats.cpk ?? 0);
  const cpkColor = cpk >= 1.33 ? "text-emerald-600" : cpk >= 1.0 ? "text-amber-500" : "text-rose-600";

  return (
    <div className="font-sans space-y-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Monitor de Resultados</h2>
        </div>

        <div className={`px-4 py-2 rounded-full border ${status.pill} flex items-center gap-2`}>
          <div className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className={`text-sm font-bold ${status.text}`}>{status.label}</span>
          {!enoughSample && <span className="text-xs text-amber-700/70 font-mono">n={n}</span>}
        </div>
      </div>

      {/* LAYOUT PRINCIPAL */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        {/* MÉTRICAS (izquierda) */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <BentoCard title="Cpk (Capacidad)" icon={<Target size={16} />} className="min-h-45">
            <div className="flex flex-col items-center justify-center h-full">
              <div className={`text-5xl font-bold ${cpkColor}`}>
                {Number.isFinite(cpk) ? cpk.toFixed(2) : "--"}
              </div>
              <div className="text-slate-400 text-xs mt-2 uppercase tracking-wide">
                {enoughSample ? "Objetivo > 1.33" : "Preliminar (n<25)"}
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Resumen" icon={<Activity size={16} />} className="min-h-60">
            <div className="space-y-3">
              <RowMetric label="Media" value={Number(statsMean).toFixed(3)} />
              <RowMetric label="Sigma" value={Number(statsSigma).toFixed(4)} />
              <RowMetric label="Muestras" value={String(n)} sub="piezas" />
              <div className="pt-2">
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 ${enoughSample ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, (n / 25) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {enoughSample ? "Base suficiente" : "Meta recomendada: 25+"}
                </p>
              </div>
            </div>
          </BentoCard>
        </div>

        {/* RUN CHART (centro) */}
        <BentoCard
          title="Run Chart (Tendencia)"
          icon={<TrendingUp size={16} />}
          className="col-span-12 lg:col-span-6 min-h-110"
        >
          <RunChart data={data} stats={stats} />
        </BentoCard>

        {/* PROMEDIO POR CAVIDAD (derecha) */}
        <BentoCard
          title="Resultados por Cavidad"
          icon={<Layers size={16} />}
          className="col-span-12 lg:col-span-3 min-h-110 overflow-hidden"
        >
          {!cavityRows.hasCavities ? (
            <div className="text-slate-400 text-sm">
              No detecté cavidades en los registros.
              <div className="text-xs text-slate-400 mt-2">
                Campos esperados: <span className="font-mono">cavity</span>,{" "}
                <span className="font-mono">cavidad</span> o{" "}
                <span className="font-mono">cavities[]</span>.
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto pr-1 space-y-2 custom-scrollbar">
              {cavityRows.rows.map((r) => {
                const badge = r.out
                  ? "bg-rose-50 border-rose-100 text-rose-700"
                  : "bg-slate-50 border-slate-100 text-slate-700";

                const deltaColor =
                  Math.abs(r.delta) >= Number(statsSigma || 0) * 2 ? "text-amber-600" : "text-slate-400";

                return (
                  <div
                    key={r.cavity}
                    onClick={() => setSelectedCavity(r.cavity)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedCavity(r.cavity);
                    }}
                    className={`cursor-pointer select-none p-3 rounded-xl border ${badge} flex items-start justify-between gap-3 hover:shadow-sm transition`}
                    title="Click para ver reporte de cavidad"
                  >
                    <div className="min-w-0 mt-2">
                      <div className="text-sm font-semibold truncate">
                        Cavidad <span className="font-mono">#{r.cavity}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-sm">{r.mean.toFixed(3)}</div>
                      <div className={`text-xs font-mono mt-1 ${deltaColor}`}>
                        Diff: Δ {r.delta >= 0 ? "+" : ""}
                        {r.delta.toFixed(3)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </div>

      {/* MODAL REPORTE */}
      {cavityReport && (
        <CavityReportModal
          cavity={selectedCavity}
          report={cavityReport}
          statsOverall={stats}
          onClose={() => setSelectedCavity(null)}
        />
      )}
    </div>
  );
}

function RowMetric({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{label}</div>
      <div className="text-right">
        <div className="font-mono font-bold text-slate-800">{value}</div>
        {sub ? <div className="text-xs text-slate-400 -mt-0.5">{sub}</div> : null}
      </div>
    </div>
  );
}

function CavityReportModal({ cavity, report, statsOverall, onClose }) {
  const delta =
    Number.isFinite(report.mean) && Number.isFinite(statsOverall?.mean) ? report.mean - statsOverall.mean : null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reporte de Cavidad</div>
              <div className="text-xl font-bold text-slate-800 mt-2">
                Cavidad <span className="font-mono">#{cavity}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>

          {/* Content */}
          <div className="p-5 grid grid-cols-12 gap-4">
            {/* Resumen */}
            <div className="col-span-12 md:col-span-4 space-y-3">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Media</div>
                <div className="text-2xl font-bold text-slate-800 font-mono">
                  {Number.isFinite(report.mean) ? report.mean.toFixed(3) : "--"}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Δ vs global:{" "}
                  <span className="font-mono">
                    {delta === null ? "--" : `${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Rango</div>
                <div className="text-sm text-slate-700 mt-2 font-mono">
                  min: {Number.isFinite(report.min) ? report.min.toFixed(3) : "--"}
                  <br />
                  max: {Number.isFinite(report.max) ? report.max.toFixed(3) : "--"}
                </div>
                <div className="text-xs text-slate-500 mt-3">
                  LSL: <span className="font-mono">{report.lsl ?? "--"}</span> · USL:{" "}
                  <span className="font-mono">{report.usl ?? "--"}</span>
                </div>
              </div>
            </div>

            {/* Run chart cavidad */}
            <div className="col-span-12 md:col-span-8">
              <div className="p-4 rounded-2xl border border-slate-200 h-65">
                <RunChart data={report.filtered} stats={statsOverall} />
              </div>
            </div>

            {/* Tabla mediciones */}
            <div className="col-span-12">
              <div className="p-4 rounded-2xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-3">
                  Mediciones de la cavidad
                </div>

                <div className="max-h-65 overflow-auto pr-1 custom-scrollbar">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-widest text-slate-400">
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">Pieza</th>
                        <th className="text-left py-2">Valor</th>
                        <th className="text-left py-2">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.filtered.map((m, i) => {
                        const v = Number(m.value ?? m.valor);
                        const res = String(m.result || "").toUpperCase();
                        const ok = res === "OK" || res === "APROBADO";

                        return (
                          <tr key={m.id || i} className="border-b border-slate-100">
                            <td className="py-2 text-slate-500 font-mono">{i + 1}</td>
                            <td className="py-2 text-slate-600 font-mono">{m.piece ?? i + 1}</td>
                            <td className={`py-2 font-mono font-bold ${ok ? "text-slate-800" : "text-rose-600"}`}>
                              {Number.isFinite(v) ? v.toFixed(3) : "--"}
                            </td>
                            <td className="py-2">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${
                                  ok
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                    : "bg-rose-50 border-rose-100 text-rose-700"
                                }`}
                              >
                                {ok ? "OK" : res || "NG"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {report.filtered.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            Sin registros para esa cavidad.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}