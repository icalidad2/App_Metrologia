"use client";

import { useState, useEffect, useMemo } from "react";
import { apiHistory, apiProducts, apiDimensions } from "@/app/actions/metrologia";
import { calculateStats } from "@/lib/statistics";

// Componentes UI
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Icons } from "@/components/ui/Icons";
import { cn, toNumberOrNull } from "@/lib/utils";
import ProcessChart from "@/components/metrologia/ProcessChart";

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

  // 1. Cargar Datos Iniciales
  useEffect(() => {
    // A. Productos
    apiProducts().then((r) => {
      setProducts((r?.ok && Array.isArray(r.data)) ? r.data : []);
    });

    // B. Historial (CORRECCIÓN AQUÍ)
    setLoadingHistory(true);
    apiHistory({ limit: 1000 }).then((r) => {
      if (r?.ok) {
        // Tu backend devuelve { data: { items: [...] } }
        if (r.data && Array.isArray(r.data.items)) {
          setHistory(r.data.items);
        } 
        // Por si acaso devolviera un array directo en el futuro
        else if (Array.isArray(r.data)) {
          setHistory(r.data);
        } else {
          setHistory([]);
        }
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
      // Buscamos las dimensiones usando el ID del producto seleccionado
      apiDimensions(selectedProductId).then(r => {
           if(r?.ok && Array.isArray(r.data)) {
               setDimensions(r.data);
           } else {
               setDimensions([]);
           }
           setLoadingDims(false);
      });
    } else {
      setDimensions([]);
      setSelectedDimId("ALL");
    }
  }, [selectedProductId]);

  // 3. LÓGICA MAESTRA: Normalización y Cálculos
  const { globalStats, dimensionStats, debugInfo } = useMemo(() => {
    const safeHistory = Array.isArray(history) ? history : [];

    // PASO A: Enriquecer datos (Unir con nombre de producto)
    // Tu historial trae 'product_id', buscamos el 'name' en el array 'products'
    const enrichedData = safeHistory.map(m => {
        const prod = products.find(p => String(p.id) === String(m.product_id));
        return {
            ...m,
            product_name: prod ? prod.name : m.product_id, // Fallback al ID si no encuentra nombre
            // Asegurar que value sea número
            valueNum: toNumberOrNull(m.value)
        };
    });

    // PASO B: Filtrar por Producto Seleccionado
    const filteredData = selectedProductId === "ALL" 
      ? enrichedData 
      : enrichedData.filter(m => String(m.product_id) === String(selectedProductId));

    // PASO C: KPIs Globales (Conformidad)
    const total = filteredData.length;
    const ok = filteredData.filter(m => {
        const res = String(m.result || "").toUpperCase();
        return res === "OK" || res === "APROBADO";
    }).length;
    const ng = total - ok;
    const rate = total > 0 ? ((ok / total) * 100).toFixed(1) : "0.0";

    // PASO D: Estadísticas de Dimensión (Cp, Cpk, Gráfico)
    let dimStats = null;
    let rawValues = [];
    let msg = "";

    if (selectedProductId !== "ALL" && selectedDimId !== "ALL") {
       const dimDef = dimensions.find(d => String(d.dimension_id) === String(selectedDimId));
       
       if (dimDef) {
           // Filtrar solo la dimensión seleccionada y valores válidos
           rawValues = filteredData
              .filter(m => String(m.dimension_id) === String(selectedDimId))
              .map(m => m.valueNum)
              .filter(v => v !== null);

           if (rawValues.length === 0) {
               msg = "No se encontraron valores numéricos para esta dimensión.";
           } else if (rawValues.length < 2) {
               msg = `Datos insuficientes (${rawValues.length}) para calcular estadística (mínimo 2).`;
           } else {
               // ¡CALCULAR!
               dimStats = calculateStats(rawValues, dimDef.nominal, dimDef.tol_sup, dimDef.tol_inf);
           }
       } else {
           msg = "No se encontró la definición de tolerancias para esta dimensión.";
       }
    }

    return { 
        globalStats: { total, ok, ng, rate },
        dimensionStats: dimStats ? { ...dimStats, values: rawValues } : null,
        debugInfo: msg
    };

  }, [history, products, selectedProductId, selectedDimId, dimensions]);

  return (
    <div className="space-y-6">
      {/* HEADER & FILTROS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2373] tracking-tight uppercase">Dashboard de Calidad</h1>
          <p className="text-sm text-slate-500 font-mono mt-1">
             {loadingHistory ? "Sincronizando..." : `Registros analizados: ${history.length}`}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
           {/* Filtro Producto */}
           <div className="w-full sm:w-64">
               <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 block">Producto</label>
               <Select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                   <option value="ALL">Resumen Global</option>
                   {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </Select>
           </div>
           
           {/* Filtro Dimensión */}
           <div className="w-full sm:w-64">
               <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">
                   <span>Dimensión (Variable)</span>
                   {loadingDims && <span className="text-[#1F2373] animate-pulse">Cargando...</span>}
               </label>
               <Select 
                 value={selectedDimId} 
                 onChange={(e) => setSelectedDimId(e.target.value)}
                 disabled={selectedProductId === "ALL" || dimensions.length === 0}
                 className="disabled:opacity-50 disabled:bg-slate-100"
               >
                   <option value="ALL">-- Seleccionar Variable --</option>
                   {dimensions.map(d => (
                       <option key={d.dimension_id} value={d.dimension_id}>
                           {d.desc || d.dimension_id} ({d.nominal})
                       </option>
                   ))}
               </Select>
           </div>
        </div>
      </div>

      {/* NIVEL 1: KPIs GLOBALES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Mediciones" value={globalStats.total} icon="Box" />
        <KpiCard title="% Conformidad" value={`${globalStats.rate}%`} icon="CheckCircle" color="text-green-600" bg="bg-green-50" />
        <KpiCard title="Fuera de Esp." value={globalStats.ng} icon="Alert" color="text-red-600" bg="bg-red-50" />
        
        <div className="hidden md:flex items-center justify-center p-4 border border-slate-200 border-dashed rounded-sm text-center">
            <p className="text-xs text-slate-400">
               {selectedProductId === "ALL" ? "Selecciona un producto" : 
                selectedDimId === "ALL" ? "Selecciona una variable para ver Gráficos" : "Visualizando datos"}
            </p>
        </div>
      </div>

      {/* NIVEL 2: ANÁLISIS ESTADÍSTICO */}
      {dimensionStats ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
              <div className="flex items-center gap-2 mt-8">
                  <Icons.Filter className="w-5 h-5 text-[#1F2373]" />
                  <h2 className="text-lg font-bold text-[#1F2373] uppercase">Capacidad del Proceso (SPC)</h2>
                  <Badge variant="blue">Muestras: {dimensionStats.n}</Badge>
              </div>

              {/* Tarjetas Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Media (μ)" value={dimensionStats.mean.toFixed(3)} />
                  <StatCard label="Sigma (σ)" value={dimensionStats.sigma.toFixed(4)} />
                  <StatCard 
                    label="Cp" 
                    value={dimensionStats.cp.toFixed(2)} 
                    highlight={dimensionStats.cp < 1.33} 
                  />
                  <StatCard 
                    label="Cpk" 
                    value={dimensionStats.cpk.toFixed(2)} 
                    highlight={dimensionStats.cpk < 1.33}
                    subtext={dimensionStats.cpk < 1.33 ? "Incapaz" : "Capaz"}
                  />
              </div>

              {/* GRÁFICO */}
              <Card className="p-6">
                  <h3 className="text-sm font-bold text-slate-600 mb-2">Distribución de Valores (Histograma)</h3>
                  <ProcessChart data={dimensionStats.values} stats={dimensionStats} />
              </Card>
          </div>
      ) : (
          /* Mensajes de Estado / Error */
          selectedProductId !== "ALL" && selectedDimId !== "ALL" && (
            <div className="h-40 bg-slate-50 border border-dashed border-slate-300 rounded-sm flex flex-col items-center justify-center text-slate-400 mt-8 gap-2">
                <Icons.Alert className="w-8 h-8 opacity-50" />
                <p className="font-bold text-sm">No se pudo generar el gráfico</p>
                <p className="text-xs font-mono text-slate-500">{debugInfo}</p>
            </div>
          )
      )}
    </div>
  );
}

// --- Subcomponentes ---

function KpiCard({ title, value, icon, color = "text-[#1F2373]", bg = "bg-slate-100" }) {
  const Icon = Icons[icon] || Icons.Box;
  return (
    <Card className="p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
       <div>
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
         <p className={cn("text-2xl font-mono font-bold mt-1", color)}>{value}</p>
       </div>
       <div className={cn("p-2 rounded-sm", bg, color)}><Icon className="w-6 h-6" /></div>
    </Card>
  );
}

function StatCard({ label, value, highlight, subtext }) {
    return (
        <Card className={cn("p-4 border-l-4", highlight ? "border-l-red-500" : "border-l-[#3A8C37]")}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className={cn("text-xl font-mono font-bold mt-1", highlight ? "text-red-600" : "text-slate-700")}>
                {value}
            </p>
            {subtext && <p className={cn("text-[9px] font-bold uppercase mt-1", highlight ? "text-red-500" : "text-green-600")}>{subtext}</p>}
        </Card>
    )
}

function Badge({ variant, children }) {
    const style = variant === "blue" ? "bg-[#1F2373]/10 text-[#1F2373] border-[#1F2373]/20" : "bg-slate-100 text-slate-600";
    return <span className={cn("px-2 py-0.5 rounded-sm text-[10px] font-bold border uppercase", style)}>{children}</span>;
}