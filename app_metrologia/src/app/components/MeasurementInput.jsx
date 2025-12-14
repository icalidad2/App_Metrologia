function MeasurementInput({ dim, value, onChange }) {
  const { min, max } = calcMinMax(dim.nominal, dim.tol_sup, dim.tol_inf);
  
  let statusColor = "border-zinc-800 bg-zinc-900"; // Default
  if (value !== "") {
    const val = Number(value);
    if (val < min || val > max) statusColor = "border-rose-500 bg-rose-500/10 text-rose-500";
    else statusColor = "border-emerald-500 bg-emerald-500/10 text-emerald-500";
  }

  return (
    <input
      value={value}
      onChange={onChange}
      type="number"
      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${statusColor}`}
    />
  );
}