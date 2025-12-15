import { cn } from "@/lib/utils";

export const Badge = ({ children, variant = "default", className }) => {
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