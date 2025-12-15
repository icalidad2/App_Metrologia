import { cn } from "@/lib/utils";

export const Input = ({ className, ...props }) => (
  <input
    className={cn(
      "w-full bg-slate-50 border border-slate-200 text-[#1F2373] text-sm px-3 py-2.5 rounded-sm focus:outline-none focus:border-[#1F2373] focus:ring-1 focus:ring-[#1F2373]/20 transition-all font-mono placeholder:text-slate-400",
      className
    )}
    {...props}
  />
);