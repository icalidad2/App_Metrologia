"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

function clampNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export default function ProcessChart({ data, stats }) {
  const computed = useMemo(() => {
    if (!data || !stats) return null;

    const numericData = (Array.isArray(data) ? data : [])
      .map((d) => (typeof d === "object" ? (d.value ?? d.valor) : d))
      .map(clampNumber)
      .filter((v) => v !== null);

    if (numericData.length === 0) {
      return { chartData: null, domain: null, msg: "Sin datos numéricos para graficar." };
    }

    // Dominio X REAL (mm) + padding inteligente
    const minV = Math.min(...numericData);
    const maxV = Math.max(...numericData);

    const hasLimits = Number.isFinite(stats.lsl) && Number.isFinite(stats.usl);
    const baseSpan = hasLimits ? (stats.usl - stats.lsl) : (maxV - minV);
    const spanSafe = baseSpan > 0 ? baseSpan : 0.01;
    const pad = spanSafe * 0.25;

    let minX = Math.min(minV, Number.isFinite(stats.lsl) ? stats.lsl : minV) - pad;
    let maxX = Math.max(maxV, Number.isFinite(stats.usl) ? stats.usl : maxV) + pad;

    if (!(maxX > minX)) {
      minX = (stats.mean ?? minV) - 0.01;
      maxX = (stats.mean ?? maxV) + 0.01;
    }

    // Histograma (bins)
    const n = numericData.length;
    const binCount = Math.max(8, Math.min(18, Math.round(Math.sqrt(n) * 2)));
    const step = (maxX - minX) / binCount || 0.001;

    const bins = Array.from({ length: binCount }, (_, i) => {
      const start = minX + i * step;
      const end = start + step;
      const count = numericData.filter((v) =>
        i === binCount - 1 ? v >= start && v <= end : v >= start && v < end
      ).length;

      return { x: (start + end) / 2, y: count };
    });

    // Curva normal (solo si sigma es usable)
    const sigma = Number.isFinite(stats.sigma) ? stats.sigma : null;
    const sigmaSafe = sigma && sigma > 0 ? sigma : null;

    const curvePoints = [];
    if (sigmaSafe && n >= 3) {
      const factor = (n * step) / (sigmaSafe * Math.sqrt(2 * Math.PI));
      const inc = (maxX - minX) / 120;

      for (let x = minX; x <= maxX; x += inc) {
        const z = (x - stats.mean) / sigmaSafe;
        const y = Math.exp(-0.5 * z * z) * factor;
        curvePoints.push({ x, y });
      }
    }

    const chartData = {
      datasets: [
        {
          type: "bar",
          label: "Frecuencia",
          data: bins,
          parsing: false,
          backgroundColor: "rgba(31, 35, 115, 0.16)",
          borderColor: "rgba(31, 35, 115, 0.45)",
          borderWidth: 1,
          order: 2,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        },
        ...(curvePoints.length
          ? [
              {
                type: "line",
                label: "Curva Normal",
                data: curvePoints,
                parsing: false,
                borderColor: "#1F2373",
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.35,
                order: 1,
              },
            ]
          : []),
      ],
    };

    return { chartData, domain: { minX, maxX }, msg: "" };
  }, [data, stats]);

  const options = useMemo(() => {
    if (!computed?.domain || !stats) return {};

    const { minX, maxX } = computed.domain;

    const ann = {};

    // Zonas semáforo SOLO dentro del dominio real
    if (Number.isFinite(stats.lsl)) {
      ann.zoneLeft = {
        type: "box",
        xMin: minX,
        xMax: Math.min(stats.lsl, maxX),
        backgroundColor: "rgba(239, 68, 68, 0.05)",
        borderWidth: 0,
      };
      ann.lslLine = {
        type: "line",
        xMin: stats.lsl,
        xMax: stats.lsl,
        borderColor: "rgba(239, 68, 68, 0.9)",
        borderWidth: 2,
        borderDash: [6, 4],
        label: { display: true, content: "LSL", position: "start", font: { size: 10 } },
      };
    }

    if (Number.isFinite(stats.usl)) {
      ann.zoneRight = {
        type: "box",
        xMin: Math.max(stats.usl, minX),
        xMax: maxX,
        backgroundColor: "rgba(239, 68, 68, 0.05)",
        borderWidth: 0,
      };
      ann.uslLine = {
        type: "line",
        xMin: stats.usl,
        xMax: stats.usl,
        borderColor: "rgba(239, 68, 68, 0.9)",
        borderWidth: 2,
        borderDash: [6, 4],
        label: { display: true, content: "USL", position: "end", font: { size: 10 } },
      };
    }

    if (Number.isFinite(stats.lsl) && Number.isFinite(stats.usl)) {
      ann.zoneGreen = {
        type: "box",
        xMin: Math.max(stats.lsl, minX),
        xMax: Math.min(stats.usl, maxX),
        backgroundColor: "rgba(34, 197, 94, 0.06)",
        borderWidth: 0,
      };
    }

    if (Number.isFinite(stats.mean)) {
      ann.meanLine = {
        type: "line",
        xMin: stats.mean,
        xMax: stats.mean,
        borderColor: "rgba(59, 130, 246, 0.9)",
        borderWidth: 1,
        borderDash: [2, 3],
      };
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const x = ctx.raw?.x;
              const y = ctx.raw?.y;
              if (ctx.dataset.type === "bar") return `Freq: ${y}`;
              if (ctx.dataset.type === "line") return `Normal: x=${Number(x).toFixed(3)}`;
              return "";
            },
          },
        },
        annotation: { annotations: ann },
      },
      scales: {
        x: {
          type: "linear",
          min: minX,
          max: maxX,
          grid: { display: false },
          ticks: {
            maxTicksLimit: 6,
            callback: (v) => Number(v).toFixed(3),
          },
        },
        y: {
          display: false,
        },
      },
    };
  }, [computed?.domain, stats]);

  if (!computed || !stats) return <div className="text-slate-400">Cargando...</div>;
  if (computed.msg) return <div className="text-slate-400">{computed.msg}</div>;
  if (!computed.chartData) return <div className="text-slate-400">Cargando...</div>;

  return (
    <div className="w-full h-full relative">
      <Chart type="bar" data={computed.chartData} options={options} />
    </div>
  );
}
