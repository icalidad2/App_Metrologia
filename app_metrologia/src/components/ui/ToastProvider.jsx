"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

const ToastCtx = createContext(null);

function ToastIcon({ variant }) {
  if (variant === "success") return <CheckCircle2 className="w-4 h-4" />;
  if (variant === "error") return <AlertTriangle className="w-4 h-4" />;
  return <Info className="w-4 h-4" />;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((toast) => {
    const id = crypto?.randomUUID?.() ?? String(Date.now() + Math.random());
    const t = {
      id,
      title: toast?.title ?? "",
      message: toast?.message ?? "",
      variant: toast?.variant ?? "info", // info | success | error
      duration: toast?.duration ?? 2800,
    };

    setToasts((prev) => [t, ...prev]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, t.duration);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}

      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-9999 w-90 max-w-[calc(100vw-2rem)] space-y-2">
        {toasts.map((t) => {
          const style =
            t.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : t.variant === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-900";

          const iconColor =
            t.variant === "success" ? "text-emerald-600" : t.variant === "error" ? "text-rose-600" : "text-slate-500";

          return (
            <div key={t.id} className={`border shadow-sm rounded-2xl p-4 ${style}`}>
              <div className="flex items-start gap-3">
                <div className={iconColor}>
                  <ToastIcon variant={t.variant} />
                </div>
                <div className="min-w-0">
                  {t.title ? <div className="font-semibold text-sm">{t.title}</div> : null}
                  {t.message ? <div className="text-sm opacity-80 mt-0.5">{t.message}</div> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast() debe usarse dentro de <ToastProvider />");
  return ctx;
}
