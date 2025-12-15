"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Icons } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (path) => pathname === path;

  return (
    <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm sticky top-0 h-screen">
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
        <Image src="/logo.svg" alt="Logo" width={20} height={20} className="w-15 h-15" />
        <div className="ml-3 text-sm font-bold tracking-widest text-[#1F2373] uppercase">
          Metrologia<span className="font-light">| Q.C</span>
        </div>
      </div>

      {/* Menú */}
      <div className="p-4 space-y-1 flex-1 overflow-y-auto">
        <div className="px-2 py-1.5 text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-2">
          Gestión
        </div>

        {/* 1. DASHBOARD (Solo métricas) */}
        <Link href="/dashboard">
          <button className={cn("w-full flex items-center px-3 py-2 text-sm font-bold transition-all duration-200 group rounded-r-sm border-l-2", isActive("/dashboard") ? "text-[#1F2373] bg-slate-50 border-[#1F2373]" : "text-slate-500 border-transparent hover:text-[#1F2373] hover:bg-slate-50 hover:border-slate-200")}>
            <Icons.Dashboard className={cn("w-4 h-4 mr-3 transition-colors", isActive("/dashboard") ? "text-[#1F2373]" : "text-slate-400 group-hover:text-[#1F2373]")} />
            Panel de Monitoreo
          </button>
        </Link>

        {/* 2. INSPECCIÓN (Nueva sección operativa) */}
        <Link href="/inspeccion">
          <button className={cn("w-full flex items-center px-3 py-2 text-sm font-bold transition-all duration-200 group rounded-r-sm border-l-2", isActive("/inspeccion") ? "text-[#1F2373] bg-slate-50 border-[#1F2373]" : "text-slate-500 border-transparent hover:text-[#1F2373] hover:bg-slate-50 hover:border-slate-200")}>
            <Icons.Ruler className={cn("w-4 h-4 mr-3 transition-colors", isActive("/inspeccion") ? "text-[#1F2373]" : "text-slate-400 group-hover:text-[#1F2373]")} />
            Nueva Inspección
          </button>
        </Link>

        <div className="px-2 py-1.5 text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-2 mt-6">
          Datos
        </div>

        {/* 3. HISTORIAL */}
        <Link href="/historial">
          <button className={cn("w-full flex items-center px-3 py-2 text-sm font-bold transition-all duration-200 group rounded-r-sm border-l-2", isActive("/historial") ? "text-[#1F2373] bg-slate-50 border-[#1F2373]" : "text-slate-500 border-transparent hover:text-[#1F2373] hover:bg-slate-50 hover:border-slate-200")}>
            <Icons.History className={cn("w-4 h-4 mr-3 transition-colors", isActive("/historial") ? "text-[#1F2373]" : "text-slate-400 group-hover:text-[#1F2373]")} />
            Histórico
          </button>
        </Link>
      </div>
    </aside>
  );
}