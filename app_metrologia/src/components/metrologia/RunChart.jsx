"use client";
import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function RunChart({ data, stats }) {
  const { values, labels, yMin, yMax } = useMemo(() => {
    const vals = (Array.isArray(data) ? data : [])
      .map((d) => (typeof d === "object" ? (d.value ?? d.valor) : d))
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));

    const labs = vals.map((_, i) => i + 1);

    const limits = [];
    if (Number.isFinite(stats?.lsl)) limits.push(stats.lsl);
    if (Number.isFinite(stats?.usl)) limits.push(stats.usl);

    const minV = Math.min(...vals, ...(limits.length ? limits : [Infinity]));
    const maxV = Math.max(...vals, ...(limits.length ? limits : [-Infinity]));

    const span = maxV - minV;
    const pad = span > 0 ? span * 0.15 : 0.01;

    return { values: vals, labels: labs, yMin: minV - pad, yMax: maxV + pad };
  }, [data, stats]);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Medición",
        data: values,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.4)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.1,
      },
      {
        label: "Media",
        data: Array(values.length).fill(stats?.mean || 0),
        borderColor: "#94a3b8",
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

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
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
      y: { min: yMin, max: yMax },
    },
  };

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
