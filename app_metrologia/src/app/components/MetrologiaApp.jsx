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
  // Lógica estándar: Nominal + TolSup / Nominal - TolInf (assumiendo tolInf es positivo en valor absoluto si se resta)
  // Ajusta según tu lógica de negocio exacta si tolInf viene negativo.
  // Aquí asumo: 10 + 0.1 / 10 - 0.1
  return { min: n - Math.abs(ti), max: n + Math.abs(ts) };
}

// --- SUB-COMPONENTES OPTIMIZADOS ---

// 1. Input de Medición con Validación Visual (Memoizado para rendimiento)
const MeasurementInput = memo(function MeasurementInput({ 
  cavity, piece, dim, val, onChange 
}) {
  const { min, max } = useMemo(() => calcMinMax(dim.nominal, dim.tol_sup, dim.tol_inf), [dim]);
  
  let statusClass = "border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-950"; // Default
  
  if (val !== undefined && val !== "") {
    const num = Number(val);
    if (!Number.isFinite(num)) {
        statusClass = "border-amber-500 bg-amber-50 dark:bg-amber-900/10"; // No es número
    } else if (min !== null && max !== null) {
      if (num < min || num > max) {
        statusClass = "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-200"; // NG
      } else {
        // Alerta preventiva (opcional): si está muy cerca del límite (ej. 90% de tolerancia)
        // Por ahora, simple OK:
        statusClass = "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"; // OK
      }
    }
  }

  return (
    <div className={cn("rounded-xl border p-3 transition-colors", statusClass)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-mono font-bold">{dim.dimension_id}</span>
            {dim.critical && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
                CRÍTICA
              </span>
            )}
          </div>
          <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200" title={dim.desc}>
            {dim.desc}
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            Nom: {dim.nominal} | <span className="font-medium">[{min?.toFixed(3)} - {max?.toFixed(3)}]</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={val}
            onChange={(e) => onChange(cavity, piece, dim.dimension_id, e.target.value)}
            placeholder="Val"
            inputMode="decimal"
            className="h-10 w-24 rounded-lg border border-zinc-200 bg-transparent px-3 text-right text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
          />
          <span className="text-xs text-zinc-400">{dim.unit || "mm"}</span>
        </div>
      </div>
    </div>
  );
});

