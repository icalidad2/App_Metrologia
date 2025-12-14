"use client";

import { useEffect, useMemo, useState, useTransition, useCallback, memo } from "react";
import {
  apiProducts,
  apiDimensions,
  apiPostMeasurements,
  apiHistory
} from "@/app/actions/metrologia";

// --- UTILS ---
function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function calcMinMax(nominal, tolSup, tolInf) {
  const n = Number(nominal);
  const ts = Number(tolSup);
  const ti = Number(tolInf);
  if (!Number.isFinite(n) || !Number.isFinite(ts) || !Number.isFinite(ti)) return { min: null, max: null };
  return { min: n - Math.abs(ti), max: n + Math.abs(ts) };
}

// --- SUB-COMPONENTES CON MEJOR UI ---

// 1. Input de Medición: Diseño "Tarjeta" con estado visual claro
const MeasurementInput = memo(function MeasurementInput({ 
  cavity, piece, dim, val, onChange 
}) {
  const { min, max } = useMemo(() => calcMinMax(dim.nominal, dim.tol_sup, dim.tol_inf), [dim]);
  
  // Lógica de colores del estado
  let statusBorder = "border-transparent";
  let statusBg = "bg-slate-50"; 
  let statusIcon = null;

  if (val !== undefined && val !== "") {
    const num = Number(val);
    if (!Number.isFinite(num)) {
        statusBorder = "border-amber-400";
        statusBg = "bg-amber-50";
    } else if (min !== null && max !== null) {
      if (num < min || num > max) {
        statusBorder = "border-rose-500";
        statusBg = "bg-rose-50/50";
        statusIcon = <span className="text-rose-500 text-xs font-bold">NG</span>;
      } else {
        statusBorder = "border-emerald-500";
        statusBg = "bg-emerald-50/30";
        statusIcon = <span className="text-emerald-600 text-xs font-bold">OK</span>;
      }
    }
  }

  return (
    <div className={cn(
      "group relative flex items-center justify-between rounded-xl border p-4 transition-all duration-200",
      "hover:shadow-md hover:border-slate-300", 
      "bg-white border-slate-200", // Base style
      val && statusBorder !== "border-transparent" ? `border-l-4 ${statusBorder}` : "" // Borde izquierdo de color si hay valor
    )}>
      {/* Información de la Dimensión */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {dim.dimension_id}
          </span>
          {dim.critical && (
            <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"/>
              CRÍTICA
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-slate-700 leading-tight" title={dim.desc}>
          {dim.desc}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-slate-400">Nominal</span>
            <span className="font-medium text-slate-700">{dim.nominal}</span>
          </div>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-slate-400">Rango</span>
            <span className="font-medium text-slate-700">{min?.toFixed(3)} - {max?.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Input y Unidad */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            value={val}
            onChange={(e) => onChange(cavity, piece, dim.dimension_id, e.target.value)}
            placeholder="-"
            inputMode="decimal"
            className={cn(
              "h-12 w-28 rounded-lg border-2 text-right text-lg font-mono outline-none transition-all",
              "focus:ring-4 focus:ring-slate-100",
              statusBorder !== "border-transparent" ? statusBorder : "border-slate-200 focus:border-indigo-500",
              statusBg
            )}
          />
          {statusIcon && (
            <div className="absolute top-1 right-2 pointer-events-none">
              {statusIcon}
            </div>
          )}
        </div>
        <span className="text-xs font-medium text-slate-400 w-6">{dim.unit || "mm"}</span>
      </div>
    </div>
  );
});

// 2. Tabla de Historial con mejor diseño
const HistoryTable = memo(function HistoryTable({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">No hay registros. Ajusta los filtros y consulta.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Fecha', 'Lote', 'Color', 'Cav', 'Pza', 'Dim', 'Valor', 'Resultado'].map(h => (
                <th key={h} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((it) => (
              <tr key={it.medicion_id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-slate-600">{new Date(it.timestamp).toLocaleString()}</td>
                <td className="px-6 py-4 font-mono text-slate-700">{it.muestreo?.lot || "—"}</td>
                {/* Asumimos que el backend eventualmente devolverá el color en el muestreo */}
                <td className="px-6 py-4 text-slate-600">{it.muestreo?.color || "—"}</td>
                <td className="px-6 py-4 text-slate-600">{it.cavity}</td>
                <td className="px-6 py-4 text-slate-600">{it.piece}</td>
                <td className="px-6 py-4 text-xs font-mono text-slate-500">{it.dimension_id}</td>
                <td className="px-6 py-4 font-mono font-medium">
                  {it.value} <span className="text-xs text-slate-400 font-sans">{it.unit}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase border",
                    it.result === "OK" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : it.result === "NG"
                      ? "bg-rose-50 text-rose-700 border-rose-100"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", 
                       it.result === "OK" ? "bg-emerald-500" : it.result === "NG" ? "bg-rose-500" : "bg-slate-400"
                    )}/>
                    {it.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});


// --- COMPONENTE PRINCIPAL ---

export default function MetrologiaApp() {
  const [tab, setTab] = useState("captura");
  const [isPending, startTransition] = useTransition();

  // Data Global
  const [products, setProducts] = useState([]);
  const [dims, setDims] = useState([]);

  // Form State
  const [productId, setProductId] = useState("");
  const [lot, setLot] = useState("");
  const [color, setColor] = useState(""); // NUEVO ESTADO: COLOR
  const [ordenProduccion, setOrdenProduccion] = useState("");
  const [notes, setNotes] = useState("");
  const [piecesPerCavity, setPiecesPerCavity] = useState(1);
  const [cavitiesSelected, setCavitiesSelected] = useState([]);
  const [vals, setVals] = useState({});
  
  // Persisted Context
  const [context, setContext] = useState({
    maquina: "",
    turno: "A",
    operador: "",
    inspector: "",
    equipment: "QM-Data 200"
  });

  // UI State
  const [lastResult, setLastResult] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Historial State
  const [hFilters, setHFilters] = useState({ lot: "", cavity: "", from: "", to: "" });
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState(null);

  // Derived State
  const selectedProduct = useMemo(() => products.find(p => p.id === productId) || null, [products, productId]);
  const cavitiesAll = useMemo(() => {
    const n = Number(selectedProduct?.cavities || 0);
    return n > 0 ? Array.from({ length: n }, (_, i) => i + 1) : [];
  }, [selectedProduct]);

  // Stats
  const filledCount = Object.values(vals).filter(v => v !== "" && !isNaN(Number(v))).length;
  const expectedCount = dims.length * cavitiesSelected.length * piecesPerCavity;
  const progressPercent = expectedCount > 0 ? Math.round((filledCount / expectedCount) * 100) : 0;

  // --- EFECTOS ---
  useEffect(() => {
    startTransition(async () => {
      const res = await apiProducts();
      if (res?.ok) setProducts(res.data || []);
      else setMsg({ type: "err", text: "Error cargando productos." });
    });
    const saved = localStorage.getItem("metrologia_context");
    if (saved) {
      try { setContext(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("metrologia_context", JSON.stringify(context));
  }, [context]);

  useEffect(() => {
    if (!productId) {
      setDims([]);
      setCavitiesSelected([]);
      setVals({});
      return;
    }
    startTransition(async () => {
      setMsg({ type: "", text: "" });
      const res = await apiDimensions(productId);
      if (res?.ok) {
        setDims(res.data || []);
        setCavitiesSelected(cavitiesAll); 
        setVals({});
      } else {
        setDims([]);
        setMsg({ type: "err", text: res?.error || "Error cargando dimensiones." });
      }
    });
  }, [productId, cavitiesAll.length]); 

  // --- HANDLERS ---
  const handleContextChange = (field, value) => {
    setContext(prev => ({ ...prev, [field]: value }));
  };

  const toggleCavity = (c) => {
    setCavitiesSelected(prev => {
      const next = prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c];
      return next.sort((a, b) => a - b);
    });
  };

  const handleValChange = useCallback((cav, piece, dimId, val) => {
    setVals(prev => ({ ...prev, [`${cav}|${piece}|${dimId}`]: val }));
  }, []);

  const handleSubmit = async () => {
    setMsg({ type: "", text: "" });
    setLastResult(null);

    // Validaciones (Añadir color si es obligatorio, aquí lo dejo opcional pero recomendado)
    if (!productId || !lot || !context.operador || !dims.length || !cavitiesSelected.length) {
      setMsg({ type: "err", text: "Faltan datos (Producto, Lote, Operador, Cavidades)." });
      return;
    }

    const measurements = [];
    for (const cav of cavitiesSelected) {
      for (let p = 1; p <= piecesPerCavity; p++) {
        for (const d of dims) {
          const raw = vals[`${cav}|${p}|${d.dimension_id}`];
          const num = Number(raw);
          if (!Number.isFinite(num)) {
            setMsg({ type: "err", text: `Valor inválido en Cav:${cav} Pza:${p} Dim:${d.code}` });
            return;
          }
          measurements.push({
            cavity: cav, piece: p, dimension_id: d.dimension_id, value: num, unit: d.unit || "mm"
          });
        }
      }
    }

    const payload = {
      product_id: productId,
      lot,
      color, // NUEVO CAMPO EN PAYLOAD
      orden_produccion: ordenProduccion,
      maquina: context.maquina,
      turno: context.turno,
      operador: context.operador,
      inspector: context.inspector,
      equipment: context.equipment,
      notes,
      pieces_per_cavity: piecesPerCavity,
      cavities: cavitiesSelected,
      measurements
    };

    startTransition(async () => {
      const res = await apiPostMeasurements(payload);
      if (res?.ok) {
        setLastResult(res.data);
        setMsg({ type: "ok", text: "Datos guardados correctamente." });
        setVals({});
      } else {
        setMsg({ type: "err", text: res?.error || "Error al guardar." });
      }
    });
  };

  const handleHistoryLoad = () => {
    if (!productId) return setMsg({ type: "err", text: "Selecciona un producto." });
    startTransition(async () => {
      const res = await apiHistory({ product_id: productId, ...hFilters, limit: 100 });
      if (res?.ok) {
        setHistory(res.data?.items || []);
        setHistoryMeta(res.data?.meta);
      } else {
        setMsg({ type: "err", text: res?.error });
      }
    });
  };

  // --- UI RENDER ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Top Banner Decorativo */}
      <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Metrología <span className="text-emerald-600">Pro</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-lg">
              Sistema de captura de calidad y control estadístico. Selecciona un producto para comenzar.
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            {/* Tabs estilo 'Pill' */}
            <div className="flex p-1 space-x-1 bg-slate-200/60 rounded-xl">
              <button
                onClick={() => setTab("captura")}
                className={cn(
                  "w-32 py-2 text-sm font-semibold rounded-lg shadow-sm focus:outline-none transition-all duration-200",
                  tab === "captura" ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Captura
              </button>
              <button
                onClick={() => setTab("historial")}
                className={cn(
                  "w-32 py-2 text-sm font-semibold rounded-lg shadow-sm focus:outline-none transition-all duration-200",
                  tab === "historial" ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Historial
              </button>
            </div>
            
            {/* Status Notification */}
            <div className="h-6 flex items-center justify-end">
                {isPending && (
                  <span className="flex items-center gap-2 text-xs font-medium text-indigo-600 animate-pulse">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Sincronizando...
                  </span>
                )}
                {msg.text && !isPending && (
                    <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm border",
                        msg.type === "err" ? "bg-red-50 text-red-700 border-red-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                    )}>
                        {msg.text}
                    </span>
                )}
            </div>
          </div>
        </header>

        {/* --- VIEW: CAPTURA --- */}
        {tab === "captura" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            
            {/* LEFT SIDEBAR (Sticky) */}
            <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-8">
              
              {/* Card 1: Contexto Producto */}
              <div className="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/50 border border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Producto</label>
                <div className="relative">
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="block w-full rounded-lg border-slate-200 bg-slate-50 p-3 pr-10 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- Seleccionar --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {selectedProduct && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="block text-[10px] text-slate-400 uppercase">Cavidades</span>
                          <span className="text-sm font-bold text-slate-700">{selectedProduct.cavities}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="block text-[10px] text-slate-400 uppercase">Proceso</span>
                          <span className="text-sm font-bold text-slate-700 truncate">{selectedProduct.process}</span>
                        </div>
                    </div>
                )}
              </div>

              {/* Card 2: Formulario de Lote */}
              <div className="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                {/* Accent bar */}
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                
                <h3 className="text-sm font-bold text-slate-800 mb-4 pl-2">Datos de Muestreo</h3>
                <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase">Lote *</label>
                      <input 
                          value={lot} onChange={e => setLot(e.target.value)}
                          placeholder="Ej. 2512-001"
                          className="mt-1 w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                    </div>
                    {/* NUEVO INPUT COLOR */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase">Color</label>
                      <input 
                          value={color} onChange={e => setColor(e.target.value)}
                          placeholder="Ej. Rosa, Azul..."
                          className="mt-1 w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase">Orden Producción</label>
                      <input 
                          value={ordenProduccion} onChange={e => setOrdenProduccion(e.target.value)}
                          className="mt-1 w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white transition-colors"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase">Máquina</label>
                          <select value={context.maquina} onChange={e => handleContextChange("maquina", e.target.value)} className="mt-1 w-full rounded-lg border-slate-200 bg-slate-50 px-2 py-2 text-sm focus:bg-white">
                              <option value="NISSEI 19">NISSEI 19</option>
                              <option value="ARBUG 01">ARBUG 01</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase">Turno</label>
                          <select value={context.turno} onChange={e => handleContextChange("turno", e.target.value)} className="mt-1 w-full rounded-lg border-slate-200 bg-slate-50 px-2 py-2 text-sm focus:bg-white">
                              <option value="M">Matutino</option>
                              <option value="N">Nocturno</option>
                          </select>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <input placeholder="Operador *" value={context.operador} onChange={e => handleContextChange("operador", e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white" />
                      <input placeholder="Inspector" value={context.inspector} onChange={e => handleContextChange("inspector", e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white" />
                      <input placeholder="Equipo Medición" value={context.equipment} onChange={e => handleContextChange("equipment", e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white" />
                      <textarea placeholder="Notas / Observaciones..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm resize-none focus:bg-white" rows={2} />
                    </div>
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={isPending || !productId}
                    className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-95 transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                    {isPending ? "Guardando..." : "GUARDAR DATOS"}
                </button>
              </div>
            </div>

            {/* MAIN CONTENT: Mediciones */}
            <div className="lg:col-span-9 space-y-6">
                
                {/* Banner de Progreso */}
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-slate-800">Progreso de Captura</h3>
                          <span className="text-xs font-medium text-slate-500">{filledCount} / {expectedCount} valores</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-full" 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6 pl-0 md:pl-6 border-l-0 md:border-l border-slate-100">
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Piezas / Cav</label>
                            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                              <button onClick={() => setPiecesPerCavity(Math.max(1, piecesPerCavity - 1))} className="px-3 py-1 text-slate-500 hover:bg-white rounded-l-lg">-</button>
                              <span className="w-8 text-center text-sm font-bold text-slate-700">{piecesPerCavity}</span>
                              <button onClick={() => setPiecesPerCavity(piecesPerCavity + 1)} className="px-3 py-1 text-slate-500 hover:bg-white rounded-r-lg">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selector de Cavidades */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Cavidades Activas</span>
                    <div className="flex flex-wrap gap-2">
                        {cavitiesAll.length === 0 && <span className="text-sm text-slate-400 italic">Selecciona un producto primero...</span>}
                        {cavitiesAll.map(c => (
                            <button
                                key={c}
                                onClick={() => toggleCavity(c)}
                                className={cn(
                                    "w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center border-2",
                                    cavitiesSelected.includes(c)
                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/30 transform scale-105"
                                        : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
                                )}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid de Inputs */}
                {cavitiesSelected.length > 0 && dims.length > 0 ? (
                    <div className="grid gap-6">
                        {cavitiesSelected.map(cav => (
                            <div key={cav} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                      Cavidad {cav}
                                    </h4>
                                </div>
                                <div className="p-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
                                    {Array.from({ length: piecesPerCavity }, (_, i) => i + 1).map(p => (
                                        <div key={p} className="space-y-4">
                                            {piecesPerCavity > 1 && (
                                              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">Pieza {p}</h5>
                                            )}
                                            {dims.map(d => (
                                                <MeasurementInput
                                                    key={`${cav}-${p}-${d.dimension_id}`}
                                                    cavity={cav}
                                                    piece={p}
                                                    dim={d}
                                                    val={vals[`${cav}|${p}|${d.dimension_id}`] || ""}
                                                    onChange={handleValChange}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                        <div className="text-center text-slate-400">
                            <p className="text-lg font-medium">Área de Trabajo Vacía</p>
                            <p className="text-sm">Configura producto y cavidades para comenzar</p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        {/* --- VIEW: HISTORIAL --- */}
        {tab === "historial" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Filtros de Búsqueda</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Lote</label>
                      <input value={hFilters.lot} onChange={e => setHFilters({...hFilters, lot: e.target.value})} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:border-indigo-500" placeholder="Ej. 2512..." />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Cavidad</label>
                      <input value={hFilters.cavity} onChange={e => setHFilters({...hFilters, cavity: e.target.value})} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:border-indigo-500" placeholder="#" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Desde</label>
                      <input type="date" value={hFilters.from} onChange={e => setHFilters({...hFilters, from: e.target.value})} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Hasta</label>
                      <input type="date" value={hFilters.to} onChange={e => setHFilters({...hFilters, to: e.target.value})} className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:border-indigo-500" />
                    </div>
                    <button onClick={handleHistoryLoad} disabled={isPending} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-500 transition-all">
                      Consultar
                    </button>
                </div>
            </div>
            
            <HistoryTable history={history} />
            
            {historyMeta && (
                <div className="text-right text-xs text-slate-400 font-medium px-2">
                    Registros analizados: {historyMeta.tail_meas_scanned}
                </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}