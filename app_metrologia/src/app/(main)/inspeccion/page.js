"use client";

import { useState, useEffect, useMemo } from "react";
import { apiProducts } from "@/app/actions/metrologia";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";
import InspectionModal from "@/components/metrologia/InspectionModal";

export default function InspeccionPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiProducts()
      .then((res) => {
        if (res?.ok) setProducts(Array.isArray(res.data) ? res.data : []);
        else setProducts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    if (!term) return products;

    return products.filter(
      (p) =>
        (p?.name || "").toLowerCase().includes(term) ||
        (p?.id || "").toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const total = products.length;
  const shown = filtered.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2373] tracking-tight uppercase">
            Nueva Inspección
          </h1>
          <p className="text-sm text-slate-500 font-mono mt-1">
            Selecciona una referencia para comenzar a medir.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 font-mono">
            {loading ? "Cargando..." : `${shown} / ${total} referencias`}
          </div>
          <Badge variant="blue">OPERATIVO</Badge>
        </div>
      </div>

      {/* Search (sticky) */}
      <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 bg-slate-50/80 backdrop-blur">
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="BUSCAR REFERENCIA (NOMBRE O ID)..."
            className="pl-10 h-11 bg-white border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Mini info */}
        <div className="flex items-center justify-between mt-2 text-[10px] uppercase tracking-widest text-slate-400 font-mono px-1">
          <span>Resultados</span>
          <span>{loading ? "..." : shown}</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="p-4 border-slate-200">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-2/3 bg-slate-100 rounded" />
                <div className="h-3 w-1/3 bg-slate-100 rounded" />
                <div className="h-10 w-full bg-slate-100 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : total === 0 ? (
        <Card className="p-8 border-dashed border-slate-200 bg-white/60">
          <div className="flex items-center gap-3 text-slate-500">
            <Icons.Box className="w-5 h-5 text-slate-300" />
            <div>
              <div className="font-semibold text-slate-700">No hay productos cargados</div>
              <div className="text-sm text-slate-500">
                Revisa la fuente de datos o la conexión del API.
              </div>
            </div>
          </div>
        </Card>
      ) : shown === 0 ? (
        <Card className="p-8 border-dashed border-slate-200 bg-white/60">
          <div className="flex items-center gap-3 text-slate-500">
            <Icons.Search className="w-5 h-5 text-slate-300" />
            <div>
              <div className="font-semibold text-slate-700">Sin resultados</div>
              <div className="text-sm text-slate-500">
                Intenta con otra palabra o busca por ID.
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((product) => (
            <Card
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="p-4 cursor-pointer group border-slate-200 hover:border-slate-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#1F2373] transition-colors rounded-xl shrink-0">
                    <Icons.Box className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-[#1F2373] tracking-wide text-sm truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                      {product.id}
                    </p>
                  </div>
                </div>

                <Icons.Ruler className="w-4 h-4 text-slate-300 group-hover:text-[#1F2373] transition-colors shrink-0" />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <Badge variant="blue">DISPONIBLE</Badge>
                <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
                  Click para medir
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedProduct && (
        <InspectionModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