// 2. Tabla de Historial (Memoizado)
const HistoryTable = memo(function HistoryTable({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Sin datos. Ajusta los filtros y consulta.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
          <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Lote</th>
            <th className="px-4 py-3 text-center">Cav</th>
            <th className="px-4 py-3 text-center">Pza</th>
            <th className="px-4 py-3">Dim</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {history.map((it) => (
            <tr key={it.medicion_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(it.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{it.muestreo?.lot || "—"}</td>
              <td className="px-4 py-3 text-center">{it.cavity}</td>
              <td className="px-4 py-3 text-center">{it.piece}</td>
              <td className="px-4 py-3 text-xs">{it.dimension_id}</td>
              <td className="px-4 py-3 text-right font-mono">
                {it.value} <span className="text-[10px] text-zinc-400">{it.unit}</span>
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold",
                  it.result === "OK" 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                    : it.result === "NG"
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                )}>
                  {it.result}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [ordenProduccion, setOrdenProduccion] = useState("");
  const [notes, setNotes] = useState("");
  const [piecesPerCavity, setPiecesPerCavity] = useState(1);
  const [cavitiesSelected, setCavitiesSelected] = useState([]);
  const [vals, setVals] = useState({});
  
  // Persisted Context State (Se carga en useEffect)
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

  // --- EFECTOS ---

  // 1. Cargar Productos y Contexto Local
  useEffect(() => {
    startTransition(async () => {
      const res = await apiProducts();
      if (res?.ok) setProducts(res.data || []);
      else setMsg({ type: "err", text: "Error cargando productos." });
    });

    // Cargar defaults guardados
    const saved = localStorage.getItem("metrologia_context");
    if (saved) {
      try { setContext(JSON.parse(saved)); } catch {}
    }
  }, []);

  // 2. Guardar Contexto Local al cambiar
  useEffect(() => {
    localStorage.setItem("metrologia_context", JSON.stringify(context));
  }, [context]);

  // 3. Cargar Dimensiones al cambiar Producto
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
        setCavitiesSelected(cavitiesAll); // Auto-seleccionar todas si es nueva carga
        setVals({});
      } else {
        setDims([]);
        setMsg({ type: "err", text: res?.error || "Error cargando dimensiones." });
      }
    });
  }, [productId, cavitiesAll.length]); // Dependencia simplificada

  // --- HANDLERS ---

  const handleContextChange = (field, value) => {
    setContext(prev => ({ ...prev, [field]: value }));
  };

  const toggleCavity = (c) => {
    setCavitiesSelected(prev => {
      const next = prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c];
      return next.sort((a, b) => a - b);
    });
    // Nota: No reseteamos vals aquí para no perder datos si desmarcan por error
  };

  const handleValChange = useCallback((cav, piece, dimId, val) => {
    setVals(prev => ({ ...prev, [`${cav}|${piece}|${dimId}`]: val }));
  }, []);

  const handleSubmit = async () => {
    setMsg({ type: "", text: "" });
    setLastResult(null);

    // Validaciones básicas
    if (!productId || !lot || !context.operador || !dims.length || !cavitiesSelected.length) {
      setMsg({ type: "err", text: "Faltan datos obligatorios (Producto, Lote, Operador, Cavidades)." });
      return;
    }

    // Armar payload
    const measurements = [];
    for (const cav of cavitiesSelected) {
      for (let p = 1; p <= piecesPerCavity; p++) {
        for (const d of dims) {
          const raw = vals[`${cav}|${p}|${d.dimension_id}`];
          const num = Number(raw);
          if (!Number.isFinite(num)) {
            setMsg({ type: "err", text: `Valor inválido o faltante en Cav:${cav} Pza:${p} Dim:${d.code}` });
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
        setMsg({ type: "ok", text: "Guardado exitosamente." });
        setVals({}); // Limpiar mediciones tras guardar
      } else {
        setMsg({ type: "err", text: res?.error || "Error al guardar." });
      }
    });
  };

  const handleHistoryLoad = () => {
    if (!productId) return setMsg({ type: "err", text: "Selecciona un producto." });
    startTransition(async () => {
      const res = await apiHistory({
        product_id: productId,
        ...hFilters,
        limit: 100
      });
      if (res?.ok) {
        setHistory(res.data?.items || []);
        setHistoryMeta(res.data?.meta);
      } else {
        setMsg({ type: "err", text: res?.error });
      }
    });
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        
        {/* Header Compacto */}
        <header className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-800 dark:text-white">Metrología</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Control de calidad y captura de datos</p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {["captura", "historial"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                    tab === t
                      ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Status Indicators */}
            <div className="flex items-center gap-2 text-xs">
                {isPending && <span className="animate-pulse text-amber-500 font-medium">Procesando...</span>}
                {msg.text && (
                    <span className={cn(
                        "rounded px-2 py-0.5 font-medium",
                        msg.type === "err" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200" :
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                    )}>
                        {msg.text}
                    </span>
                )}
            </div>
          </div>
        </header>

        {/* Tab: Captura */}
        {tab === "captura" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Sidebar: Contexto (Sticky en desktop) */}
            <div className="space-y-6 lg:col-span-3 lg:sticky lg:top-6 lg:h-fit">
              {/* Selector Producto */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">Producto</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="">Seleccionar...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {selectedProduct && (
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                        <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Cavs: {selectedProduct.cavities}</span>
                        <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Proc: {selectedProduct.process}</span>
                    </div>
                )}
              </div>

              {/* Formulario Contexto */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Datos del Muestreo</h3>
                <div className="space-y-3">
                    <input 
                        placeholder="Lote *" 
                        value={lot} onChange={e => setLot(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <input 
                        placeholder="Orden Prod." 
                        value={ordenProduccion} onChange={e => setOrdenProduccion(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Máquina" value={context.maquina} onChange={e => handleContextChange("maquina", e.target.value)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                        <select value={context.turno} onChange={e => handleContextChange("turno", e.target.value)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                            <option value="A">Turno A</option>
                            <option value="B">Turno B</option>
                            <option value="C">Turno C</option>
                        </select>
                    </div>
                    <input placeholder="Operador *" value={context.operador} onChange={e => handleContextChange("operador", e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <input placeholder="Inspector" value={context.inspector} onChange={e => handleContextChange("inspector", e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <input placeholder="Equipo" value={context.equipment} onChange={e => handleContextChange("equipment", e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <textarea placeholder="Notas..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" rows={2} />
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={isPending || !productId}
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none dark:disabled:bg-zinc-800"
                >
                    {isPending ? "Guardando..." : "GUARDAR DATOS"}
                </button>
              </div>
            </div>

            {/* Grid de Captura */}
            <div className="space-y-6 lg:col-span-9">
                {/* Configuración de Muestra */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Configuración de Muestra</h3>
                            <p className="text-xs text-zinc-500">Progreso: {filledCount} / {expectedCount} valores</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                                <span>Pzas/Cav:</span>
                                <input 
                                    type="number" min="1" max="10" 
                                    value={piecesPerCavity} 
                                    onChange={e => setPiecesPerCavity(Number(e.target.value))}
                                    className="w-16 rounded border border-zinc-300 p-1 text-center dark:border-zinc-600 dark:bg-zinc-800"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="mt-4">
                        <span className="text-xs font-medium text-zinc-500 uppercase">Cavidades Activas:</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {cavitiesAll.length === 0 && <span className="text-sm text-zinc-400">Selecciona un producto primero</span>}
                            {cavitiesAll.map(c => (
                                <button
                                    key={c}
                                    onClick={() => toggleCavity(c)}
                                    className={cn(
                                        "h-8 w-8 rounded-lg text-sm font-semibold transition-all",
                                        cavitiesSelected.includes(c)
                                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                            : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                    )}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Lista de Inputs */}
                {cavitiesSelected.length > 0 && dims.length > 0 ? (
                    <div className="space-y-6">
                        {cavitiesSelected.map(cav => (
                            <div key={cav} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                                    Cavidad {cav}
                                </div>
                                <div className="grid gap-4 p-4 md:grid-cols-2">
                                    {Array.from({ length: piecesPerCavity }, (_, i) => i + 1).map(p => (
                                        <div key={p} className="space-y-3">
                                            <h5 className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Pieza {p}</h5>
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
                    <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
                        <div className="text-center text-zinc-400">
                            <p>Selecciona producto y cavidades</p>
                            <p className="text-xs">para ver la tabla de captura</p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        {/* Tab: Historial */}
        {tab === "historial" && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <input placeholder="Lote" value={hFilters.lot} onChange={e => setHFilters({...hFilters, lot: e.target.value})} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <input placeholder="Cavidad" value={hFilters.cavity} onChange={e => setHFilters({...hFilters, cavity: e.target.value})} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <input type="date" value={hFilters.from} onChange={e => setHFilters({...hFilters, from: e.target.value})} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <input type="date" value={hFilters.to} onChange={e => setHFilters({...hFilters, to: e.target.value})} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <button onClick={handleHistoryLoad} disabled={isPending} className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-700">Consultar</button>
            </div>
            
            <HistoryTable history={history} />
            
            {historyMeta && (
                <div className="mt-2 text-right text-xs text-zinc-400">
                    Escaneado: {historyMeta.tail_meas_scanned} mediciones
                </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}