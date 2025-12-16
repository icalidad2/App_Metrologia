"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { apiDimensions, apiPostMeasurements } from "@/app/actions/metrologia";
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


export default function InspectionModal({ product, onClose }) {
  const [step, setStep] = useState("setup"); // setup | execute
  const [isPending, startTransition] = useTransition();

  // Mensajería interna
  const [modalMsg, setModalMsg] = useState({ type: "", text: "" });

  // Estado del Formulario Completo (TODOS LOS CAMPOS RECUPERADOS)
  const [formData, setFormData] = useState({
    lot: "",
    op_order: "",
    color: "",
    machine: "",
    shift: "A",
    operator: "",
    inspector: "",
    equipment: "QM-Data 200",
  });

  const { showToast } = useToast();

  // Configuración fija por ahora
  const piecesPerCavity = 1;

  // Estado de Cavidades
  const totalCavities = Number(product?.cavities || 1);
  const allCavityIds = useMemo(
    () => Array.from({ length: totalCavities }, (_, i) => i + 1),
    [totalCavities]
  );
  const [selectedCavities, setSelectedCavities] = useState(allCavityIds);

  // Datos de Medición
  const [dims, setDims] = useState([]);
  const [vals, setVals] = useState({});

  // Cargar Dimensiones al abrir
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
    return () => { alive = false; };
  }, [product.id]);

  // Manejadores de Formulario
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

  // Validar antes de pasar a medir
const handleStartExecution = () => {
  setModalMsg({ type: "", text: "" });

  if (!formData.lot || !formData.op_order || !formData.operator || selectedCavities.length === 0) {
    setModalMsg({
      type: "err",
      text: "Complete obligatorios: Lote, O.P., Operador y seleccione cavidades.",
    });
    showToast({
      variant: "error",
      title: "Faltan datos",
      message: "Completa Lote, O.P., Operador y selecciona cavidades.",
    });
    return;
  }

  if (!dims.length) {
    setModalMsg({ type: "err", text: "No hay dimensiones cargadas para esta referencia." });
    showToast({
      variant: "error",
      title: "Sin dimensiones",
      message: "Esta referencia no tiene variables configuradas.",
    });
    return;
  }

  showToast({
    variant: "success",
    title: "Muestra registrada",
    message: `Lote ${formData.lot} · OP ${formData.op_order}`,
  });

  setStep("execute");
};


  // Guardar Reporte
  const handleSaveReport = () => {
    setModalMsg({ type: "", text: "" });

    // Construir mediciones
    const measurements = [];
    for (const cav of selectedCavities) {
      for (let piece = 1; piece <= piecesPerCavity; piece++) {
        for (const d of dims) {
          const key = `${cav}|${piece}|${d.dimension_id}`;
          const num = toNumberOrNull(vals[key]);

          if (num === null) {
            setModalMsg({ type: "err", text: `Falta valor: Cav ${cav} / ${d.desc}` });
            return;
          }

          measurements.push({
            cavity: cav,
            piece,
            dimension_id: d.dimension_id,
            value: num,
            unit: d.unit || "mm",
          });
        }
      }
    }

    const payload = {
      product_id: product.id,
      lot: formData.lot,
      color: formData.color,             // RECUPERADO
      orden_produccion: formData.op_order,
      maquina: formData.machine,         // RECUPERADO
      turno: formData.shift,             // RECUPERADO
      operador: formData.operator,
      inspector: formData.inspector,     // RECUPERADO
      equipment: formData.equipment,     // RECUPERADO
      pieces_per_cavity: piecesPerCavity,
      cavities: selectedCavities,
      measurements,
    };

startTransition(async () => {
  try {
    const res = await apiPostMeasurements(payload);
    if (res?.ok) {
      showToast({
        variant: "success",
        title: "Mediciones registradas",
        message: `Se guardaron ${measurements.length} mediciones correctamente.`,
      });
      onClose();
    } else {
      setModalMsg({ type: "err", text: res?.error || "Error al guardar el reporte." });
      showToast({
        variant: "error",
        title: "No se pudo guardar",
        message: res?.error || "Error al guardar el reporte.",
      });
    }
  } catch {
    setModalMsg({ type: "err", text: "Error de red/servidor al guardar." });
    showToast({
      variant: "error",
      title: "Error de red/servidor",
      message: "No se pudo guardar. Intenta nuevamente.",
    });
  }
});
  };

  return (
    <div className="fixed inset-0 bg-[#1F2373]/20 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in">
      {/* Modal Container */}
      <Card className="w-full h-[94vh] flex flex-col shadow-2xl relative bg-white border-slate-200 max-w-[1400px]">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
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
            onClick={onClose}
            className="text-slate-400 hover:text-[#1F2373] transition-colors p-1 bg-white border border-slate-200 rounded-sm hover:bg-slate-50"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        {/* MENSAJES DE ERROR */}
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

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F9FAFB]">
          {step === "setup" ? (
            /* --- PASO 1: CONFIGURACIÓN (TODOS LOS CAMPOS) --- */
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-2">
              
              {/* Sección 1: Producción */}
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
                    placeholder="Ej. 251201"
                    autoFocus
                    required
                  />
                  <InputGroup
                    label="Orden de Producción (O.P.) *"
                    value={formData.op_order}
                    onChange={(e) => handleInputChange("op_order", e.target.value)}
                    placeholder="Opcional"
                  />
                  <InputGroup
                    label="Color"
                    value={formData.color}
                    onChange={(e) => handleInputChange("color", e.target.value)}
                    placeholder="Ej. Azul Electrico"
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
                      <option value="T1">Turno 1</option>
                      <option value="2">Turno 2</option>
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
                  </div>
                </div>
              </section>

              {/* Sección 3: Cavidades */}
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
                </div>
              </section>

              <div className="pt-6 border-t border-slate-200 flex justify-end">
                <Button onClick={handleStartExecution} className="px-8 py-3" disabled={isPending}>
                  Continuar a Medición <Icons.Ruler className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : (
            /* --- PASO 2: EJECUCIÓN (IGUAL QUE ANTES) --- */
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-[#1F2373] uppercase tracking-widest flex items-center gap-2">
                  <Icons.Ruler className="w-4 h-4" /> Captura de Datos
                </h3>
                <Badge variant="green">EN PROCESO</Badge>
              </div>

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
                    </div>

                    <div className="p-4 space-y-4 bg-white">
                      {dims.map((d) => {
                        const key = `${cav}|1|${d.dimension_id}`;
                        const nominal = toNumberOrNull(d.nominal);
                        const { min, max } = calcMinMax(d.nominal, d.tol_sup, d.tol_inf);
                        const currentVal = toNumberOrNull(vals[key]);
                        const isBad = currentVal !== null && min !== null && max !== null && (currentVal < min || currentVal > max);

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

        {/* FOOTER ACTIONS (Paso 2) */}
        {step === "execute" && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep("setup")} disabled={isPending}>
              ← Atrás (Config)
            </Button>
            <div className="flex gap-4 items-center">
               <div className="text-right text-xs hidden sm:block font-mono">
                <span className="text-slate-500 block">Lote: <span className="text-[#1F2373] font-bold">{formData.lot}</span></span>
              </div>
              <Button onClick={handleSaveReport} disabled={isPending} className="shadow-md px-6">
                {isPending ? "Guardando..." : "Finalizar Inspección"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// Helper interno para agrupar Label + Input
const InputGroup = ({ label, required, className, ...props }) => (
  <div className={cn("space-y-1", className)}>
    <label className="text-[10px] text-[#1F2373] font-bold tracking-widest uppercase ml-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <Input {...props} required={!!required} />
  </div>
);