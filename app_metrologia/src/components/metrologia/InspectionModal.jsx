"use client";

import { useState, useEffect, useTransition, useMemo, useRef } from "react";
import Image from "next/image"; 
import { apiDimensions, apiPostMeasurements, apiColors } from "@/app/actions/metrologia";
import { cn, toNumberOrNull, calcMinMax } from "@/lib/utils";

// Componentes UI
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Icons } from "@/components/ui/Icons";
import IndustrialGraph from "./IndustrialGraph";
import { useToast } from "@/components/ui/ToastProvider";

// --- CONFIGURACIÓN MANUAL DE PLANOS ---
const BLUEPRINT_MAP = {
  "PP-047": "plano_steripod.png",   
  "ID-002": "plano_steripod.png",
  "ID-003": "plano_steripod.png",
  "ID-004": "plano_steripod.png",
  "ID-005": "plano_steripod.png",
  "ID-006": "plano_steripod.png",
  "ID-007": "plano_steripod.png",
  "ID-008": "plano_steripod.png",
  "ID-009": "plano_tapaclip.png",
  // Asegúrate de que estos IDs coincidan con los de tu HUB
};

export default function InspectionModal({ product, onClose }) {
  const [step, setStep] = useState("setup");
  const [isPending, startTransition] = useTransition();
  const [modalMsg, setModalMsg] = useState({ type: "", text: "" });

  // Estado para la lista de colores
  const [colorsList, setColorsList] = useState([]);

  // Refs para scroll
  const inputRefs = useRef({});

  // Formulario
  const [formData, setFormData] = useState({
    lot: "",
    manufacturing_date: new Date().toISOString().split('T')[0],
    op_order: "",
    color: "",
    machine: "",
    shift: "A",
    operator: "",
    inspector: "",
    equipment: "QM-Data 200",
  });

  const { showToast } = useToast();

  // Configuración de cavidades
  const piecesPerCavity = 1;
  const totalCavities = Number(product?.cavities || 1); 
  
  const allCavityIds = useMemo(
    () => Array.from({ length: totalCavities }, (_, i) => i + 1),
    [totalCavities]
  );
  
  const [selectedCavities, setSelectedCavities] = useState(allCavityIds);
  const [dims, setDims] = useState([]);
  const [vals, setVals] = useState({});

  // Detección de plano
  const blueprintFile = BLUEPRINT_MAP[product.id];
  const hasBlueprint = !!blueprintFile;

  // --- CARGA DE DATOS ---
  useEffect(() => {
    let alive = true;
    startTransition(async () => {
      setModalMsg({ type: "", text: "" });
      try {
        const [dimRes, colorRes] = await Promise.all([
            apiDimensions(product.id),
            apiColors()
        ]);

        if (!alive) return;

        // 1. Dimensiones
        if (dimRes?.ok) setDims(Array.isArray(dimRes.data) ? dimRes.data : []);
        else {
          setDims([]);
          setModalMsg({ type: "err", text: dimRes?.error || "Error cargando dimensiones." });
        }

        // 2. Colores (Sin filtrar duplicados, los queremos todos)
        if (colorRes?.ok && Array.isArray(colorRes.data)) {
            const sortedList = colorRes.data.sort((a, b) => a.name.localeCompare(b.name));
            setColorsList(sortedList);
        }

      } catch {
        if (!alive) return;
        setDims([]);
        setModalMsg({ type: "err", text: "Error de conexión inicial." });
      }
    });
    return () => { alive = false; };
  }, [product.id]);

  // Helpers
  const handleInputChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  
  const sortCavities = (list) => list.sort((a, b) => {
      const isNumA = typeof a === "number";
      const isNumB = typeof b === "number";
      if (isNumA && isNumB) return a - b;
      if (isNumA) return -1;
      if (isNumB) return 1;
      return String(a).localeCompare(String(b), undefined, { numeric: true });
  });

  const toggleCavity = (id) => setSelectedCavities(p => {
      const exists = p.includes(id);
      const next = exists ? p.filter(x => x !== id) : [...p, id];
      return sortCavities(next);
  });

  const addUnknownCavity = () => setSelectedCavities(p => {
      let c = 1; while (p.includes(`?${c}`)) c++;
      return sortCavities([...p, `?${c}`]);
  });

  const removeUnknownCavity = (id) => setSelectedCavities(p => p.filter(x => x !== id));
  
  const selectAllCavities = () => setSelectedCavities(p => {
      const u = p.filter(id => typeof id !== 'number');
      return sortCavities([...allCavityIds, ...u]);
  });
  
  const deselectAllCavities = () => setSelectedCavities([]);

  // Validación
  const handleStartExecution = () => {
    setModalMsg({ type: "", text: "" });
    if (!formData.lot || !formData.op_order || !formData.operator || !formData.color || selectedCavities.length === 0) {
      showToast({ variant: "error", title: "Faltan datos", message: "Complete Lote, OP, Color, Operador y Cavidades." });
      return;
    }
    if (!dims.length) {
      setModalMsg({ type: "err", text: "Sin dimensiones configuradas." });
      return;
    }
    setStep("execute");
  };

  // Guardar
  const handleSaveReport = () => {
    setModalMsg({ type: "", text: "" });
    const measurements = [];

    for (const cav of selectedCavities) {
      for (let piece = 1; piece <= piecesPerCavity; piece++) {
        for (const d of dims) {
          const key = `${cav}|${piece}|${d.dimension_id}`;
          const num = toNumberOrNull(vals[key]);
          const isIllegibleVal = vals[key] === "ILEGIBLE";

          if (!isIllegibleVal && num === null) {
             const refKey = `${cav}-${d.dimension_id}`;
             inputRefs.current[refKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             setModalMsg({ type: "err", text: `Falta valor: ${cav} / ${d.desc}` });
             return;
          }

          measurements.push({
            cavity: cav,
            piece,
            dimension_id: d.dimension_id,
            value: isIllegibleVal ? "ILEGIBLE" : num,
            unit: d.unit || "mm",
          });
        }
      }
    }

    const payload = {
      product_id: product.id,
      lot: formData.lot,
      fecha_fabricacion: formData.manufacturing_date,
      color: formData.color,
      orden_produccion: formData.op_order,
      maquina: formData.machine,
      turno: formData.shift,
      operador: formData.operator,
      inspector: formData.inspector,
      equipment: formData.equipment,
      pieces_per_cavity: piecesPerCavity,
      cavities: selectedCavities,
      measurements,
    };

    startTransition(async () => {
      try {
        const res = await apiPostMeasurements(payload);
        if (res?.ok) {
          showToast({ variant: "success", title: "Guardado", message: `${measurements.length} datos registrados.` });
          onClose();
        } else {
          setModalMsg({ type: "err", text: res?.error || "Error al guardar." });
        }
      } catch {
        setModalMsg({ type: "err", text: "Error de conexión." });
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-[#1F2373]/20 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4 animate-modal-overlay overflow-hidden">
      <Card className={cn(
          "w-full h-[96vh] flex flex-col shadow-2xl relative bg-white border-slate-200 animate-modal-content transition-all duration-500",
          step === 'execute' && hasBlueprint ? "max-w-[95vw]" : "max-w-[1200px]"
      )}>
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b bg-slate-50/50 flex justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#1F2373] uppercase flex items-center gap-2">
              <Icons.Box className="w-5 h-5" /> {product.name}
            </h2>
            <div className="pl-7 mt-1 flex items-center gap-2">
                <Badge variant="blue">REF: {product.id}</Badge>
                {hasBlueprint && step === 'execute' && (
                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                        <Icons.Dashboard className="w-3 h-3 mr-1" /> Plano de Referencia
                    </Badge>
                )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-[#1F2373] p-1 border rounded-sm"><Icons.Close className="w-5 h-5" /></button>
        </div>

        {/* MENSAJES */}
        {modalMsg.text && (
          <div className="px-6 py-2 border-b bg-white shrink-0">
            <div className={cn("inline-flex items-center gap-2 text-xs font-mono px-2 py-1 rounded-sm border",
              modalMsg.type === "err" ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100")}>
              <Icons.Alert className="w-4 h-4" /> {modalMsg.text}
            </div>
          </div>
        )}

        {/* BODY */}
        <div className="flex-1 overflow-hidden flex relative">
          
          {/* PASO 1: SETUP */}
          {step === "setup" && (
             <div className="flex-1 overflow-y-auto p-6 bg-[#F9FAFB]">
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
                    <SetupForm 
                        formData={formData} handleInputChange={handleInputChange} 
                        piecesPerCavity={piecesPerCavity} allCavityIds={allCavityIds}
                        selectedCavities={selectedCavities} toggleCavity={toggleCavity}
                        selectAllCavities={selectAllCavities} deselectAllCavities={deselectAllCavities}
                        addUnknownCavity={addUnknownCavity} removeUnknownCavity={removeUnknownCavity}
                        colorsList={colorsList}
                    />
                     <div className="pt-6 border-t flex justify-end">
                        <Button onClick={handleStartExecution} className="px-8 py-3" disabled={isPending}>
                        Continuar <Icons.Ruler className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
             </div>
          )}

          {/* PASO 2: EXECUTE */}
          {step === "execute" && (
            <div className={cn(
                "flex-1 w-full h-full",
                hasBlueprint ? "grid grid-cols-1 lg:grid-cols-[40%_60%] divide-x divide-slate-200" : ""
            )}>
                {hasBlueprint && (
                    <div className="hidden lg:flex flex-col h-full bg-slate-100/50 p-4 relative animate-in slide-in-from-left-4 duration-500">
                        <div className="mb-3 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest">Plano Mecánico</h3>
                            <span className="text-[10px] text-slate-400 font-mono">{blueprintFile}</span>
                        </div>
                        <div className="flex-1 relative bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex items-center justify-center">
                             <div className="relative w-full h-full p-2">
                                <Image src={`/blueprints/${blueprintFile}`} alt="Plano" fill className="object-contain" />
                             </div>
                        </div>
                        <div className="mt-2 text-center">
                            <p className="text-[10px] text-slate-400">Referencia visual para la toma de medidas.</p>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F9FAFB] scroll-smooth">
                    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest flex items-center gap-2">
                            <Icons.Ruler className="w-4 h-4" /> Captura de Datos
                            </h3>
                            <div className="text-right text-xs hidden sm:block font-mono">
                                <span className="text-slate-500">Lote: <span className="text-[#1F2373] font-bold">{formData.lot}</span></span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {selectedCavities.map((cav) => (
                                <CavityCard 
                                    key={cav} cav={cav} dims={dims} vals={vals} setVals={setVals} 
                                    inputRefs={inputRefs} 
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {step === "execute" && (
          <div className="p-4 border-t bg-slate-50 shrink-0 flex justify-between">
            <Button variant="outline" onClick={() => setStep("setup")} disabled={isPending}>← Atrás</Button>
            <Button onClick={handleSaveReport} disabled={isPending} className="px-6 shadow-md">{isPending ? "Guardando..." : "Finalizar"}</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// --- SUBCOMPONENTES ---

const SetupForm = ({ 
    formData, handleInputChange, piecesPerCavity, allCavityIds, 
    selectedCavities, toggleCavity, selectAllCavities, deselectAllCavities, 
    addUnknownCavity, removeUnknownCavity, colorsList 
}) => {
    return (
      <>
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <Icons.Settings className="w-4 h-4 text-[#1F2373]" />
            <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest">Datos de Producción</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InputGroup label="Fecha Fabricación *" type="date" value={formData.manufacturing_date} onChange={(e) => handleInputChange("manufacturing_date", e.target.value)} required />
            <InputGroup label="Lote *" value={formData.lot} onChange={(e) => handleInputChange("lot", e.target.value)} placeholder="Ej. 251201" autoFocus required />
            <InputGroup label="O.P. *" value={formData.op_order} onChange={(e) => handleInputChange("op_order", e.target.value)} placeholder="Opcional" />
            
            {/* SELECTOR DE COLOR CORREGIDO Y BLINDADO */}
            <div className="space-y-1">
                <label className="text-[10px] text-[#1F2373] font-bold uppercase ml-1">Color *</label>
                <Select 
                    value={formData.color} 
                    onChange={(e) => handleInputChange("color", e.target.value)}
                    required
                >
                    <option value="">-- Seleccionar --</option>
                    {colorsList && colorsList.length > 0 ? (
                        colorsList.map((c) => {
                            // GENERACIÓN DE NOMBRE ÚNICO:
                            // Si tiene código: "AMARILLO [AMA-STD]"
                            // Si no tiene código: "AMARILLO [C-001]" (Usamos ID)
                            const suffix = c.code ? c.code : c.id;
                            const label = `${c.name} [${suffix}]`;
                            
                            return (
                                // Usamos c.id como KEY, que es 100% único en la BD.
                                <option key={c.id} value={label}>
                                    {label}
                                </option>
                            );
                        })
                    ) : (
                        <option value="" disabled>Cargando colores...</option>
                    )}
                </Select>
            </div>
          </div>
        </section>
  
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <Icons.Dashboard className="w-4 h-4 text-[#1F2373]" />
            <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest">Contexto Operativo</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InputGroup label="Máquina" value={formData.machine} onChange={(e) => handleInputChange("machine", e.target.value)} />
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] text-[#1F2373] font-bold tracking-widest uppercase ml-1">Turno</label>
              <Select value={formData.shift} onChange={(e) => handleInputChange("shift", e.target.value)}>
                <option value="A">Turno A</option><option value="B">Turno B</option><option value="C">Turno C</option>
              </Select>
            </div>
            <InputGroup label="Operador *" value={formData.operator} onChange={(e) => handleInputChange("operator", e.target.value)} required />
            <InputGroup label="Inspector" value={formData.inspector} onChange={(e) => handleInputChange("inspector", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup label="Equipo de Medición" value={formData.equipment} onChange={(e) => handleInputChange("equipment", e.target.value)} />
            <div className="space-y-1"><label className="text-[10px] text-[#1F2373] font-bold tracking-widest uppercase ml-1">Piezas por Cavidad</label><Input value={String(piecesPerCavity)} disabled className="bg-slate-100 text-slate-500" /></div>
          </div>
        </section>
  
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2"><Icons.Box className="w-4 h-4 text-[#1F2373]" /><h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest">Selección de Cavidades</h3></div>
            <div className="flex gap-2"><button onClick={selectAllCavities} className="text-[10px] text-[#1F2373] hover:underline font-bold">TODAS</button><span className="text-slate-300">|</span><button onClick={deselectAllCavities} className="text-[10px] text-slate-500 hover:text-[#1F2373] hover:underline font-bold">NINGUNA</button></div>
          </div>
          <div className="bg-white p-4 rounded-sm border border-slate-200 space-y-4">
            <div className="flex flex-wrap gap-2">
              {allCavityIds.map((cavId) => {
                const isSelected = selectedCavities.includes(cavId);
                return (<button key={cavId} onClick={() => toggleCavity(cavId)} className={cn("w-10 h-10 rounded-sm flex items-center justify-center font-bold font-mono text-sm transition-all border-2", isSelected ? "bg-[#1F2373] text-white border-[#1F2373] shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200 hover:border-[#1F2373]/50 hover:text-[#1F2373]")}>{cavId}</button>);
              })}
            </div>
            <div className="pt-3 border-t border-dashed border-slate-200"><div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center"><Button onClick={addUnknownCavity} variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 h-8 text-xs px-3"><Icons.Plus className="w-3 h-3 mr-2" />Agregar Muestra Ilegible</Button><span className="text-[10px] text-slate-400 italic">Usa esto si tienes piezas sin número visible.</span></div><div className="flex flex-wrap gap-2 mt-3">{selectedCavities.filter(c => typeof c !== 'number').map(unkId => (<div key={unkId} className="flex items-center bg-amber-100 border border-amber-200 text-amber-900 rounded-sm px-2 py-1 shadow-sm"><span className="font-mono font-bold text-xs mr-2">{unkId}</span><button onClick={() => removeUnknownCavity(unkId)} className="text-amber-700 hover:text-red-600"><Icons.Close className="w-3 h-3" /></button></div>))}</div></div>
          </div>
        </section>
      </>
    );
};

const CavityCard = ({ cav, dims, vals, setVals, inputRefs }) => {
    const isUnknown = typeof cav !== 'number';
    return (
      <Card className={cn("border-slate-200 shadow-sm overflow-hidden", isUnknown && "border-amber-200 ring-2 ring-amber-50")}>
        <div className={cn("px-4 py-3 border-b flex justify-between items-center", isUnknown ? "bg-amber-50/80 border-amber-100" : "bg-slate-50/80 border-slate-200")}>
          <span className="text-sm font-bold text-[#1F2373] tracking-widest flex items-center gap-2">
            <span className={cn("w-auto min-w-6 h-6 px-1.5 bg-[#1F2373] text-white rounded-sm flex items-center justify-center text-xs font-mono", isUnknown && "bg-amber-600")}>
              {cav}
            </span> {isUnknown ? "CAVIDAD DESC." : "CAVIDAD"}
          </span>
        </div>
        <div className="p-4 space-y-4 bg-white">
          {dims.map((d) => {
            const key = `${cav}|1|${d.dimension_id}`;
            const refKey = `${cav}-${d.dimension_id}`; 
            const rawVal = vals[key];
            const isIllegibleVal = rawVal === "ILEGIBLE";
            const valNum = toNumberOrNull(rawVal);
            const { min, max } = calcMinMax(d.nominal, d.tol_sup, d.tol_inf);
            const isBad = !isIllegibleVal && valNum !== null && (valNum < min || valNum > max);
  
            return (
              <div key={d.dimension_id} ref={el => inputRefs.current[refKey] = el} className="grid grid-cols-[1fr_110px_auto] gap-3 items-center group">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-[#1F2373] truncate">{d.desc}</span>
                    <span className="text-slate-500 font-mono bg-slate-100 px-1 rounded">{d.nominal}</span>
                  </div>
                  <IndustrialGraph val={isIllegibleVal ? "" : (rawVal??"")} min={min} max={max} nominal={toNumberOrNull(d.nominal)||0} />
                </div>
                <Input 
                  className={cn("text-right font-mono text-lg font-bold h-10", isBad && "bg-red-50 border-red-300", isIllegibleVal && "bg-slate-100 text-slate-400 text-sm italic")}
                  placeholder="-"
                  type={isIllegibleVal ? "text" : "number"}
                  inputMode={isIllegibleVal ? "text" : "decimal"}
                  disabled={isIllegibleVal}
                  value={isIllegibleVal ? "ILEGIBLE" : (rawVal || "")}
                  onChange={(e) => setVals(p => ({ ...p, [key]: e.target.value }))}
                />
                <div className="flex flex-col items-center justify-center pt-4">
                  <input type="checkbox" className="w-4 h-4 rounded text-[#1F2373]" checked={isIllegibleVal} onChange={(e) => setVals(p => ({ ...p, [key]: e.target.checked ? "ILEGIBLE" : "" }))} />
                  <span className="text-[9px] text-slate-400">N/A</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
};

const InputGroup = ({ label, required, className, ...props }) => (
  <div className={cn("space-y-1", className)}>
    <label className="text-[10px] text-[#1F2373] font-bold uppercase ml-1">{label} {required && "*"}</label>
    <Input {...props} required={required} />
  </div>
);