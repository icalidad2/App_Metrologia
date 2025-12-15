"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
  annotationPlugin
);

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickCavity(m) {
  // Ajusta aquí si tu API usa otro nombre
  return (
    m?.cavity ??
    m?.cavidad ??
    (Array.isArray(m?.cavities) ? m.cavities[0] : null) ??
    m?.muestreo?.cavity ??
    null
  );
}

export default function CavityBalanceChart({ rawMeasurements, stats }) {
  const computed = useMemo(() => {
    const arr = Array.isArray(rawMeasurements) ? rawMeasurements : [];
    if (!arr.length) return { chartData: null, msg: "Sin datos para balanceo." };

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

    if (!cavities.length) {
      return { chartData: null, msg: "No detecté cavidad en los registros (campo cavity/cavidad)." };
    }

    const rows = cavities.map((c) => {
      const vals = groups.get(c);
      const n = vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const mean = vals.reduce((s, x) => s + x, 0) / n;
      return { cavity: c, n, min, max, mean };
    });

    // Dominio Y con padding + límites si existen
    const mins = rows.map((r) => r.min);
    const maxs = rows.map((r) => r.max);

    const lsl = Number.isFinite(stats?.lsl) ? stats.lsl : null;
    const usl = Number.isFinite(stats?.usl) ? stats.usl : null;

    let yMin = Math.min(...mins, lsl ?? Infinity);
    let yMax = Math.max(...maxs, usl ?? -Infinity);

    const span = yMax - yMin;
    const pad = span > 0 ? span * 0.15 : 0.01;
    yMin -= pad;
    yMax += pad;

    const chartData = {
      labels: cavities,
      datasets: [
        // Barra flotante = rango min-max por cavidad
        {
          type: "bar",
          label: "Rango (min-max)",
          data: rows.map((r) => [r.min, r.max]),
          backgroundColor: "rgba(59, 130, 246, 0.12)",
          borderColor: "rgba(59, 130, 246, 0.45)",
          borderWidth: 1,
          order: 2,
        },
        // Media por cavidad
        {
          type: "line",
          label: "Media",
          data: rows.map((r) => r.mean),
          borderColor: "rgba(31, 35, 115, 0.9)",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.15,
          order: 1,
        },
      ],
    };

    return { chartData, rows, yMin, yMax, msg: "" };
  }, [rawMeasurements, stats]);

  if (!computed.chartData) {
    return <div className="text-slate-400">{computed.msg}</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (ctx) => `Cavidad ${ctx[0].label}`,
          label: (ctx) => {
            const i = ctx.dataIndex;
            const r = computed.rows[i];
            if (!r) return "";
            return `n=${r.n} | min=${r.min.toFixed(3)} | mean=${r.mean.toFixed(3)} | max=${r.max.toFixed(3)}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...(Number.isFinite(stats?.lsl)
            ? {
                lsl: {
                  type: "line",
                  yMin: stats.lsl,
                  yMax: stats.lsl,
                  borderColor: "rgba(239, 68, 68, 0.9)",
                  borderWidth: 2,
                  borderDash: [6, 4],
                  label: { display: true, content: "LSL", position: "start", font: { size: 10 } },
                },
              }
            : {}),
          ...(Number.isFinite(stats?.usl)
            ? {
                usl: {
                  type: "line",
                  yMin: stats.usl,
                  yMax: stats.usl,
                  borderColor: "rgba(239, 68, 68, 0.9)",
                  borderWidth: 2,
                  borderDash: [6, 4],
                  label: { display: true, content: "USL", position: "end", font: { size: 10 } },
                },
              }
            : {}),
          ...(Number.isFinite(stats?.mean)
            ? {
                overallMean: {
                  type: "line",
                  yMin: stats.mean,
                  yMax: stats.mean,
                  borderColor: "rgba(100, 116, 139, 0.9)",
                  borderWidth: 1,
                  borderDash: [4, 4],
                },
              }
            : {}),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 12 },
      },
      y: {
        min: computed.yMin,
        max: computed.yMax,
        ticks: { callback: (v) => Number(v).toFixed(3) },
      },
    },
  };

  return (
    <div className="w-full h-full">
      <Chart type="bar" data={computed.chartData} options={options} />
    </div>
  );
}
