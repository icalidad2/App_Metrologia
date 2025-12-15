import { cn } from "@/lib/utils";

export const Button = ({ children, variant = "primary", className, ...props }) => {
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