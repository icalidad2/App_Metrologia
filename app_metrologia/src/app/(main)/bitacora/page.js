"use client";

/* ==========================================================================================
   IMPORTS
   - Refactor: eliminé dependencias innecesarias y agregué useCallback para handlers estables.
   ========================================================================================== */

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";

import {
  apiGetActiveOrders,
  apiGetFullLogbook,
  apiCreateLogbookSession,
  apiAddLogbookEvent,
  apiGetProducts,
} from "@/app/actions/metrologia";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

import {
  Factory,
  Component,
  User,
  LogOut,
  Search,
  ChevronRight,
  Activity,
  Clock,
  AlertTriangle,
  Send,
  Hash,
  Server,
  PlayCircle,
  Tag,
  Wrench,
  XCircle,
  AlertOctagon,
  Megaphone,
  FileText,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* ==========================================================================================
   HELPERS (PUROS)
   - Refactor: utilidades aisladas para no “ensuciar” componentes y evitar recomputo.
   ========================================================================================== */

function safeLower(v) {
  return String(v ?? "").toLowerCase();
}

function formatRelativeTime(iso) {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";

  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);

  if (min < 1) return "hace <1m";
  if (min < 60) return `hace ${min}m`;

  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;

  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function normalizeSessionId(s) {
  // API puede regresar { id } o { id_bitacora } dependiendo de backend
  return s?.id ?? s?.id_bitacora ?? null;
}

function buildProductsMap(productsCatalog) {
  const map = {};
  if (Array.isArray(productsCatalog)) {
    for (const p of productsCatalog) map[String(p.id)] = p.name;
  }
  return map;
}

function enrichOrdersWithProductNames(rawOrders, productsMap) {
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  return orders.map((order) => {
    const rawId = order.producto_id || order.producto;
    const realName = productsMap[String(rawId)] || rawId;
    return {
      ...order,
      producto: realName,
      producto_codigo: rawId,
    };
  });
}

/* ==========================================================================================
   UI: CHIPS (PARA FONDO CLARO)
   - Mejora: ya no se pierden en headers claros (como te pasó en la captura).
   ========================================================================================== */

function ChipLight({ label, icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-900/5 border-slate-900/10 text-slate-700",
    ok: "bg-emerald-600/10 border-emerald-700/15 text-emerald-800",
    id: "bg-indigo-600/10 border-indigo-700/15 text-indigo-800",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
        "text-[10px] font-black uppercase tracking-widest shadow-sm",
        tones[tone]
      )}
    >
      {icon ? <span className="opacity-80">{icon}</span> : null}
      <span className="font-mono normal-case tracking-normal">{label}</span>
    </span>
  );
}

/* ==========================================================================================
   MAIN PAGE
   - Refactor: deriva estructuras con memo (orders/events) para rendimiento y UX.
   ========================================================================================== */

