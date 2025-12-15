import { cn } from "@/lib/utils";

export const Select = ({ className, children, ...props }) => (
  <select
    className={cn(
      "w-full bg-slate-50 border border-slate-200 text-[#1F2373] text-sm px-3 py-2.5 rounded-sm",
      "focus:outline-none focus:border-[#1F2373] focus:ring-1 focus:ring-[#1F2373]/20 transition-all font-mono",
      "appearance-none pr-8",
      "bg-no-repeat bg-[length:0.7em] bg-[position:right_0.7em_center]",
      "bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231F2373%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2087.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%20100c3.6-3.6%205.4-7.8%205.4-12.8%200-5-1.8-9.3-5.4-12.9z%22%2F%3E%3C%2Fsvg%3E')]",
      className
    )}
    {...props}
  >
    {children}
  </select>
);