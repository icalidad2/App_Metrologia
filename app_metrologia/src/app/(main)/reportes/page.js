"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGetFullLogbook } from "@/app/actions/metrologia";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

import {
  ChevronLeft,
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  FileText,
  X,
  Hash,
  Server,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* ==========================================================================================
  HELPERS (normalización / compatibilidad)
========================================================================================== */

// Convierte a string seguro
function s(v) {
  return v === null || v === undefined ? "" : String(v);
}

// Normaliza para búsquedas
function norm(v) {
  return s(v).toLowerCase().trim();
}

// Formato hora corta
function timeHHMM(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

// Formato fecha corta
function dateShort(ts) {
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return "—";
  }
}

// Extrae TAG tipo [PARO] al inicio
function parseTag(message) {
  const raw = s(message);
  const m = raw.match(/^\[(.*?)\]\s+(.*)$/);
  if (!m) return { tag: null, content: raw };
  return { tag: m[1], content: m[2] };
}

/* ==========================================================================================
  PAGE
========================================================================================== */

export default function ReportesPage() {
  // ---------------------------------------------------------------------------
  // ESTADO BASE
  // ---------------------------------------------------------------------------
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loading, setLoading] = useState(true);

  // búsqueda / filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyUrgent, setOnlyUrgent] = useState(false);

  // modal bloque (Producto+Lote)
  const [openBlockKey, setOpenBlockKey] = useState(null);

  // ---------------------------------------------------------------------------
  // CARGA INICIAL
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiGetFullLogbook();
        const arr = Array.isArray(data) ? data : [];
        setSessions(arr);
        if (arr.length > 0) setSelectedSessionId(arr[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // SESIÓN SELECCIONADA
  // ---------------------------------------------------------------------------
  const selectedSession = useMemo(() => {
    return (sessions || []).find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // ---------------------------------------------------------------------------
  // FILTRO DE SESIONES (sidebar) por inspector/fecha
  // ---------------------------------------------------------------------------
  const filteredSessions = useMemo(() => {
    const q = norm(searchTerm);
    if (!q) return sessions || [];
    return (sessions || []).filter((ses) => {
      const inspector = norm(ses.inspector);
      const dt = dateShort(ses.timestamp);
      const shift = norm(ses.shift);
      return inspector.includes(q) || norm(dt).includes(q) || shift.includes(q);
    });
  }, [sessions, searchTerm]);

  // ---------------------------------------------------------------------------
  // CONSTRUCCIÓN DE BLOQUES (Producto + Lote) para la sesión seleccionada
  // - Compatible con eventos viejos: si falta product/lot, cae a "Orden: X"
  // ---------------------------------------------------------------------------
  const blocks = useMemo(() => {
    const ses = selectedSession;
    if (!ses) return [];

    const events = Array.isArray(ses.events) ? ses.events : [];

    // 1) aplica filtro "solo urgentes" si se activó
    const baseEvents = onlyUrgent
      ? events.filter((e) => s(e.priority).toUpperCase() === "URGENTE")
      : events;

    // 2) agrupa por product+lot; fallback por order
    const map = new Map();

    for (const e of baseEvents) {
      const priority = s(e.priority).toUpperCase();
      const urgent = priority === "URGENTE";

      const product = e.product ?? e.producto ?? null;
      const lot = e.lot ?? e.lote ?? null;
      const machine = e.machine ?? e.maquina ?? null;
      const order = e.order ?? e.orden ?? "—";

      // fallback para históricos sin metadata
      const hasMeta = !!(product && lot);
      const key = hasMeta
        ? `P:${s(product)}|L:${s(lot)}`
        : `ORDER_ONLY:${s(order)}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          product: hasMeta ? s(product) : `Orden: ${s(order)}`,
          lot: hasMeta ? s(lot) : "—",
          machines: new Set(),
          orders: new Set(),
          urgentCount: 0,
          totalCount: 0,
          lastTs: null,
          events: [],
        });
      }

      const b = map.get(key);
      b.totalCount += 1;
      if (urgent) b.urgentCount += 1;
      if (machine) b.machines.add(s(machine));
      if (order) b.orders.add(s(order));
      b.events.push(e);

      const ts = e.timestamp;
      if (!b.lastTs || new Date(ts) > new Date(b.lastTs)) b.lastTs = ts;
    }

    // 3) ordena eventos dentro del bloque (reciente primero)
    for (const b of map.values()) {
      b.events.sort((a, c) => new Date(c.timestamp) - new Date(a.timestamp));
    }

    // 4) convierte a array y ordena bloques: urgentes arriba, luego más reciente
    const out = Array.from(map.values()).sort((a, c) => {
      if (c.urgentCount !== a.urgentCount) return c.urgentCount - a.urgentCount;
      return new Date(c.lastTs || 0) - new Date(a.lastTs || 0);
    });

    // 5) filtro de búsqueda “dentro” de bloques (producto/lote/maquina/op)
    const q = norm(searchTerm);
    if (!q) return out;

    return out.filter((b) => {
      const machines = Array.from(b.machines).join(" ");
      const orders = Array.from(b.orders).join(" ");
      return (
        norm(b.product).includes(q) ||
        norm(b.lot).includes(q) ||
        norm(machines).includes(q) ||
        norm(orders).includes(q)
      );
    });
  }, [selectedSession, onlyUrgent, searchTerm]);

  // ---------------------------------------------------------------------------
  // BLOQUE ABIERTO EN MODAL
  // ---------------------------------------------------------------------------
  const openBlock = useMemo(() => {
    if (!openBlockKey) return null;
    return blocks.find((b) => b.key === openBlockKey) || null;
  }, [openBlockKey, blocks]);

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* =====================================================
          HEADER (simple, legible)
      ====================================================== */}
      <header className="h-16 shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/bitacora" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronLeft size={20} />
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm">
              <FileText size={18} />
            </div>
            <div>
              <div className="font-black leading-none">Historial de Turnos</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Explora por <span className="font-semibold">Producto + Lote</span> y revisa eventos en segundos.
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={cn(
              "border-slate-300 text-slate-700",
              onlyUrgent && "border-amber-300 bg-amber-50 text-amber-800"
            )}
            onClick={() => setOnlyUrgent((v) => !v)}
          >
            <AlertTriangle size={16} className="mr-2" />
            Solo urgentes
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* =====================================================
            SIDEBAR: Sesiones / turnos
        ====================================================== */}
        <aside className="w-[340px] shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Buscar */}
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar: inspector, fecha, producto, lote, máquina, OP…"
                className="pl-10 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Cargando historial…</div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                <Server className="mx-auto mb-3 text-slate-300" size={32} />
                Sin resultados con ese filtro.
              </div>
            ) : (
              filteredSessions.map((ses) => {
                const isActive = ses.id === selectedSessionId;
                const urgent = (ses.events || []).some((e) => s(e.priority).toUpperCase() === "URGENTE");
                const total = (ses.events || []).length;

                return (
                  <button
                    key={ses.id}
                    type="button"
                    onClick={() => {
                      setSelectedSessionId(ses.id);
                      setOpenBlockKey(null);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors",
                      isActive && "bg-indigo-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-800 truncate">{ses.inspector}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Calendar size={12} />
                          {dateShort(ses.timestamp)}
                          <span className="text-slate-300">|</span>
                          <Clock size={12} />
                          {timeHHMM(ses.timestamp)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary" className="text-[10px] h-5">
                          T-{ses.shift}
                        </Badge>
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {total} evts
                          </span>
                          {urgent ? (
                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              <AlertTriangle size={10} /> urg
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* =====================================================
            MAIN: Bloques por Producto + Lote
        ====================================================== */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6">
          {!selectedSession ? (
            <div className="h-full grid place-items-center text-slate-400">
              Selecciona un turno para ver los bloques.
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              {/* Encabezado de sesión */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Turno seleccionado
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900">
                      {selectedSession.inspector} · T-{selectedSession.shift}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {dateShort(selectedSession.timestamp)} · {timeHHMM(selectedSession.timestamp)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Hash size={14} className="text-slate-400" />
                      {blocks.length} bloques
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle size={14} className="text-slate-400" />
                      {(selectedSession.events || []).filter((e) => s(e.priority).toUpperCase() === "URGENTE").length} urgentes
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de bloques */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {blocks.length === 0 ? (
                  <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                    No hay eventos para mostrar (o el filtro dejó cero resultados).
                  </div>
                ) : (
                  blocks.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setOpenBlockKey(b.key)}
                      className={cn(
                        "text-left rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all p-5",
                        b.urgentCount > 0 ? "border-amber-200" : "border-slate-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Producto
                          </div>
                          <div className="mt-1 font-black text-slate-900 truncate">
                            {b.product}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-mono text-slate-700">
                              Lote: <span className="font-bold">{b.lot}</span>
                            </span>

                            {Array.from(b.machines).slice(0, 3).map((m) => (
                              <span
                                key={m}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-1 font-mono text-slate-600"
                              >
                                {m}
                              </span>
                            ))}

                            {b.urgentCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-mono text-amber-800">
                                <AlertTriangle size={14} />
                                {b.urgentCount} urg
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-mono text-emerald-700">
                                0 urg
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Último
                          </div>
                          <div className="mt-1 font-mono font-bold text-slate-800">
                            {timeHHMM(b.lastTs)}
                          </div>
                          <div className="mt-3 text-[10px] font-mono text-slate-500">
                            {b.totalCount} eventos
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =====================================================
          MODAL: Timeline del bloque seleccionado
      ====================================================== */}
      {openBlock ? (
        <BlockModal
          block={openBlock}
          onClose={() => setOpenBlockKey(null)}
        />
      ) : null}
    </div>
  );
}

/* ==========================================================================================
  MODAL (bloque Producto + Lote)
========================================================================================== */

function BlockModal({ block, onClose }) {
  const [onlyUrgent, setOnlyUrgent] = useState(false);

  const viewEvents = useMemo(() => {
    const base = Array.isArray(block.events) ? block.events : [];
    if (!onlyUrgent) return base;
    return base.filter((e) => s(e.priority).toUpperCase() === "URGENTE");
  }, [block.events, onlyUrgent]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Producto · Lote
            </div>
            <div className="mt-1 text-lg font-black text-slate-900 truncate">
              {block.product}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 font-mono text-slate-700">
                Lote: <span className="ml-1 font-bold">{block.lot}</span>
              </span>
              {Array.from(block.machines).map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center rounded-full bg-white border border-slate-200 px-2 py-1 font-mono text-slate-600"
                >
                  {m}
                </span>
              ))}
              {block.urgentCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-mono text-amber-800">
                  <AlertTriangle size={14} />
                  {block.urgentCount} urgentes
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              className={cn(
                "border-slate-300",
                onlyUrgent && "border-amber-300 bg-amber-50 text-amber-800"
              )}
              onClick={() => setOnlyUrgent((v) => !v)}
            >
              Solo urgentes
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-slate-600">
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {viewEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
              No hay eventos con este filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {viewEvents.map((evt) => (
                <TimelineRow key={evt.id || evt.timestamp} evt={evt} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ evt }) {
  const urgent = s(evt.priority).toUpperCase() === "URGENTE";
  const { tag, content } = parseTag(evt.message);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 bg-white shadow-sm",
        urgent ? "border-amber-200 bg-amber-50" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-mono font-bold text-slate-600">
            {timeHHMM(evt.timestamp)}
          </div>

          <div className="mt-2 text-sm text-slate-800 leading-relaxed">
            {tag ? (
              <span className="inline-flex items-center mr-2 px-2 py-0.5 rounded-full text-[10px] font-black border bg-slate-100 border-slate-200">
                {tag}
              </span>
            ) : null}
            {content}
          </div>

          {/* Metadata visible (opcional, pero útil) */}
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-slate-600">
            {evt.machine || evt.maquina ? (
              <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
                {evt.machine || evt.maquina}
              </span>
            ) : null}
            {evt.order || evt.orden ? (
              <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
                OP: {evt.order || evt.orden}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          {urgent ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200">
              <AlertTriangle size={12} />
              URGENTE
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-400">NORMAL</span>
          )}
        </div>
      </div>
    </div>
  );
}
