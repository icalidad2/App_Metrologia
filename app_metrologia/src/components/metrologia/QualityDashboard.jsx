"use client";

import React, { useMemo } from "react";
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
  if (!stats) return <div className="p-4 text-slate-400">Esperando datos...</div>;

  const n = Number(stats.n ?? 0);

  // Estado (sin mentir con n bajo)
  const enoughSample = n >= 25;
  const capable = Number(stats.cpk) >= 1.33;

  const status = !enoughSample
    ? { label: "MUESTRA INSUFICIENTE", dot: "bg-amber-500", pill: "bg-amber-50 border-amber-100", text: "text-amber-700" }
    : capable
    ? { label: "PROCESO ESTABLE", dot: "bg-emerald-500", pill: "bg-emerald-50 border-emerald-100", text: "text-emerald-700" }
    : { label: "REVISAR PROCESO", dot: "bg-rose-500", pill: "bg-rose-50 border-rose-100", text: "text-rose-700" };

  const cpk = Number(stats.cpk ?? 0);
  const cpkColor = cpk >= 1.33 ? "text-emerald-600" : cpk >= 1.0 ? "text-amber-500" : "text-rose-600";

  const lot = rawMeasurements?.[0]?.muestreo?.lot || rawMeasurements?.[0]?.lot || "---";

  // Promedio por cavidad
  const cavityRows = useMemo(() => {
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

    const cavities = Array.from(groups.keys()).sort((a, b) => Number(a) - Number(b));
    const rows = cavities.map((c) => {
      const vals = groups.get(c);
      const nn = vals.length;
      const mean = vals.reduce((s, x) => s + x, 0) / nn;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const delta = Number.isFinite(stats.mean) ? mean - stats.mean : 0;

      const lsl = Number.isFinite(stats.lsl) ? stats.lsl : null;
      const usl = Number.isFinite(stats.usl) ? stats.usl : null;

      const out = (lsl !== null && mean < lsl) || (usl !== null && mean > usl);

      return { cavity: c, n: nn, mean, min, max, delta, out };
    });

    return { rows, hasCavities: rows.length > 0 };
  }, [rawMeasurements, stats.mean, stats.lsl, stats.usl]);

  return (
    <div className="font-sans space-y-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Monitor de Calidad</h2>
          <p className="text-sm text-slate-500">
            Lote Actual: <span className="font-mono text-slate-700">{lot}</span>
          </p>
        </div>

        <div className={`px-4 py-2 rounded-full border ${status.pill} flex items-center gap-2`}>
          <div className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className={`text-sm font-bold ${status.text}`}>{status.label}</span>
          {!enoughSample && <span className="text-xs text-amber-700/70 font-mono">n={n}</span>}
        </div>
      </div>

      {/* LAYOUT PRINCIPAL: métricas | run chart | promedio por cavidad */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        {/* MÉTRICAS (izquierda) */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <BentoCard title="Cpk (Capacidad)" icon={<Target size={16} />} className="min-h-[180px]">
            <div className="flex flex-col items-center justify-center h-full">
              <div className={`text-5xl font-bold ${cpkColor}`}>
                {Number.isFinite(cpk) ? cpk.toFixed(2) : "--"}
              </div>
              <div className="text-slate-400 text-xs mt-2 uppercase tracking-wide">
                {enoughSample ? "Objetivo > 1.33" : "Preliminar (n<25)"}
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Resumen" icon={<Activity size={16} />} className="min-h-[240px]">
            <div className="space-y-3">
              <RowMetric label="Media" value={Number(stats.mean).toFixed(3)} />
              <RowMetric label="Sigma" value={Number(stats.sigma).toFixed(4)} />
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
          className="col-span-12 lg:col-span-6 min-h-[440px]"
        >
          <RunChart data={data} stats={stats} />
        </BentoCard>

        {/* PROMEDIO POR CAVIDAD (derecha) */}
        <BentoCard
          title="Promedio por cavidad"
          icon={<Layers size={16} />}
          className="col-span-12 lg:col-span-3 min-h-[440px] overflow-hidden"
        >
          {!cavityRows.hasCavities ? (
            <div className="text-slate-400 text-sm">
              No detecté cavidades en los registros.
              <div className="text-xs text-slate-400 mt-2">
                Campos esperados: <span className="font-mono">cavity</span>, <span className="font-mono">cavidad</span> o <span className="font-mono">cavities[]</span>.
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto pr-1 space-y-2 custom-scrollbar">
              {cavityRows.rows.map((r) => {
                const badge = r.out
                  ? "bg-rose-50 border-rose-100 text-rose-700"
                  : "bg-slate-50 border-slate-100 text-slate-700";

                const deltaColor = Math.abs(r.delta) >= (Number(stats.sigma || 0) * 2)
                  ? "text-amber-600"
                  : "text-slate-400";

                return (
                  <div
                    key={r.cavity}
                    className={`p-3 rounded-xl border ${badge} flex items-start justify-between gap-3`}
                    title={`min=${r.min.toFixed(3)} | max=${r.max.toFixed(3)}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        Cavidad <span className="font-mono">#{r.cavity}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        n=<span className="font-mono">{r.n}</span> · rango{" "}
                        <span className="font-mono">{r.min.toFixed(3)}–{r.max.toFixed(3)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-sm">
                        {r.mean.toFixed(3)}
                      </div>
                      <div className={`text-xs font-mono mt-1 ${deltaColor}`}>
                        Δ {r.delta >= 0 ? "+" : ""}{r.delta.toFixed(3)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </div>
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
