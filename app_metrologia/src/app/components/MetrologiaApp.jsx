"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  apiProducts,
  apiDimensions,
  apiPostMeasurements,
  apiHistory
} from "@/app/actions/metrologia";

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

export default function MetrologiaApp() {
  const [tab, setTab] = useState("captura"); // captura | historial
  const [isPending, startTransition] = useTransition();

  // Data
  const [products, setProducts] = useState([]);
  const [dims, setDims] = useState([]);

  // Selección
  const [productId, setProductId] = useState("");
  const selectedProduct = useMemo(() => products.find(p => p.id === productId) || null, [products, productId]);

  // Muestreo form
  const [lot, setLot] = useState("");
  const [ordenProduccion, setOrdenProduccion] = useState("");
  const [maquina, setMaquina] = useState("");
  const [turno, setTurno] = useState("A");
  const [operador, setOperador] = useState("");
  const [inspector, setInspector] = useState("");
  const [equipment, setEquipment] = useState("QM-Data 200");
  const [notes, setNotes] = useState("");
  const [piecesPerCavity, setPiecesPerCavity] = useState(1);

  // Cavidades
  const [cavitiesSelected, setCavitiesSelected] = useState([]);
  const cavitiesAll = useMemo(() => {
    const n = Number(selectedProduct?.cavities || 0);
    if (!Number.isFinite(n) || n <= 0) return [];
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [selectedProduct]);

  // Inputs de medición (clave: cavity|piece|dimension_id)
  const [vals, setVals] = useState({}); // { "1|1|DIM-001": "23.01" }
  const [lastResult, setLastResult] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Historial
  const [hLot, setHLot] = useState("");
  const [hCavity, setHCavity] = useState("");
  const [hFrom, setHFrom] = useState("");
  const [hTo, setHTo] = useState("");
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState(null);

  // Load products on mount
  useEffect(() => {
    startTransition(async () => {
      setMsg({ type: "", text: "" });
      const res = await apiProducts();
      if (!res?.ok) {
        setMsg({ type: "err", text: res?.error || "No se pudo cargar productos." });
        return;
      }
      setProducts(res.data || []);
    });
  }, []);

  // On product change: load dims + reset cavities + reset inputs
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
      if (!res?.ok) {
        setDims([]);
        setMsg({ type: "err", text: res?.error || "No se pudo cargar dimensiones." });
        return;
      }
      setDims(res.data || []);
      // default: seleccionar todas las cavidades
      setCavitiesSelected(cavitiesAll);
      setVals({});
    });
  }, [productId, cavitiesAll.join(",")]);

  function toggleCavity(c) {
    setCavitiesSelected(prev => {
      const has = prev.includes(c);
      const next = has ? prev.filter(x => x !== c) : [...prev, c];
      next.sort((a, b) => a - b);
      return next;
    });
    setVals({}); // reset: la matriz cambió
  }

  function setVal(cavity, piece, dimId, v) {
    const key = `${cavity}|${piece}|${dimId}`;
    setVals(prev => ({ ...prev, [key]: v }));
  }

  const expectedCount = useMemo(() => {
    if (!dims.length) return 0;
    if (!cavitiesSelected.length) return 0;
    const p = Number(piecesPerCavity);
    if (!Number.isFinite(p) || p <= 0) return 0;
    return dims.length * cavitiesSelected.length * p;
  }, [dims.length, cavitiesSelected.join(","), piecesPerCavity]);

  const filledCount = useMemo(() => {
    // cuenta valores numéricos válidos
    let c = 0;
    for (const v of Object.values(vals)) {
      const n = Number(v);
      if (Number.isFinite(n)) c++;
    }
    return c;
  }, [vals]);

  async function onSubmit() {
    setMsg({ type: "", text: "" });
    setLastResult(null);

    if (!productId) return setMsg({ type: "err", text: "Selecciona un producto." });
    if (!lot.trim()) return setMsg({ type: "err", text: "Captura el lote." });
    if (!operador.trim()) return setMsg({ type: "err", text: "Captura operador." });
    if (!inspector.trim()) return setMsg({ type: "err", text: "Captura inspector." });
    if (!equipment.trim()) return setMsg({ type: "err", text: "Captura el equipo (ej. QM-Data 200)." });
    if (!dims.length) return setMsg({ type: "err", text: "No hay dimensiones registradas para este producto." });
    if (!cavitiesSelected.length) return setMsg({ type: "err", text: "Selecciona al menos 1 cavidad." });

    const ppc = Number(piecesPerCavity);
    if (!Number.isFinite(ppc) || ppc <= 0) return setMsg({ type: "err", text: "Piezas por cavidad debe ser > 0." });

    // Armamos mediciones en orden: por cavidad -> pieza -> dimensión
    const measurements = [];
    for (const cav of cavitiesSelected) {
      for (let piece = 1; piece <= ppc; piece++) {
        for (const d of dims) {
          const key = `${cav}|${piece}|${d.dimension_id}`;
          const raw = vals[key];
          const num = Number(raw);
          if (!Number.isFinite(num)) {
            // estrictos: pedimos todo completo
            return setMsg({
              type: "err",
              text: `Falta valor: Cavidad ${cav}, Pieza ${piece}, Dimensión ${d.dimension_id} (${d.desc || d.code || ""})`
            });
          }
          measurements.push({
            cavity: cav,
            piece,
            dimension_id: d.dimension_id,
            value: num,
            unit: d.unit || "mm"
          });
        }
      }
    }

    const payload = {
      product_id: productId,
      lot: lot.trim(),
      orden_produccion: ordenProduccion.trim(),
      maquina: maquina.trim(),
      turno: turno.trim(),
      operador: operador.trim(),
      inspector: inspector.trim(),
      cavities: cavitiesSelected,
      pieces_per_cavity: ppc,
      notes: notes.trim(),
      equipment: equipment.trim(),
      measurements
    };

    startTransition(async () => {
      const res = await apiPostMeasurements(payload);
      if (!res?.ok) {
        setMsg({ type: "err", text: res?.error || "No se pudo registrar." });
        return;
      }
      setLastResult(res.data || null);
      setMsg({ type: "ok", text: "✅ Muestreo registrado correctamente." });

      // refresca historial del lote actual (rápido y útil)
      const h = await apiHistory({ product_id: productId, lot: lot.trim(), limit: 100 });
      if (h?.ok) {
        setHistory(h.data?.items || []);
        setHistoryMeta(h.data?.meta || null);
      }
    });
  }

  async function loadHistory() {
    if (!productId) return setMsg({ type: "err", text: "Selecciona un producto para consultar historial." });
    startTransition(async () => {
      setMsg({ type: "", text: "" });
      const res = await apiHistory({
        product_id: productId,
        lot: hLot.trim(),
        cavity: hCavity.trim() ? Number(hCavity) : "",
        from: hFrom.trim(),
        to: hTo.trim(),
        limit: 200
      });
      if (!res?.ok) return setMsg({ type: "err", text: res?.error || "No se pudo cargar historial." });
      setHistory(res.data?.items || []);
      setHistoryMeta(res.data?.meta || null);
      if ((res.data?.items || []).length === 0) setMsg({ type: "warn", text: "Sin resultados con esos filtros." });
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">App Web • Metrología</h1>
              <p className="text-sm text-zinc-400">Captura de muestreos multicavidad + historial por lote/cavidad/fecha.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTab("captura")}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium border",
                  tab === "captura"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                )}
              >
                Captura
              </button>
              <button
                onClick={() => setTab("historial")}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium border",
                  tab === "historial"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                )}
              >
                Historial
              </button>
            </div>
          </div>

          {/* Status line */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1",
              isPending ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-zinc-800 bg-zinc-900"
            )}>
              <span className={cn("h-2 w-2 rounded-full", isPending ? "bg-amber-400" : "bg-emerald-400")} />
              {isPending ? "Procesando…" : "Listo"}
            </span>

            {msg.text ? (
              <span className={cn(
                "rounded-full border px-3 py-1",
                msg.type === "ok" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
                msg.type === "err" && "border-rose-500/30 bg-rose-500/10 text-rose-200",
                msg.type === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-200"
              )}>
                {msg.text}
              </span>
            ) : null}
          </div>
        </div>

        {/* Selección base */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="text-xs text-zinc-400">Producto</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
            >
              <option value="">— Selecciona —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.id} • {p.name} ({p.client})
                </option>
              ))}
            </select>

            {selectedProduct ? (
              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm">
                <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1">
                    Proceso: <span className="text-zinc-200">{selectedProduct.process || "—"}</span>
                  </span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1">
                    Cavidades: <span className="text-zinc-200">{selectedProduct.cavities ?? "—"}</span>
                  </span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1">
                    Activo: <span className="text-zinc-200">{selectedProduct.active ? "Sí" : "No"}</span>
                  </span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Dimensiones cargadas: <span className="text-zinc-200">{dims.length}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="text-xs text-zinc-400">Cavidades seleccionadas</label>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setCavitiesSelected(cavitiesAll); setVals({}); }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs hover:bg-zinc-800"
                disabled={!cavitiesAll.length}
              >
                Seleccionar todas
              </button>
              <button
                type="button"
                onClick={() => { setCavitiesSelected([]); setVals({}); }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs hover:bg-zinc-800"
                disabled={!cavitiesAll.length}
              >
                Limpiar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-2 md:grid-cols-8">
              {cavitiesAll.map(c => {
                const on = cavitiesSelected.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCavity(c)}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-sm font-semibold",
                      on
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Piezas por cavidad</label>
                <input
                  value={piecesPerCavity}
                  onChange={(e) => setPiecesPerCavity(e.target.value)}
                  type="number"
                  min={1}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Equipo</label>
                <input
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="QM-Data 200"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              Esperadas: <span className="text-zinc-200">{expectedCount}</span> •
              Capturadas: <span className="text-zinc-200">{filledCount}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="text-xs text-zinc-400">Datos del muestreo</label>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <input
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                placeholder="Lote (ej. 2512-0001)"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
              />
              <input
                value={ordenProduccion}
                onChange={(e) => setOrdenProduccion(e.target.value)}
                placeholder="Orden de producción (opcional)"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={maquina}
                  onChange={(e) => setMaquina(e.target.value)}
                  placeholder="Máquina (ej. INY-05)"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                />
                <select
                  value={turno}
                  onChange={(e) => setTurno(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                >
                  <option value="A">Turno A</option>
                  <option value="B">Turno B</option>
                  <option value="C">Turno C</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={operador}
                  onChange={(e) => setOperador(e.target.value)}
                  placeholder="Operador"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                />
                <input
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  placeholder="Inspector"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                />
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas (opcional)"
                rows={3}
                className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
              />

              <button
                type="button"
                onClick={onSubmit}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                disabled={isPending}
              >
                Guardar muestreo
              </button>

              {lastResult ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
                  <div><span className="text-zinc-500">muestreo_id:</span> {lastResult.muestreo_id}</div>
                  <div><span className="text-zinc-500">inserted_samples:</span> {lastResult.inserted_samples}</div>
                  <div><span className="text-zinc-500">inserted_measurements:</span> {lastResult.inserted_measurements}</div>
                  <div><span className="text-zinc-500">timestamp:</span> {lastResult.timestamp}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* TAB: CAPTURA */}
        {tab === "captura" ? (
          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold">Captura de mediciones</h2>
                <p className="text-xs text-zinc-400">
                  Estructura: Cavidad → Pieza → Dimensión. (Modo estricto: requiere todo completo)
                </p>
              </div>
              <div className="text-xs text-zinc-400">
                Dimensiones: <span className="text-zinc-200">{dims.length}</span> •
                Cavidades: <span className="text-zinc-200">{cavitiesSelected.length}</span> •
                Piezas/cavidad: <span className="text-zinc-200">{piecesPerCavity}</span>
              </div>
            </div>

            {!productId ? (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                Selecciona un producto para comenzar.
              </div>
            ) : !dims.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Este producto no tiene dimensiones registradas en la hoja <b>Dimensiones</b>.
              </div>
            ) : !cavitiesSelected.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Selecciona al menos una cavidad.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {cavitiesSelected.map(cav => (
                  <div key={cav} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Cavidad {cav}</div>
                      <div className="text-xs text-zinc-500">
                        {dims.length} dims • {piecesPerCavity} piezas
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {Array.from({ length: Number(piecesPerCavity) }, (_, i) => i + 1).map(piece => (
                        <div key={piece} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                          <div className="text-sm font-semibold">Pieza {piece}</div>

                          <div className="mt-3 space-y-2">
                            {dims.map(d => {
                              const key = `${cav}|${piece}|${d.dimension_id}`;
                              const { min, max } = calcMinMax(d.nominal, d.tol_sup, d.tol_inf);
                              return (
                                <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0">
                                      <div className="text-xs text-zinc-400">
                                        {d.dimension_id} • {d.code}
                                        {d.critical ? <span className="ml-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">CRÍTICA</span> : null}
                                      </div>
                                      <div className="truncate text-sm font-medium text-zinc-200">{d.desc}</div>
                                      <div className="mt-1 text-xs text-zinc-500">
                                        Nominal: <span className="text-zinc-200">{d.nominal ?? "—"}</span> {d.unit || "mm"} •
                                        Tol: +<span className="text-zinc-200">{d.tol_sup ?? "—"}</span> / -<span className="text-zinc-200">{d.tol_inf ?? "—"}</span> •
                                        Min/Max: <span className="text-zinc-200">{min ?? "—"}</span> / <span className="text-zinc-200">{max ?? "—"}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <input
                                        value={vals[key] ?? ""}
                                        onChange={(e) => setVal(cav, piece, d.dimension_id, e.target.value)}
                                        placeholder="Valor"
                                        inputMode="decimal"
                                        className="w-32 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
                                      />
                                      <span className="text-xs text-zinc-500">{d.unit || "mm"}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* TAB: HISTORIAL */}
        {tab === "historial" ? (
          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold">Historial</h2>
                <p className="text-xs text-zinc-400">Filtra por lote/cavidad/fecha. (Lee “tail” para performance)</p>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                disabled={isPending}
              >
                Consultar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <input
                value={hLot}
                onChange={(e) => setHLot(e.target.value)}
                placeholder="Lote (opcional)"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
              />
              <input
                value={hCavity}
                onChange={(e) => setHCavity(e.target.value)}
                placeholder="Cavidad (opcional)"
                inputMode="numeric"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
              />
              <input
                value={hFrom}
                onChange={(e) => setHFrom(e.target.value)}
                placeholder="Desde YYYY-MM-DD"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
              />
              <input
                value={hTo}
                onChange={(e) => setHTo(e.target.value)}
                placeholder="Hasta YYYY-MM-DD"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
              />
            </div>

            {historyMeta ? (
              <div className="mt-3 text-xs text-zinc-500">
                Escaneadas mediciones: <span className="text-zinc-200">{historyMeta.tail_meas_scanned}</span> •
                Escaneados muestreos: <span className="text-zinc-200">{historyMeta.tail_samples_scanned}</span>
              </div>
            ) : null}

            <div className="mt-4 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-950">
                  <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Cav</th>
                    <th className="px-4 py-3">Pza</th>
                    <th className="px-4 py-3">Dimensión</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {(history || []).map((it) => (
                    <tr key={it.medicion_id} className="border-b border-zinc-900">
                      <td className="px-4 py-3 text-xs text-zinc-300">{it.timestamp}</td>
                      <td className="px-4 py-3 text-xs text-zinc-300">{it.muestreo?.lot || "—"}</td>
                      <td className="px-4 py-3">{it.cavity}</td>
                      <td className="px-4 py-3">{it.piece}</td>
                      <td className="px-4 py-3 text-xs text-zinc-300">{it.dimension_id}</td>
                      <td className="px-4 py-3">{it.value} <span className="text-xs text-zinc-500">{it.unit}</span></td>
                      <td className="px-4 py-3 text-xs text-zinc-300">{it.equipment}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full border px-2 py-1 text-xs font-semibold",
                          it.result === "OK" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
                          it.result === "NG" && "border-rose-500/30 bg-rose-500/10 text-rose-200",
                          it.result !== "OK" && it.result !== "NG" && "border-zinc-800 bg-zinc-900 text-zinc-200"
                        )}>
                          {it.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!history || history.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-zinc-500">
                        Sin datos. Usa “Consultar”.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="mt-8 text-center text-xs text-zinc-600">
          UI v1 • Server Actions → Apps Script (Sheets API)
        </div>
      </div>
    </div>
  );
}