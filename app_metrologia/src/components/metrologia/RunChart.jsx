"use client";
import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

export default function RunChart({ data, stats }) {
  const values = (Array.isArray(data) ? data : [])
    .map((d) => (typeof d === "object" ? (d.value ?? d.valor) : d))
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  const labels = values.map((_, i) => i + 1);

  const lsl = Number.isFinite(stats?.lsl) ? stats.lsl : null;
  const usl = Number.isFinite(stats?.usl) ? stats.usl : null;
  const mean = Number.isFinite(stats?.mean) ? stats.mean : null;

  const chartData = {
    labels,
    datasets: [
      {
        label: "Medición",
        data: values,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.25)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.1,
      },
      {
        label: "Media",
        data: Array(values.length).fill(mean ?? 0),
        borderColor: "#94a3b8",
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  // para que el eje Y siempre incluya LSL/USL aunque no haya puntos ahí
  const minY = Math.min(
    ...values,
    lsl ?? Infinity,
    mean ?? Infinity
  );
  const maxY = Math.max(
    ...values,
    usl ?? -Infinity,
    mean ?? -Infinity
  );
  const span = maxY - minY;
  const pad = Number.isFinite(span) && span > 0 ? span * 0.15 : 0.01;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: { title: (ctx) => `Pieza #${ctx[0].label}` },
      },
      annotation: {
        annotations: {
          ...(lsl !== null
            ? {
                lslLine: {
                  type: "line",
                  yMin: lsl,
                  yMax: lsl,
                  borderColor: "rgba(239, 68, 68, 0.9)",
                  borderWidth: 2,
                  label: {
                    display: true,
                    content: "LSL",
                    position: "start",
                    backgroundColor: "rgba(239, 68, 68, 0.9)",
                    font: { size: 10 },
                  },
                },
              }
            : {}),
          ...(usl !== null
            ? {
                uslLine: {
                  type: "line",
                  yMin: usl,
                  yMax: usl,
                  borderColor: "rgba(239, 68, 68, 0.9)",
                  borderWidth: 2,
                  label: {
                    display: true,
                    content: "USL",
                    position: "start",
                    backgroundColor: "rgba(239, 68, 68, 0.9)",
                    font: { size: 10 },
                  },
                },
              }
            : {}),
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
      y: {
        min: Number.isFinite(minY) ? minY - pad : undefined,
        max: Number.isFinite(maxY) ? maxY + pad : undefined,
      },
    },
  };

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
