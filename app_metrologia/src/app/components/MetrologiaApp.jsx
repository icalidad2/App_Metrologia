"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import {
  apiProducts,
  apiDimensions,
  apiPostMeasurements,
} from "@/app/actions/metrologia";

/* ==================================================================================
   1. SISTEMA DE DISEÑO "INDUSTRIAL FUTURISM" (Paleta Corporativa Clara)
   ================================================================================== */

// Colores Corporativos:
// Azul Profundo (Marca): #1F2373
// Verde (Éxito): #3A8C37
// Fondo Claro: #F2F2F2
// Blanco: #FFFFFF

const cn = (...classes) => classes.filter(Boolean).join(" ");

/* ==================================================================================
   HELPERS DE INTEGRIDAD DE DATOS (evitan registros corruptos)
   ================================================================================== */

// Convierte a número de forma segura (si falla, regresa null)
function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", "."); // por si escriben coma decimal
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Calcula min/max con tolerancias (si no hay datos numéricos, regresa nulls)
function calcMinMax(nominal, tolSup, tolInf) {
  const n = toNumberOrNull(nominal);
  const ts = toNumberOrNull(tolSup);
  const ti = toNumberOrNull(tolInf);
  if (n === null || ts === null || ti === null) return { min: null, max: null };
  return { min: n - Math.abs(ti), max: n + Math.abs(ts) };
}