export default function BitacoraPage() {
  /* ------------------------------
     STATE: navegación y contexto
     ------------------------------ */
  const [step, setStep] = useState("SOURCE"); // SOURCE -> LOGIN -> DASHBOARD
  const [context, setContext] = useState({
    source: "",
    user: "",
    orders: [],
    sessionId: null,
    events: [],
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  /* ------------------------------
     STATE: modal general + UI
     ------------------------------ */
  const [isGeneralModalOpen, setIsGeneralModalOpen] = useState(false);

  /* ------------------------------
     DERIVED: filtros de órdenes
     - Refactor: memo + normalización
     ------------------------------ */
  const filteredOrders = useMemo(() => {
    const q = safeLower(searchTerm).trim();
    const orders = Array.isArray(context.orders) ? context.orders : [];
    if (!q) return orders;

    return orders.filter((o) => {
      const maquina = safeLower(o?.maquina);
      const producto = safeLower(o?.producto);
      const folio = safeLower(o?.folio);
      const lote = safeLower(o?.lote);
      return maquina.includes(q) || producto.includes(q) || folio.includes(q) || lote.includes(q);
    });
  }, [context.orders, searchTerm]);

  /* ------------------------------
     DERIVED: agrupación de eventos por orden (folio)
     - Mejora: permite MachineCard con meta (urgentes + último evento) sin filtrar N veces
     ------------------------------ */
  const eventsByOrder = useMemo(() => {
    const map = new Map(); // key: "GENERAL" o folio/id, value: eventos[]
    const evts = Array.isArray(context.events) ? context.events : [];

    for (const e of evts) {
      const key = String(e?.order ?? "GENERAL");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }

    // Ordena por timestamp desc en cada bucket (para "último evento" rápido)
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      map.set(k, list);
    }
    return map;
  }, [context.events]);

  /* ------------------------------
     DERIVED: meta por folio (urgentes + lastSeen)
     - Mejora: lectura rápida del panel izquierdo
     ------------------------------ */
  const orderMetaByFolio = useMemo(() => {
    const meta = new Map();

    for (const o of filteredOrders) {
      const key = String(o?.folio ?? o?.id_orden ?? "");
      const list = eventsByOrder.get(key) || [];

      const urgentCount = list.filter((e) => e?.priority === "URGENTE").length;
      const lastTs = list[0]?.timestamp || null;

      meta.set(key, { urgentCount, lastTs, lastSeen: formatRelativeTime(lastTs) });
    }

    return meta;
  }, [filteredOrders, eventsByOrder]);

  /* ------------------------------
     ACTION: refrescar eventos desde backend
     - Refactor: robusto ante diferentes nombres de campos
     ------------------------------ */
  const refreshSessionData = useCallback(async () => {
    if (!context.sessionId) return;
    try {
      const history = await apiGetFullLogbook();
      const sessionId = String(context.sessionId);

      const current =
        (Array.isArray(history) ? history : []).find((s) => String(normalizeSessionId(s)) === sessionId) || null;

      if (current) {
        setContext((prev) => ({ ...prev, events: current.events || [] }));
      }
    } catch (err) {
      console.error("refreshSessionData error:", err);
    }
  }, [context.sessionId]);

  /* ------------------------------
     ACTION: crear evento (optimista + persistencia)
     - Refactor: una sola función para todo (orden específica o GENERAL)
     ------------------------------ */
  const handleAddEventGlobal = useCallback(
    async (payload) => {
      if (!context.sessionId) {
        alert("Sesión no iniciada. Vuelve a iniciar turno.");
        return;
      }

      const tempId = `temp-${Date.now()}`;
      const optimisticEvent = {
        id: tempId,
        timestamp: new Date().toISOString(),
        message: payload.mensaje,
        priority: payload.prioridad,
        order: payload.orden, // folio o "GENERAL"
        isOptimistic: true,
      };

      // 1) Optimista inmediato
      setContext((prev) => ({
        ...prev,
        events: [optimisticEvent, ...(prev.events || [])],
      }));

      // 2) Persistir
      try {
        await apiAddLogbookEvent({
          bitacora_id: context.sessionId,
          mensaje: payload.mensaje,
          prioridad: payload.prioridad,
          orden: payload.orden,
        });

        // 3) Reconciliar desde backend (fuente de verdad)
        await refreshSessionData();
      } catch (err) {
        console.error("Error guardando evento:", err);
        alert("Error: No se pudo guardar el último mensaje.");

        // rollback optimista
        setContext((prev) => ({
          ...prev,
          events: (prev.events || []).filter((e) => e.id !== tempId),
        }));
      }
    },
    [context.sessionId, refreshSessionData]
  );

  /* ------------------------------
     ACTION: seleccionar origen
     ------------------------------ */
  const handleSelectSource = useCallback((source) => {
    setContext((prev) => ({ ...prev, source }));
    setStep("LOGIN");
  }, []);

  /* ------------------------------
     ACTION: login (carga órdenes + catálogo + crea sesión)
     - Refactor: Promise.all + map de productos + enriquecimiento de órdenes
     ------------------------------ */
  const handleLogin = useCallback(
    async (user) => {
      setLoading(true);
      try {
        const [rawOrders, productsCatalog] = await Promise.all([
          apiGetActiveOrders(context.source),
          apiGetProducts(),
        ]);

        const productsMap = buildProductsMap(productsCatalog);
        const enrichedOrders = enrichOrdersWithProductNames(rawOrders, productsMap);

        const sessionRes = await apiCreateLogbookSession({ inspector: user, turno: "1" });
        const sessionId = sessionRes?.ok ? sessionRes?.data?.id_bitacora : null;

        if (!sessionId) {
          alert("Error iniciando sesión");
          return;
        }

        setContext((prev) => ({
          ...prev,
          user,
          orders: enrichedOrders,
          sessionId,
          events: [],
        }));

        setStep("DASHBOARD");
      } catch (error) {
        console.error("Error en login:", error);
        alert("Error cargando datos.");
      } finally {
        setLoading(false);
      }
    },
    [context.source]
  );

  /* ------------------------------
     RENDER: pasos
     ------------------------------ */
  if (step === "SOURCE") return <SourceSelector onSelect={handleSelectSource} />;
  if (step === "LOGIN") {
    return (
      <LoginModal
        source={context.source}
        onLogin={handleLogin}
        loading={loading}
        onCancel={() => setStep("SOURCE")}
      />
    );
  }

  /* ==========================================================================================
     LAYOUT PRINCIPAL
     - Mejora: fondo glass + header claro visible + FAB móvil
     ========================================================================================== */

  const totalUrgent = (context.events || []).filter((e) => e?.priority === "URGENTE").length;

  return (
    <div className="relative h-screen overflow-hidden font-sans text-slate-900 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Fondo decorativo semitransparente */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 left-1/2 h-[26rem] w-[62rem] -translate-x-1/2 rounded-full bg-slate-300/70 blur-3xl" />
        <div className="absolute top-28 -left-32 h-[28rem] w-[28rem] rounded-full bg-slate-300/55 blur-3xl" />
        <div className="absolute -bottom-24 right-[-6rem] h-[22rem] w-[38rem] rounded-full bg-slate-200/60 blur-3xl" />
        <div className="absolute inset-0 bg-white/35 backdrop-blur-[2px]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:14px_14px]" />
      </div>

      <div className="relative h-full flex flex-col">
        {/* ======================================================================================
           HEADER (CLARO + CONTRASTE)
           - Mejora: chips visibles + botones con colores correctos
           ====================================================================================== */}
        <header className="shrink-0 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl z-20">
          <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
            {/* LEFT */}
            <div className="flex items-center gap-4 min-w-0">
              <div
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-200 bg-white",
                  context.source.includes("PI") ? "text-blue-600" : "text-emerald-600"
                )}
              >
                {context.source.includes("PI") ? <Component size={18} /> : <Factory size={18} />}
              </div>

              <div className="min-w-0">
                <h1 className="font-black text-base sm:text-lg leading-none tracking-tight text-slate-900">
                  MONITOR DE PISO
                </h1>

                {/* Chips (ya no se pierden) */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  <ChipLight label={context.source} tone="id" />
                  <ChipLight icon={<Activity size={12} />} label="En línea" tone="ok" />
                  {context.sessionId ? (
                    <ChipLight icon={<Hash size={12} />} label={String(context.sessionId)} tone="slate" />
                  ) : null}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Evento General (desktop) */}
              <Button
                onClick={() => setIsGeneralModalOpen(true)}
                className="hidden sm:flex bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                size="sm"
              >
                <Megaphone size={16} className="mr-2" />
                Evento general
              </Button>

              {/* Historial */}
              <Link href="/reportes">
                <Button variant="ghost" className="text-slate-700 hover:bg-slate-900/5" size="sm">
                  <FileText size={16} className="mr-2" /> Historial
                </Button>
              </Link>

              {/* Usuario */}
              <div className="hidden sm:flex flex-col items-end ml-2">
                <span className="text-xs font-black text-slate-900">{context.user}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Inspector calidad</span>
              </div>

              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />

              {/* Logout */}
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:text-rose-600 hover:bg-rose-600/10"
                onClick={() => window.location.reload()}
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </header>

        {/* ======================================================================================
           FAB móvil (CTA flotante)
           - Mejora: Evento general siempre disponible en móvil
           ====================================================================================== */}
        <button
          type="button"
          onClick={() => setIsGeneralModalOpen(true)}
          className={cn(
            "sm:hidden fixed bottom-4 right-4 z-40",
            "h-12 w-12 rounded-2xl shadow-xl",
            "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 transition"
          )}
          aria-label="Evento general"
        >
          <Megaphone size={18} className="mx-auto" />
        </button>

        {/* ======================================================================================
           MAIN LAYOUT
           ====================================================================================== */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* SIDEBAR */}
          <aside className="md:w-[390px] lg:w-[420px] shrink-0 bg-white/80 backdrop-blur border-b md:border-b-0 md:border-r border-slate-200 overflow-hidden flex flex-col z-10">
            {/* Sidebar header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-white/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-slate-500" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Máquinas activas
                  </p>
                </div>
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-mono">
                  {filteredOrders.length}
                </Badge>
              </div>

              {/* Search */}
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar por máquina, folio, lote..."
                  className="pl-10 bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* Mini KPIs */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MiniStat label="Eventos" value={(context.events || []).length} icon={<Activity size={14} />} />
                <MiniStat
                  label="Urgentes"
                  value={totalUrgent}
                  icon={<AlertTriangle size={14} />}
                  tone="amber"
                />
              </div>
            </div>

            {/* Order list */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto custom-scrollbar">
              {filteredOrders.length === 0 ? (
                <EmptySidebar />
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((order, index) => {
                    const key = String(order?.folio ?? order?.id_orden ?? "");
                    const meta = orderMetaByFolio.get(key) || { urgentCount: 0, lastSeen: "—" };

                    return (
                      <MachineCard
                        key={order.id_orden}
                        order={order}
                        index={index}
                        isActive={selectedOrder?.id_orden === order.id_orden}
                        urgentCount={meta.urgentCount}
                        lastSeen={meta.lastSeen}
                        onClick={() => setSelectedOrder(order)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* WORKSPACE */}
          <main className="flex-1 min-w-0 bg-slate-50 overflow-hidden">
            {selectedOrder ? (
              <WorkspacePanel
                order={selectedOrder}
                orderEvents={eventsByOrder.get(String(selectedOrder?.folio ?? selectedOrder?.id_orden ?? "")) || []}
                onAddEvent={handleAddEventGlobal}
                onClose={() => setSelectedOrder(null)}
              />
            ) : (
              <GlobalDashboardFeed
                events={context.events}
                onRefresh={refreshSessionData}
              />
            )}
          </main>
        </div>

        {/* MODAL GENERAL */}
        {isGeneralModalOpen && (
          <GeneralEventModal
            onClose={() => setIsGeneralModalOpen(false)}
            onAddEvent={handleAddEventGlobal}
          />
        )}
      </div>
    </div>
  );
}

/* ==========================================================================================
   UI: SIDEBAR PIEZAS
   ========================================================================================== */

function MiniStat({ label, value, icon, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={cn("rounded-xl border p-3", toneMap[tone])}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
        <div className="text-slate-500">{icon}</div>
      </div>
      <div className="mt-1 text-2xl font-black text-slate-800">{value}</div>
    </div>
  );
}

function EmptySidebar() {
  return (
    <div className="p-8 text-center text-slate-400 mt-10 border border-dashed border-slate-200 rounded-2xl bg-white">
      <Server size={48} className="mx-auto mb-2 opacity-20" />
      <p className="text-sm font-semibold text-slate-700">Sin datos de producción</p>
      <p className="text-xs text-slate-400 mt-1">Verifica conexión o que existan órdenes activas.</p>
    </div>
  );
}

/* ==========================================================================================
   MACHINE CARD
   - Mejora: muestra "último evento" + contador urgentes por máquina
   ========================================================================================== */

function MachineCard({ order, isActive, onClick, index = 0, urgentCount = 0, lastSeen = "—" }) {
  const isRunning = true;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${index * 30}ms`, animationFillMode: "both" }}
      className={cn(
        "w-full text-left group relative p-4 rounded-2xl border shadow-sm transition-all duration-200",
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        "bg-white hover:bg-slate-50/60",
        isActive ? "border-blue-600 ring-1 ring-blue-600" : "border-slate-200 hover:border-blue-300"
      )}
    >
      {/* status strip */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl",
          isActive ? "bg-blue-600" : "bg-slate-300 group-hover:bg-blue-400"
        )}
      />

      <div className="pl-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="font-black text-xl text-slate-800 font-mono tracking-tighter">{order.maquina}</div>

            {isRunning ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                <PlayCircle size={12} />
                RUN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
                STOP
              </span>
            )}

            {urgentCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                <AlertTriangle size={12} />
                {urgentCount} urg
              </span>
            ) : null}
          </div>

          <div className="mt-2">
            <h4 className="font-bold text-sm text-slate-900 leading-tight truncate">{order.producto}</h4>
          </div>
        </div>

        <Badge
          variant="outline"
          className="shrink-0 font-mono text-[10px] bg-slate-50 text-slate-600 border-slate-200"
        >
          {order.folio}
        </Badge>
      </div>

      <div className="pl-3 mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono">
        <span className="inline-flex items-center gap-1">
          <Hash size={12} className="text-slate-400" />
          Lote: <strong className="text-slate-800">{order.lote}</strong>
        </span>

        <span className="inline-flex items-center gap-1">
          <Activity size={12} className="text-slate-400" />
          Cant: <strong className="text-slate-800">{order.cantidad}</strong>
        </span>

        <span className="inline-flex items-center gap-1">
          <Clock size={12} className="text-slate-400" />
          Último: <strong className="text-slate-800">{lastSeen}</strong>
        </span>
      </div>

      {isActive && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 animate-in zoom-in duration-300">
          <ChevronRight size={20} />
        </div>
      )}
    </button>
  );
}

/* ==========================================================================================
   WORKSPACE PANEL
   - Refactor: recibe orderEvents ya filtrados (evita recomputar en cada render)
   - Mejora: submit con estado "sending" para evitar duplicados
   ========================================================================================== */

const QUICK_TAGS = [
  { label: "PARO", icon: <XCircle size={12} />, color: "text-red-600 bg-red-50 border-red-200" },
  { label: "AJUSTE", icon: <Wrench size={12} />, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { label: "CALIDAD", icon: <AlertOctagon size={12} />, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { label: "SCRAP", icon: <Tag size={12} />, color: "text-slate-600 bg-slate-100 border-slate-200" },
];

function WorkspacePanel({ order, orderEvents, onAddEvent, onClose }) {
  const [msg, setMsg] = useState("");
  const [prio, setPrio] = useState("NORMAL");
  const [sending, setSending] = useState(false);

  // Insertar etiqueta al inicio: [TAG] mensaje
  const addTag = (tagName) => {
    const regex = /^\[.*?\]\s/;
    const newPrefix = `[${tagName}] `;
    setMsg((prev) => (regex.test(prev) ? prev.replace(regex, newPrefix) : newPrefix + prev));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!msg.trim() || sending) return;

    setSending(true);
    try {
      await onAddEvent({ mensaje: msg, prioridad: prio, orden: order.folio });
      setMsg("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-mono font-black text-lg">
              {order.maquina}
            </div>

            <div className="min-w-0">
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Hash size={12} className="text-slate-400" /> OP: {order.folio}
                </span>
                <span className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-1">
                  <Hash size={12} className="text-slate-400" /> LOTE: {order.lote}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-slate-600 border-slate-300 hover:bg-slate-50"
          >
            Cerrar panel
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50">
        <div className="max-w-4xl mx-auto">
          {orderEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                <Activity className="text-slate-300" size={28} />
              </div>
              <p className="text-sm text-slate-700 font-semibold mt-4">
                Sin registros en bitácora para esta orden
              </p>
              <p className="text-xs text-slate-400 mt-1">Usa el panel inferior para registrar un hallazgo.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {orderEvents.map((evt) => (
                <LogEntry key={evt.id} evt={evt} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-18px_rgba(0,0,0,0.25)]">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-4 sm:p-5 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex gap-2">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => addTag(tag.label)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-black transition-transform active:scale-95 hover:brightness-95 whitespace-nowrap",
                    tag.color
                  )}
                >
                  {tag.icon} {tag.label}
                </button>
              ))}
            </div>

            <Segmented
              value={prio}
              onChange={setPrio}
              options={[
                { value: "NORMAL", label: "NORMAL" },
                { value: "URGENTE", label: "URGENTE", tone: "amber" },
              ]}
            />
          </div>

          {/* Input + Submit */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                autoFocus
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Describe la observación técnica…"
                className="h-12 pr-12 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Clock size={16} />
              </span>
            </div>

            <Button
              type="submit"
              disabled={!msg.trim() || sending}
              className={cn(
                "h-12 px-5 font-black uppercase text-xs tracking-widest",
                prio === "URGENTE"
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-blue-700 hover:bg-blue-800 text-white"
              )}
            >
              <Send size={16} className="mr-2" />
              {sending ? "Enviando…" : "Guardar"}
            </Button>
          </div>

          <p className="text-xs text-slate-400">
            Tip: usa <span className="font-mono">URGENTE</span> para paros, scrap crítico o riesgo de mezcla.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================================
   UI: Segmented control
   ========================================================================================== */

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0">
      {options.map((opt) => {
        const active = value === opt.value;
        const tone =
          opt.tone === "amber"
            ? active
              ? "bg-amber-500 text-white border-amber-600 shadow-sm"
              : "text-amber-700 hover:text-amber-800"
            : active
            ? "bg-white text-slate-900 border-slate-300 shadow-sm"
            : "text-slate-500 hover:text-slate-700";

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 sm:px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
              active ? "" : "border-transparent",
              tone
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================================
   TIMELINE ENTRY
   ========================================================================================== */

function LogEntry({ evt }) {
  const rawMessage = evt.message || "";
  const time = new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const tagMatch = rawMessage.match(/^\[(.*?)\]\s(.*)/);
  let tag = null;
  let content = rawMessage;

  if (tagMatch) {
    tag = tagMatch[1];
    content = tagMatch[2];
  }

  const tagStyles = {
    PARO: "bg-red-100 text-red-700 border-red-200",
    AJUSTE: "bg-blue-100 text-blue-700 border-blue-200",
    CALIDAD: "bg-amber-100 text-amber-700 border-amber-200",
    SCRAP: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const urgent = evt.priority === "URGENTE";

  return (
    <div className={cn("flex gap-4", evt.isOptimistic && "opacity-60 grayscale")}>
      {/* Time */}
      <div className="w-20 shrink-0 pt-1 text-right">
        <div className="font-mono text-xs font-bold text-slate-600">{time}</div>
        {urgent ? (
          <Badge className="mt-1 bg-amber-100 text-amber-700 hover:bg-amber-100 text-[9px] px-2 h-5 border-0">
            ALERTA
          </Badge>
        ) : (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
            <Clock size={12} /> Hora
          </span>
        )}
      </div>

      {/* Connector */}
      <div className="flex flex-col items-center pt-2">
        <div
          className={cn(
            "w-3.5 h-3.5 rounded-full border-2",
            urgent ? "bg-amber-500 border-white ring-4 ring-amber-100" : "bg-blue-500 border-white ring-4 ring-blue-100"
          )}
        />
        <div className="w-0.5 flex-1 bg-slate-200 mt-1" />
      </div>

      {/* Content */}
      <div className={cn("flex-1 rounded-2xl border p-4 shadow-sm bg-white relative", urgent ? "border-amber-200 bg-amber-50" : "border-slate-200")}>
        <div
          className={cn(
            "absolute top-4 -left-[7px] w-3.5 h-3.5 rotate-45 border-l border-t",
            urgent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
          )}
        />

        <div className="text-sm text-slate-800 leading-relaxed">
          {tag && (
            <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-black mr-2 border align-middle mb-0.5 tracking-wide", tagStyles[tag] || "bg-slate-100 text-slate-600 border-slate-200")}>
              {tag}
            </span>
          )}
          {content}
        </div>

        {evt.isOptimistic && (
          <span className="text-[10px] text-slate-400 italic mt-2 block text-right">Sincronizando...</span>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================================
   GLOBAL DASHBOARD
   - Mejora clave: NO centrado con vacío. Alineado arriba + scroll natural.
   ========================================================================================== */

function GlobalDashboardFeed({ events, onRefresh }) {
  const urgentCount = (events || []).filter((e) => e?.priority === "URGENTE").length;

  const recentUrgent = useMemo(() => {
    return (events || []).filter((e) => e?.priority === "URGENTE").slice(0, 5);
  }, [events]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-start justify-center p-6 sm:p-10 pt-10">
        <div className="w-full max-w-4xl">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Activity className="text-slate-300" size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Panel general</h2>
                  <p className="text-slate-500 mt-1">
                    Selecciona una máquina del panel izquierdo para entrar a su bitácora y registrar eventos.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={onRefresh} className="border-slate-300 text-slate-600 hover:bg-slate-50">
                Actualizar
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiTile label="Eventos totales" value={(events || []).length} />
              <KpiTile label="Alertas críticas" value={urgentCount} tone="amber" />
              <KpiTile label="Estado" value="En línea" tone="emerald" />
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Instrucciones rápidas</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />Elige máquina → verás su timeline.</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />Registra hallazgo → NORMAL o URGENTE.</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />URGENTE para riesgos de calidad / paro / scrap.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Últimas alertas</p>
                <div className="mt-3 space-y-3">
                  {recentUrgent.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      Sin alertas urgentes registradas.
                    </div>
                  ) : (
                    recentUrgent.map((e) => (
                      <div key={e.id || e.timestamp} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800">
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-amber-800 font-black">
                            <AlertTriangle size={16} /> URGENTE
                          </span>
                          <span className="text-xs font-mono text-slate-600">
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">{e.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center">Monitor de piso · Bitácora técnica · Sesión centralizada</p>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, tone = "slate" }) {
  const toneMap = {
    slate: "bg-white border-slate-200 text-slate-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };
  return (
    <div className={cn("rounded-2xl border p-5 shadow-sm", toneMap[tone])}>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  );
}

/* ==========================================================================================
   MODALES
   ========================================================================================== */

function LoginModal({ source, onLogin, loading, onCancel }) {
  const [val, setVal] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="text-center">
            <div className="inline-flex p-3 rounded-2xl bg-slate-50 border border-slate-200 mb-4 text-slate-700">
              <User size={22} />
            </div>
            <h2 className="text-lg font-black text-slate-900">Acceso de operador</h2>
            <p className="text-sm text-slate-500 mt-1">{source}</p>
          </div>
          <div className="mt-6 space-y-3">
            <Input
              autoFocus
              placeholder="Ingresa tu nombre"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="text-center h-12 text-sm font-mono uppercase bg-slate-50 border-slate-300"
            />
            <Button
              disabled={!val || loading}
              onClick={() => onLogin(val)}
              className="w-full h-12 font-black tracking-widest uppercase bg-blue-700 hover:bg-blue-800 text-white"
            >
              {loading ? "VERIFICANDO..." : "INICIAR TURNO"}
            </Button>
            <button
              onClick={onCancel}
              className="w-full text-xs font-black text-slate-400 hover:text-slate-500 uppercase tracking-widest"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceSelector({ onSelect }) {
  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar área</p>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-2">Monitor de piso · Bitácora</h1>
          <p className="text-slate-400 mt-2">Elige el origen para cargar órdenes activas.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SourceCard
            title="Inyección"
            code="FT-CC-09 PI"
            icon={<Component size={44} />}
            tone="blue"
            onClick={() => onSelect("FT-CC-09 PI")}
          />
          <SourceCard
            title="Procesos Secundarios"
            code="FT-CC-09 PS"
            icon={<Factory size={44} />}
            tone="emerald"
            onClick={() => onSelect("FT-CC-09 PS")}
          />
        </div>
      </div>
    </div>
  );
}

function SourceCard({ title, code, icon, tone, onClick }) {
  const toneMap = {
    blue: "hover:border-blue-500 text-blue-400",
    emerald: "hover:border-emerald-500 text-emerald-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-72 rounded-2xl bg-white/5 border border-white/10 backdrop-blur shadow-2xl hover:bg-white/10 transition-all group flex flex-col items-center justify-center gap-5",
        toneMap[tone]
      )}
    >
      <div className="w-24 h-24 rounded-full bg-slate-950 border border-white/10 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
        <p className="text-xs font-mono text-slate-400 mt-2">{code}</p>
      </div>
    </button>
  );
}

function GeneralEventModal({ onClose, onAddEvent }) {
  const [msg, setMsg] = useState("");
  const [prio, setPrio] = useState("NORMAL");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!msg.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddEvent({ mensaje: msg, prioridad: prio, orden: "GENERAL" });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-200">
        <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Megaphone size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg leading-none">Evento de planta</h3>
              <p className="text-xs text-slate-500 mt-1">Reporte no vinculado a máquinas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <LogOut className="rotate-45" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
              Prioridad del aviso
            </label>
            <div className="flex gap-2">
              {["NORMAL", "URGENTE"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrio(p)}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all",
                    prio === p
                      ? p === "URGENTE"
                        ? "bg-amber-500 text-white border-amber-600 shadow-md"
                        : "bg-indigo-600 text-white border-indigo-700 shadow-md"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {p === "URGENTE" && <AlertTriangle size={14} className="inline mr-1 mb-0.5" />} {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
              Descripción del suceso
            </label>
            <textarea
              autoFocus
              className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
              placeholder="Ej: Corte de energía en nave B..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-slate-500">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!msg.trim() || isSubmitting}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-xl"
            >
              {isSubmitting ? "Registrando..." : "Publicar aviso"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
