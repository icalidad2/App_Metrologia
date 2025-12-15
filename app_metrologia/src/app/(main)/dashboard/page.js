"use client";

import { useState, useEffect, useMemo } from "react";
import { apiHistory, apiProducts, apiDimensions } from "@/app/actions/metrologia";
import { calculateStats } from "@/lib/statistics";
import { toNumberOrNull } from "@/lib/utils";

// --- COMPONENTES ---
import QualityDashboard from "@/components/metrologia/QualityDashboard";

// --- UI ---
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { BarChart3, Search, Box, CheckCircle, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  // --- ESTADOS ---
  const [history, setHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [dimensions, setDimensions] = useState([]);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingDims, setLoadingDims] = useState(false);

  // Filtros
  const [selectedProductId, setSelectedProductId] = useState("ALL");
  const [selectedDimId, setSelectedDimId] = useState("ALL");

  // 1. Cargar Datos Iniciales (Productos e Historial)
  useEffect(() => {
    apiProducts().then((r) => {
      setProducts(r?.ok && Array.isArray(r.data) ? r.data : []);
    });

    setLoadingHistory(true);
    apiHistory({ limit: 1000 }).then((r) => {
      if (r?.ok) {
        if (r.data && Array.isArray(r.data.items)) setHistory(r.data.items);
        else if (Array.isArray(r.data)) setHistory(r.data);
        else setHistory([]);
      } else {
        setHistory([]);
      }
      setLoadingHistory(false);
    });
  }, []);

  // 2. Cargar Dimensiones al cambiar Producto
  useEffect(() => {
    if (selectedProductId !== "ALL") {
      setLoadingDims(true);
      setSelectedDimId("ALL");
      apiDimensions(selectedProductId).then((r) => {
        if (r?.ok && Array.isArray(r.data)) setDimensions(r.data);
        else setDimensions([]);
        setLoadingDims(false);
      });
    } else {
      setDimensions([]);
      setSelectedDimId("ALL");
    }
  }, [selectedProductId]);

  const productMap = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(String(p.id), p);
    return m;
  }, [products]);

  // 3. LÓGICA MAESTRA: Preparación de datos
  const {
    globalStats,
    dimensionStats,
    dimensionRawData,
    debugInfo,
    recentItems,
    selectedProductName,
    selectedDimName,
  } = useMemo(() => {
    const safeHistory = Array.isArray(history) ? history : [];

    // A. Enriquecer datos
    const enrichedData = safeHistory.map((m) => {
      const prod = productMap.get(String(m.product_id));
      return {
        ...m,
        product_name: prod ? prod.name : m.product_id,
        valueNum: toNumberOrNull(m.value || m.valor),
      };
    });

    // B. Filtrar por Producto
    const filteredData =
      selectedProductId === "ALL"
        ? enrichedData
        : enrichedData.filter((m) => String(m.product_id) === String(selectedProductId));

    // C. KPIs Globales
    const total = filteredData.length;
    const ok = filteredData.filter((m) => {
      const res = String(m.result || "").toUpperCase();
      return res === "OK" || res === "APROBADO";
    }).length;
    const ng = total - ok;
    const rate = total > 0 ? ((ok / total) * 100).toFixed(1) : "0.0";

    // D. Estadísticas de Dimensión (Para QualityDashboard)
    let dimStats = null;
    let dimRawData = [];
    let msg = "";

    const prodName =
      selectedProductId === "ALL"
        ? "Vista global"
        : productMap.get(String(selectedProductId))?.name || String(selectedProductId);

    const dimDef = dimensions.find((d) => String(d.dimension_id) === String(selectedDimId));
    const dimName =
      selectedDimId === "ALL"
        ? "Sin variable"
        : dimDef
        ? `${dimDef.desc || dimDef.dimension_id} (${dimDef.nominal})`
        : String(selectedDimId);

    if (selectedProductId !== "ALL" && selectedDimId !== "ALL") {
      if (dimDef) {
        dimRawData = filteredData.filter(
          (m) => String(m.dimension_id) === String(selectedDimId)
        );

        const rawValues = dimRawData
          .map((m) => m.valueNum)
          .filter((v) => v !== null && !isNaN(v));

        if (rawValues.length === 0) {
          msg = "No hay datos numéricos registrados para esta dimensión.";
        } else if (rawValues.length < 2) {
          msg = `Datos insuficientes (${rawValues.length}) para calcular estadística.`;
        } else {
          dimStats = calculateStats(rawValues, dimDef.nominal, dimDef.tol_sup, dimDef.tol_inf);
        }
      } else {
        msg = "No se encontró definición de tolerancias.";
      }
    }

    // Actividad reciente (sin asumir timestamps: usa el orden del API)
    const recent = filteredData.slice(0, 10);

    return {
      globalStats: { total, ok, ng, rate },
      dimensionStats: dimStats,
      dimensionRawData: dimRawData,
      debugInfo: msg,
      recentItems: recent,
      selectedProductName: prodName,
      selectedDimName: dimName,
    };
  }, [history, productMap, selectedProductId, selectedDimId, dimensions]);

  const showSummary = selectedDimId === "ALL" || !dimensionStats;

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* HEADER + PANEL DE FILTROS */}
        <header className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Dashboard de Calidad
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {loadingHistory ? "Sincronizando..." : `Base de datos: ${history.length} registros`}
              </p>
            </div>

            {/* Contexto (cuando ya hay selección) */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
                {selectedProductName}
              </span>
              <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
                {selectedDimName}
              </span>
            </div>
          </div>

          <Card className="p-4 bg-white border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Producto */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 block">
                  Producto
                </label>
                <Select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="bg-white"
                  aria-label="Seleccionar producto"
                >
                  <option value="ALL">Vista Global</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedProductId === "ALL"
                    ? "Selecciona un producto para habilitar variables críticas."
                    : "Producto seleccionado: filtra KPIs y actividad."}
                </p>
              </div>

              {/* Dimensión */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">
                  <span>Variable Crítica</span>
                  <span className="text-slate-400">
                    {loadingDims
                      ? "Cargando..."
                      : selectedProductId === "ALL"
                      ? ""
                      : `${dimensions.length} vars`}
                  </span>
                </label>

                <Select
                  value={selectedDimId}
                  onChange={(e) => setSelectedDimId(e.target.value)}
                  disabled={selectedProductId === "ALL" || dimensions.length === 0}
                  className="bg-white disabled:bg-slate-100"
                  aria-label="Seleccionar variable crítica"
                >
                  <option value="ALL">-- Seleccionar Variable --</option>
                  {dimensions.map((d) => (
                    <option key={d.dimension_id} value={d.dimension_id}>
                      {d.desc || d.dimension_id} ({d.nominal})
                    </option>
                  ))}
                </Select>

                <p className="text-xs text-slate-400 mt-1">
                  {selectedProductId === "ALL"
                    ? "Primero selecciona un producto."
                    : dimensions.length === 0
                    ? "Este producto no tiene variables cargadas."
                    : "Elige una variable para ver análisis detallado."}
                </p>
              </div>
            </div>
          </Card>
        </header>

        {/* KPIs (siempre visibles) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            title="Total Inspecciones"
            value={globalStats.total}
            icon={<Box className="w-6 h-6 text-blue-600" />}
            hint={selectedProductId === "ALL" ? "Todas" : "Filtradas por producto"}
          />
          <SummaryCard
            title="Tasa de Aprobación"
            value={`${globalStats.rate}%`}
            icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
            hint="OK / Total"
          />
          <SummaryCard
            title="Piezas Rechazadas"
            value={globalStats.ng}
            icon={<AlertTriangle className="w-6 h-6 text-rose-500" />}
            hint="Total - OK"
          />
        </section>

        {/* CONTENIDO */}
        {showSummary ? (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel principal (2/3) */}
            <Card className="lg:col-span-2 p-6 border-slate-200 shadow-sm bg-white">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-slate-50">
                  {selectedProductId === "ALL" ? (
                    <Search className="w-6 h-6 text-slate-400" />
                  ) : (
                    <BarChart3 className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedProductId === "ALL"
                      ? "Selecciona un producto para comenzar el análisis."
                      : "Selecciona una variable (dimensión) para abrir el Bento Grid."}
                  </p>

                  {debugInfo ? (
                    <p className="text-sm mt-2 text-rose-500 font-medium">{debugInfo}</p>
                  ) : (
                    <p className="text-sm mt-2 text-slate-500">
                      Tip: si no aparecen estadísticas, revisa que exista valor numérico (value/valor)
                      y tolerancias definidas en la dimensión.
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MiniGuide
                      title="1) Filtra por producto"
                      desc="Aísla el comportamiento de una familia / molde."
                    />
                    <MiniGuide
                      title="2) Elige variable crítica"
                      desc="Activa histograma, run chart y capacidad."
                    />
                  </div>
                </div>
              </div>

              {/* Bloque vacío “visual” (más limpio que dashed enorme) */}
              <div className="mt-6 h-44 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <p className="text-sm">
                    {selectedProductId === "ALL"
                      ? "Sin análisis detallado en vista global."
                      : "Listo para análisis: selecciona una variable."}
                  </p>
                </div>
              </div>
            </Card>

            {/* Actividad reciente (1/3) */}
            <Card className="p-6 border-slate-200 shadow-sm bg-white">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Actividad reciente</p>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  {selectedProductId === "ALL" ? "Global" : "Producto"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {loadingHistory ? (
                  <div className="space-y-2">
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </div>
                ) : recentItems.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin registros para mostrar.</p>
                ) : (
                  recentItems.map((m, idx) => {
                    const res = String(m.result || "").toUpperCase();
                    const isOk = res === "OK" || res === "APROBADO";
                    const badgeCls = isOk
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-rose-50 text-rose-700 border-rose-100";

                    return (
                      <div
                        key={m.id || m.measurement_id || `${m.product_id}-${idx}`}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {m.product_name || m.product_id}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            Dim: {m.dimension_id || "—"} · Valor:{" "}
                            <span className="font-mono">
                              {m.valueNum ?? toNumberOrNull(m.value || m.valor) ?? "—"}
                            </span>
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${badgeCls}`}
                        >
                          {isOk ? "OK" : res || "NG"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </section>
        ) : (
          <section className="space-y-4">
            {/* Banda superior para “presentación” antes del bento */}
            <Card className="p-4 border-slate-200 shadow-sm bg-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Análisis detallado
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedProductName} · {selectedDimName}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {dimensionRawData?.length || 0} registros en la variable seleccionada
                </div>
              </div>
            </Card>

            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <QualityDashboard
                stats={dimensionStats}
                data={dimensionRawData}
                rawMeasurements={dimensionRawData}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---
function SummaryCard({ title, value, icon, hint }) {
  return (
    <Card className="p-6 flex items-center justify-between border-slate-200 shadow-sm bg-white">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
          {title}
        </p>
        <p className="text-3xl font-bold text-slate-800 font-mono leading-none">{value}</p>
        {hint ? <p className="text-xs text-slate-400 mt-2">{hint}</p> : null}
      </div>
      <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
    </Card>
  );
}

function MiniGuide({ title, desc }) {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{desc}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="p-3 rounded-xl border border-slate-200">
      <div className="h-3 w-2/3 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-1/2 bg-slate-100 rounded" />
    </div>
  );
}