// --- ICONOS (SVG Inline - Estilo Técnico) ---
const Icons = {
  Dashboard: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Search: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Filter: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  Box: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Alert: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  CheckCircle: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Close: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Ruler: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  History: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Settings: (p) => (
    <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// --- COMPONENTES UI BASE ---
const Card = ({ children, className, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      "bg-white border border-slate-200 rounded-sm shadow-sm transition-all hover:shadow-md hover:border-[#1F2373]/30 relative overflow-hidden",
      className
    )}
  >
    {/* Corner Accent */}
    <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#1F2373]/10 pointer-events-none"></div>
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className }) => {
  const variants = {
    default: "bg-slate-100 text-slate-600 border-slate-200",
    blue: "bg-[#1F2373]/10 text-[#1F2373] border-[#1F2373]/20",
    green: "bg-[#3A8C37]/10 text-[#3A8C37] border-[#3A8C37]/20",
    red: "bg-red-50/50 text-red-600 border-red-100",
    outline: "border border-slate-300 text-slate-500 bg-transparent",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm font-bold border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

const Button = ({ children, variant = "primary", className, ...props }) => {
  const variants = {
    primary: "bg-[#1F2373] hover:bg-[#1F2373]/90 text-white shadow-sm border border-[#1F2373]",
    outline: "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-[#1F2373]/30 hover:text-[#1F2373]",
    ghost: "bg-transparent text-slate-500 hover:text-[#1F2373] hover:bg-slate-100/50",
  };
  return (
    <button
      className={cn(
        "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-mono",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className, ...props }) => (
  <input
    className={cn(
      "w-full bg-slate-50 border border-slate-200 text-[#1F2373] text-sm px-3 py-2.5 rounded-sm focus:outline-none focus:border-[#1F2373] focus:ring-1 focus:ring-[#1F2373]/20 transition-all font-mono placeholder:text-slate-400",
      className
    )}
    {...props}
  />
);

const Select = ({ className, children, ...props }) => (
  <select
    className={cn(
      "w-full bg-slate-50 border border-slate-200 text-[#1F2373] text-sm px-3 py-2.5 rounded-sm",
      "focus:outline-none focus:border-[#1F2373] focus:ring-1 focus:ring-[#1F2373]/20 transition-all font-mono",
      "appearance-none pr-8",
      // ✅ claves: no-repeat + position/size válidos
      "bg-no-repeat bg-[length:0.7em] bg-[position:right_0.7em_center]",
      // ✅ tu svg como background
      "bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231F2373%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2087.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%20100c3.6-3.6%205.4-7.8%205.4-12.8%200-5-1.8-9.3-5.4-12.9z%22%2F%3E%3C%2Fsvg%3E')]",
      className
    )}
    {...props}
  >
    {children}
  </select>
);


/* ==================================================================================
   2. GRÁFICO DE TOLERANCIA "HUD INDUSTRIAL" (Modo Claro)
   ================================================================================== */
const IndustrialGraph = ({ val, min, max, nominal }) => {
  const v = toNumberOrNull(val);
  const nNom = toNumberOrNull(nominal);
  const nMin = toNumberOrNull(min);
  const nMax = toNumberOrNull(max);

  // Si algo no es numérico, no intentamos dibujar posiciones
  const safeNom = nNom ?? 0;
  const safeMin = nMin ?? safeNom - 1;
  const safeMax = nMax ?? safeNom + 1;

  const range = safeMax - safeMin;
  const padding = Math.max(range * 0.5, 0.0001);
  const vMin = safeMin - padding;
  const vMax = safeMax + padding;
  const totalRange = Math.max(vMax - vMin, 0.0001);

  const getPos = (value) => ((value - vMin) / totalRange) * 100;

  const pMin = getPos(safeMin);
  const pMax = getPos(safeMax);
  const pNom = getPos(safeNom);
  const pVal = v !== null ? Math.min(Math.max(getPos(v), 0), 100) : pNom;

  const isError = v !== null && (v < safeMin || v > safeMax);
  const barColor = isError ? "bg-red-500" : "bg-[#3A8C37]";

  return (
    <div className="relative h-8 w-full flex items-center select-none group">
      {/* Riel Base */}
      <div className="absolute w-full h-[2px] bg-slate-200" />

      {/* Zona de Tolerancia */}
      <div
        className="absolute h-3 border-x border-slate-300 bg-slate-100"
        style={{ left: `${pMin}%`, width: `${pMax - pMin}%` }}
      />

      {/* Nominal */}
      <div
        className="absolute h-4 w-[1px] bg-slate-400 top-1/2 -translate-y-1/2"
        style={{ left: `${pNom}%` }}
      />

      {/* Cursor */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-sm rotate-45 transition-all duration-300 ease-out z-10 border-2 border-white shadow-sm",
          v !== null ? barColor : "bg-slate-300 opacity-50"
        )}
        style={{ left: `calc(${pVal}% - 6px)` }}
      />

      {/* Etiqueta */}
      {v !== null && (
        <span
          className={cn(
            "absolute -top-2.5 text-[9px] font-mono font-bold transition-all duration-300 px-1 rounded-sm",
            isError ? "text-red-600 bg-red-50" : "text-[#3A8C37] bg-green-50"
          )}
          style={{ left: `calc(${pVal}% - 12px)` }}
        >
          {v.toFixed(3)}
        </span>
      )}
    </div>
  );
};

/* ==================================================================================
   3. COMPONENTE PRINCIPAL
   ================================================================================== */
export default function MetrologiaIndustrial() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiProducts();
        if (!alive) return;
        if (res?.ok) setProducts(Array.isArray(res.data) ? res.data : []);
        else setProducts([]);
      } catch {
        if (!alive) return;
        setProducts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = (searchTerm || "").toLowerCase();
    return (products || []).filter((p) => {
      const name = String(p?.name || "").toLowerCase();
      const id = String(p?.id || "").toLowerCase();
      return name.includes(term) || id.includes(term);
    });
  }, [products, searchTerm]);

  return (
    <div className="min-h-screen bg-[#F2F2F2] text-slate-700 font-sans flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-5 h-5 bg-[#1F2373] rounded-sm"></div>
          <div className="ml-3 text-sm font-bold tracking-widest text-[#1F2373] uppercase">
            Calidad<span className="font-light">Sys</span>
          </div>
        </div>
        <div className="p-4 space-y-1">
          <div className="px-2 py-1.5 text-[10px] text-slate-400 font-mono uppercase tracking-widest">
            Navegación
          </div>
          <button className="w-full flex items-center px-3 py-2 text-sm font-bold text-[#1F2373] bg-slate-50 border-l-2 border-[#1F2373] rounded-r-sm">
            <Icons.Dashboard className="w-4 h-4 mr-3" />
            Panel de Control
          </button>
          <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-slate-500 hover:text-[#1F2373] hover:bg-slate-50 border-l-2 border-transparent transition-colors">
            <Icons.History className="w-4 h-4 mr-3" />
            Histórico
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2373] tracking-tight uppercase">
              Gestión Metrológica
            </h1>
            <p className="text-sm text-slate-500 font-mono mt-1">
              Seleccione una referencia para iniciar inspección.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary">
              <Icons.Ruler className="w-4 h-4" /> Nueva Inspección
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">
                Referencias Activas
              </p>
              <p className="text-2xl font-mono font-bold text-[#1F2373] mt-1">
                {products.length}
              </p>
            </div>
            <div className="p-2 bg-slate-100 rounded-sm text-[#1F2373]">
              <Icons.Box className="w-6 h-6" />
            </div>
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">
                Conformidad Global
              </p>
              <p className="text-2xl font-mono font-bold text-[#3A8C37] mt-1">
                98.5%
              </p>
            </div>
            <div className="p-2 bg-green-50 rounded-sm text-[#3A8C37]">
              <Icons.CheckCircle className="w-6 h-6" />
            </div>
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">
                Alertas Pendientes
              </p>
              <p className="text-2xl font-mono font-bold text-slate-700 mt-1">
                2
              </p>
            </div>
            <div className="p-2 bg-slate-100 rounded-sm text-slate-400">
              <Icons.Alert className="w-6 h-6" />
            </div>
          </Card>
        </div>

        {/* Search & List */}
        <div className="space-y-4">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="BUSCAR REFERENCIA POR ID O NOMBRE..."
              className="pl-10 h-11 bg-white border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid gap-3">
            {filtered.map((product) => (
              <Card
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="p-4 cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#1F2373] group-hover:border-[#1F2373]/30 transition-colors rounded-sm">
                    <Icons.Box className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1F2373] tracking-wide text-sm">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {product.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      Cavidades
                    </p>
                    <p className="text-sm font-mono text-slate-700">
                      {product.cavities || 1}
                    </p>
                  </div>
                  <Badge variant="blue">DISPONIBLE</Badge>
                  <Icons.Ruler className="w-4 h-4 text-slate-300 group-hover:text-[#1F2373] transition-colors" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* MODAL DE INSPECCIÓN */}
      {selectedProduct && (
        <InspectionModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}

/* ==================================================================================
   4. MODAL DE INSPECCIÓN (Corregido: payload, validación, números, limpieza y tamaño)
   ================================================================================== */
const InspectionModal = ({ product, onClose }) => {
  const [step, setStep] = useState("setup"); // setup | execute
  const [isPending, startTransition] = useTransition();

  // Mensajería interna (evita depender solo de alert)
  const [modalMsg, setModalMsg] = useState({ type: "", text: "" });

  // Estado del Formulario Completo
  const [formData, setFormData] = useState({
    lot: "",
    op_order: "", // Orden de Producción (UI)
    color: "",
    machine: "",
    shift: "A",
    operator: "",
    inspector: "",
    equipment: "QM-Data 200",
  });

  // Sistema actual: 1 pieza por cavidad (mantenemos tu idea, sin cambiar UI general)
  const piecesPerCavity = 1;

  // Estado de Cavidades Seleccionadas
  const totalCavities = Number(product?.cavities || 1);
  const allCavityIds = useMemo(
    () => Array.from({ length: totalCavities }, (_, i) => i + 1),
    [totalCavities]
  );
  const [selectedCavities, setSelectedCavities] = useState(allCavityIds);

  // Datos de Medición
  const [dims, setDims] = useState([]);
  const [vals, setVals] = useState({});

  // Cargar Dimensiones
  useEffect(() => {
    let alive = true;
    startTransition(async () => {
      setModalMsg({ type: "", text: "" });
      try {
        const res = await apiDimensions(product.id);
        if (!alive) return;
        if (res?.ok) setDims(Array.isArray(res.data) ? res.data : []);
        else {
          setDims([]);
          setModalMsg({ type: "err", text: res?.error || "Error cargando dimensiones." });
        }
      } catch {
        if (!alive) return;
        setDims([]);
        setModalMsg({ type: "err", text: "Error cargando dimensiones." });
      }
    });
    return () => {
      alive = false;
    };
  }, [product.id, startTransition]);

  // Si el producto cambia (por seguridad), reinicia cavidades seleccionadas
  useEffect(() => {
    setSelectedCavities(allCavityIds);
  }, [allCavityIds]);

  // Manejadores
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCavity = (cavId) => {
    setSelectedCavities((prev) =>
      prev.includes(cavId)
        ? prev.filter((id) => id !== cavId)
        : [...prev, cavId].sort((a, b) => a - b)
    );
  };

  const selectAllCavities = () => setSelectedCavities(allCavityIds);
  const deselectAllCavities = () => setSelectedCavities([]);

  const handleStartExecution = () => {
    setModalMsg({ type: "", text: "" });

    // Validación de configuración mínima
    if (!formData.lot || !formData.op_order || !formData.operator || selectedCavities.length === 0) {
      setModalMsg({
        type: "err",
        text: "Complete obligatorios: Lote, O.P., Operador y seleccione cavidades.",
      });
      return;
    }

    if (!dims.length) {
      setModalMsg({
        type: "err",
        text: "No hay dimensiones cargadas para esta referencia.",
      });
      return;
    }

    setStep("execute");
  };

  // Construye mediciones completas (evita guardar registros incompletos)
  const buildMeasurementsStrict = () => {
    const measurements = [];

    for (const cav of selectedCavities) {
      for (let piece = 1; piece <= piecesPerCavity; piece++) {
        for (const d of dims) {
          const key = `${cav}|${piece}|${d.dimension_id}`;
          const raw = vals[key];
          const num = toNumberOrNull(raw);

          if (num === null) {
            return {
              ok: false,
              error: `Falta o es inválida la medición: Cav ${cav} / Pza ${piece} / ${d.desc || d.dimension_id}`,
            };
          }

          measurements.push({
            cavity: cav, // number
            piece, // number
            dimension_id: d.dimension_id,
            value: num, // number (corregido)
            unit: d.unit || "mm",
          });
        }
      }
    }

    return { ok: true, measurements };
  };

  const handleSaveReport = () => {
    setModalMsg({ type: "", text: "" });

    // Validación fuerte: no guardes si falta algo
    const built = buildMeasurementsStrict();
    if (!built.ok) {
      setModalMsg({ type: "err", text: built.error });
      return;
    }

    // Payload corregido (nombres esperados por el backend)
    const payload = {
      product_id: product.id,

      // Campos de muestreo
      lot: formData.lot,
      color: formData.color,
      orden_produccion: formData.op_order,

      // Contexto operativo
      maquina: formData.machine,
      turno: formData.shift,
      operador: formData.operator,
      inspector: formData.inspector,
      equipment: formData.equipment,

      // Configuración
      pieces_per_cavity: piecesPerCavity,
      cavities: selectedCavities,

      // Medición
      measurements: built.measurements,
    };

    startTransition(async () => {
      try {
        const res = await apiPostMeasurements(payload);
        if (res?.ok) {
          // Limpieza + cerrar (evita “arrastrar” mediciones a otra inspección)
          setVals({});
          setDims([]);
          setSelectedCavities(allCavityIds);
          setStep("setup");
          setModalMsg({ type: "", text: "" });
          onClose();
        } else {
          setModalMsg({ type: "err", text: res?.error || "Error al guardar el reporte." });
        }
      } catch {
        setModalMsg({ type: "err", text: "Error de red/servidor al guardar." });
      }
    });
  };

  const handleClose = () => {
    // Limpieza defensiva
    setVals({});
    setDims([]);
    setSelectedCavities(allCavityIds);
    setStep("setup");
    setModalMsg({ type: "", text: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#1F2373]/20 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in">
      {/* MODAL MÁS GRANDE (sin cambiar el estilo general) */}
      <Card
        className={cn(
          "w-full h-[94vh] flex flex-col shadow-2xl relative bg-white border-slate-200",
          "max-w-[1400px]" // antes max-w-5xl -> ahora más ancho para que los cards se vean completos
        )}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1F2373] tracking-tight uppercase flex items-center gap-2">
              <Icons.Box className="w-5 h-5" /> {product.name}
            </h2>
            <div className="flex items-center gap-2 mt-1 pl-7">
              <Badge variant="blue">REF: {product.id}</Badge>
              <span className="text-[10px] text-slate-500 font-mono uppercase">
                Protocolo de Inspección
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-[#1F2373] transition-colors p-1 bg-white border border-slate-200 rounded-sm hover:bg-slate-50"
            aria-label="Cerrar"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje (mínimo, sin alterar el diseño base) */}
        {modalMsg.text && (
          <div className="px-6 py-2 border-b border-slate-100 bg-white">
            <div
              className={cn(
                "inline-flex items-center gap-2 text-xs font-mono px-2 py-1 rounded-sm border",
                modalMsg.type === "err"
                  ? "bg-red-50 text-red-700 border-red-100"
                  : "bg-green-50 text-green-700 border-green-100"
              )}
            >
              <Icons.Alert className="w-4 h-4" />
              {modalMsg.text}
            </div>
          </div>
        )}

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#F9FAFB]">
          {step === "setup" ? (
            /* --- PASO 1: CONFIGURACIÓN Y FORMULARIO --- */
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-2">
              {/* Sección 1: Datos de Producción */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Icons.Settings className="w-4 h-4 text-[#1F2373]" />
                  <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest">
                    Datos de Producción
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InputGroup
                    label="Lote *"
                    value={formData.lot}
                    onChange={(e) => handleInputChange("lot", e.target.value)}
                    placeholder="Ej. 2024-05-A"
                    autoFocus
                    required
                  />
                  <InputGroup
                    label="Orden de Producción (O.P.) *"
                    value={formData.op_order}
                    onChange={(e) => handleInputChange("op_order", e.target.value)}
                    placeholder="Ej. OP-99821"
                    required
                  />
                  <InputGroup
                    label="Color"
                    value={formData.color}
                    onChange={(e) => handleInputChange("color", e.target.value)}
                    placeholder="Ej. Azul Estándar"
                  />
                </div>
              </section>

              {/* Sección 2: Contexto */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Icons.Dashboard className="w-4 h-4 text-[#1F2373]" />
                  <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest">
                    Contexto Operativo
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <InputGroup
                    label="Máquina"
                    value={formData.machine}
                    onChange={(e) => handleInputChange("machine", e.target.value)}
                    placeholder="Ej. INY-04"
                    className="md:col-span-1"
                  />
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[10px] text-[#1F2373] font-bold tracking-widest uppercase ml-1">
                      Turno
                    </label>
                    <Select value={formData.shift} onChange={(e) => handleInputChange("shift", e.target.value)}>
                      <option value="A">Turno A</option>
                      <option value="B">Turno B</option>
                      <option value="C">Turno C</option>
                    </Select>
                  </div>
                  <InputGroup
                    label="Operador *"
                    value={formData.operator}
                    onChange={(e) => handleInputChange("operator", e.target.value)}
                    placeholder="ID o Nombre"
                    className="md:col-span-1"
                    required
                  />
                  <InputGroup
                    label="Inspector"
                    value={formData.inspector}
                    onChange={(e) => handleInputChange("inspector", e.target.value)}
                    placeholder="Opcional"
                    className="md:col-span-1"
                  />
                </div>

                {/* Equipo (mantiene tu lógica previa, sin cambiar estilo) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputGroup
                    label="Equipo de Medición"
                    value={formData.equipment}
                    onChange={(e) => handleInputChange("equipment", e.target.value)}
                    placeholder="Ej. QM-Data 200"
                  />
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#1F2373] font-bold tracking-widest uppercase ml-1">
                      Piezas por Cavidad
                    </label>
                    <Input value={String(piecesPerCavity)} disabled className="bg-slate-100 text-slate-500" />
                    <p className="text-[10px] text-slate-400 font-mono">
                      (Fijo por ahora: 1 pieza / cavidad)
                    </p>
                  </div>
                </div>
              </section>

              {/* Sección 3: Selección de Cavidades */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Icons.Box className="w-4 h-4 text-[#1F2373]" />
                    <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest">
                      Selección de Cavidades
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={selectAllCavities} className="text-[10px] text-[#1F2373] hover:underline font-bold">
                      TODAS
                    </button>
                    <span className="text-slate-300">|</span>
                    <button onClick={deselectAllCavities} className="text-[10px] text-slate-500 hover:text-[#1F2373] hover:underline font-bold">
                      NINGUNA
                    </button>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-sm border border-slate-200">
                  <p className="text-xs text-slate-500 mb-3 font-mono">
                    Seleccione las cavidades físicas a inspeccionar en este muestreo:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allCavityIds.map((cavId) => {
                      const isSelected = selectedCavities.includes(cavId);
                      return (
                        <button
                          key={cavId}
                          onClick={() => toggleCavity(cavId)}
                          className={cn(
                            "w-10 h-10 rounded-sm flex items-center justify-center font-bold font-mono text-sm transition-all border-2",
                            isSelected
                              ? "bg-[#1F2373] text-white border-[#1F2373] shadow-sm"
                              : "bg-slate-50 text-slate-400 border-slate-200 hover:border-[#1F2373]/50 hover:text-[#1F2373]"
                          )}
                        >
                          {cavId}
                        </button>
                      );
                    })}
                  </div>
                  {selectedCavities.length === 0 && (
                    <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
                      <Icons.Alert className="w-3 h-3" /> Debe seleccionar al menos una cavidad.
                    </p>
                  )}
                </div>
              </section>

              <div className="pt-6 border-t border-slate-200 flex justify-end">
                <Button onClick={handleStartExecution} className="px-8 py-3" disabled={isPending}>
                  Continuar a Medición <Icons.Ruler className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : (
            /* --- PASO 2: EJECUCIÓN (MEDICIÓN) --- */
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest flex items-center gap-2">
                  <Icons.Ruler className="w-4 h-4" /> Captura de Datos
                </h3>
                <Badge variant="green">EN PROCESO</Badge>
              </div>

              {/* Grid cavidades (más espacio útil por modal más ancho) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {selectedCavities.map((cav) => (
                  <Card key={cav} className="border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-sm font-bold text-[#1F2373] tracking-widest flex items-center gap-2">
                        <span className="w-6 h-6 bg-[#1F2373] text-white rounded-sm flex items-center justify-center text-xs font-mono">
                          {cav}
                        </span>{" "}
                        CAVIDAD
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">
                        {piecesPerCavity} Pieza / Muestra
                      </span>
                    </div>

                    <div className="p-4 space-y-4 bg-white">
                      {dims.map((d) => {
                        const key = `${cav}|1|${d.dimension_id}`;
                        const nominal = toNumberOrNull(d.nominal);
                        const { min, max } = calcMinMax(d.nominal, d.tol_sup, d.tol_inf);

                        // Estado rápido para borde del input (sin cambiar diseño general)
                        const currentVal = toNumberOrNull(vals[key]);
                        const isBad =
                          currentVal !== null && min !== null && max !== null
                            ? currentVal < min || currentVal > max
                            : false;

                        return (
                          <div key={d.dimension_id} className="grid grid-cols-[1fr_110px] gap-4 items-center group">
                            <div>
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-[#1F2373] font-bold truncate pr-2">
                                  {d.desc}
                                </span>
                                <span className="text-slate-500 font-mono bg-slate-100 px-1.5 rounded-sm">
                                  {nominal !== null ? nominal : d.nominal}
                                </span>
                              </div>

                              {/* Gráfico HUD (con guardas de NaN) */}
                              <IndustrialGraph
                                val={vals[key] ?? ""}
                                min={min}
                                max={max}
                                nominal={nominal ?? 0}
                              />
                            </div>

                            <Input
                              className={cn(
                                "text-right font-mono text-lg py-1 h-10 font-bold tracking-wider",
                                isBad ? "border-red-300 bg-red-50/40" : ""
                              )}
                              placeholder="-"
                              inputMode="decimal"
                              value={vals[key] || ""}
                              onChange={(e) =>
                                setVals((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Solo en ejecución) */}
        {step === "execute" && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep("setup")} disabled={isPending}>
              ← Atrás (Config)
            </Button>

            <div className="flex gap-4 items-center">
              {/* Resumen */}
              <div className="text-right text-xs hidden sm:block font-mono">
                <span className="text-slate-500 block">
                  Lote: <span className="text-[#1F2373] font-bold">{formData.lot}</span>
                </span>
                <span className="text-slate-500">
                  Cavs:{" "}
                  <span className="text-[#1F2373] font-bold">
                    {selectedCavities.join(", ")}
                  </span>
                </span>
              </div>

              <Button
                variant="primary"
                className="px-6 shadow-md"
                onClick={handleSaveReport}
                disabled={isPending}
              >
                {isPending ? "Procesando..." : "Finalizar Inspección"}{" "}
                <Icons.CheckCircle className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

// Helper para Inputs del Formulario
const InputGroup = ({ label, required, className, ...props }) => (
  <div className={cn("space-y-1", className)}>
    <label className="text-[10px] text-[#1F2373] font-bold tracking-widest uppercase ml-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <Input {...props} required={!!required} />
  </div>
);
