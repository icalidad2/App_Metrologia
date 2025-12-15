import { cn, toNumberOrNull } from "@/lib/utils";

export default function IndustrialGraph({ val, min, max, nominal }) {
  const v = toNumberOrNull(val);
  const nNom = toNumberOrNull(nominal);
  const nMin = toNumberOrNull(min);
  const nMax = toNumberOrNull(max);

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
}