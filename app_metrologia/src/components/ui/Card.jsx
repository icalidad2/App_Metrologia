import { cn } from "@/lib/utils";

export const Card = ({ children, className, onClick }) => (
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