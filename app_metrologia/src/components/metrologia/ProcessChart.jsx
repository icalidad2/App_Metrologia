"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController, // <--- FALTABA ESTE
  PointElement,
  LineElement,
  LineController, // <--- Y ESTE
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Chart } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";

// 1. Registrar componentes de Chart.js (AHORA INCLUYENDO CONTROLADORES)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,  // <--- REGISTRADO
  PointElement,
  LineElement,
  LineController, // <--- REGISTRADO
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

export default function ProcessChart({ data, stats }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0 || !stats) return null;

    // A. PREPARAR DATOS (Histograma)
    const binCount = 15;
    const padding = (stats.sigma || 0.1) * 4;
    const minX = Math.min(stats.min, stats.lsl, stats.mean - padding);
    const maxX = Math.max(stats.max, stats.usl, stats.mean + padding);
    const range = maxX - minX;
    const step = range / binCount;

    // Generar Bins (contenedores)
    const bins = Array.from({ length: binCount }, (_, i) => {
      const start = minX + i * step;
      const end = start + step;
      const mid = (start + end) / 2;
      const count = data.filter((v) => v >= start && v < end).length;
      return { x: mid, y: count, start, end };
    });

    // B. PREPARAR CURVA DE GAUSS (Suave)
    const curvePoints = [];
    const curveStep = range / 100;
    
    // Factor de escala visual
    const factor = (data.length * step) / (stats.sigma * Math.sqrt(2 * Math.PI));

    for (let x = minX; x <= maxX; x += curveStep) {
      const exponent = -0.5 * Math.pow((x - stats.mean) / stats.sigma, 2);
      const y = Math.exp(exponent) * factor; 
      curvePoints.push({ x, y });
    }

    return {
      datasets: [
        {
          type: 'bar',
          label: 'Frecuencia (Piezas)',
          data: bins,
          backgroundColor: 'rgba(31, 35, 115, 0.2)', // Tu color #1F2373
          borderColor: 'rgba(31, 35, 115, 0.5)',
          borderWidth: 1,
          barPercentage: 1,
          categoryPercentage: 1,
          order: 2
        },
        {
          type: 'line',
          label: 'Curva Normal',
          data: curvePoints,
          borderColor: '#1F2373',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
          order: 1
        }
      ]
    };
  }, [data, stats]);

  // C. OPCIONES DEL GRÁFICO
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: { display: true, text: 'Medida (mm)' },
        grid: { color: '#f1f5f9' }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        title: { display: true, text: 'Cantidad' }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 10 }, usePointStyle: true }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
            title: (items) => {
                if(!items.length) return '';
                const val = items[0].parsed.x;
                return `Valor: ${val.toFixed(3)} mm`;
            }
        }
      },
      annotation: {
        annotations: {
          lslLine: {
            type: 'line',
            xMin: stats?.lsl,
            xMax: stats?.lsl,
            borderColor: 'rgba(239, 68, 68, 0.8)', // Rojo
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              display: true,
              content: `LSL ${stats?.lsl}`,
              position: 'start',
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              font: { size: 10 }
            }
          },
          uslLine: {
            type: 'line',
            xMin: stats?.usl,
            xMax: stats?.usl,
            borderColor: 'rgba(239, 68, 68, 0.8)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              display: true,
              content: `USL ${stats?.usl}`,
              position: 'end',
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              font: { size: 10 }
            }
          },
          meanLine: {
            type: 'line',
            xMin: stats?.mean,
            xMax: stats?.mean,
            borderColor: 'rgba(59, 130, 246, 0.8)', // Azul
            borderWidth: 2,
            label: {
              display: true,
              content: `μ ${stats?.mean.toFixed(3)}`,
              position: 'center',
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              font: { size: 10 }
            }
          }
        }
      }
    }
  };

  if (!chartData) return <div className="h-64 flex items-center justify-center text-slate-300">Cargando gráfico...</div>;

  return (
    <div className="w-full h-80 relative">
      <Chart type='bar' data={chartData} options={options} />
    </div>
  );
}