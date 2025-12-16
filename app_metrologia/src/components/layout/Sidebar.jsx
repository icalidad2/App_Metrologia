"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Icons } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const NAV = [
  {
    label: "Gestión",
    items: [
      { href: "/dashboard", title: "Panel de Monitoreo", icon: Icons.Dashboard },
      { href: "/inspeccion", title: "Nueva Inspección", icon: Icons.Ruler },
    ],
  },
  {
    label: "Datos",
    items: [{ href: "/historial", title: "Histórico", icon: Icons.History }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <aside
      className={cn(
        "bg-white border-r border-slate-200 shadow-sm sticky top-0 h-screen z-20 flex flex-col",
        collapsed ? "w-16" : "w-full md:w-64"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center min-w-0">
          <Image src="/logo.svg" alt="Logo" width={20} height={20} className="w-6 h-6" />
          {!collapsed && (
            <div className="ml-3 text-sm font-bold tracking-widest text-[#1F2373] uppercase truncate">
              Metrologia<span className="font-light"> | Q.C</span>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-3">
        {NAV.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <div className="px-2 py-1.5 text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-2">
                {section.label}
              </div>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const Active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-[#1F2373]/20",
                      Active
                        ? "bg-slate-50 text-[#1F2373]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#1F2373]"
                    )}
                    title={collapsed ? item.title : undefined}
                  >
                    {/* Active rail */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full transition-all",
                        Active ? "bg-[#1F2373]" : "bg-transparent group-hover:bg-slate-200"
                      )}
                    />

                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        Active ? "text-[#1F2373]" : "text-slate-400 group-hover:text-[#1F2373]"
                      )}
                    />

                    {!collapsed && (
                      <span className={cn("truncate", Active ? "font-semibold" : "font-medium")}>
                        {item.title}
                      </span>
                    )}

                    {/* Optional: tiny dot indicator for active when collapsed */}
                    {collapsed && Active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1F2373]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-3 shrink-0">
        <div
          className={cn(
            "rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500",
            collapsed && "px-2"
          )}
        >
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <span className="font-mono">Metrología v1</span>
              <span className="text-slate-400">QC</span>
            </div>
          ) : (
            <div className="text-center font-mono">v1</div>
          )}
        </div>
      </div>
    </aside>
  );
}
