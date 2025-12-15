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

  useEffect(() => {
    apiProducts().then((res) => {
      if (res?.ok) setProducts(Array.isArray(res.data) ? res.data : []);
    });
  }, []);

  const filtered = useMemo(() => {
    const term = (searchTerm || "").toLowerCase();
    return products.filter((p) => 
      (p?.name || "").toLowerCase().includes(term) || 
      (p?.id || "").toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2373] tracking-tight uppercase">
          Nueva Inspección
        </h1>
        <p className="text-sm text-slate-500 font-mono mt-1">
          Seleccione una referencia para comenzar a medir.
        </p>
      </div>

      <div className="relative">
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="BUSCAR REFERENCIA..."
          className="pl-10 h-11 bg-white border-slate-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((product) => (
          <Card
            key={product.id}
            onClick={() => setSelectedProduct(product)}
            className="p-4 cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="w-10 h-10 bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#1F2373] transition-colors rounded-sm">
                <Icons.Box className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#1F2373] tracking-wide text-sm">{product.name}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{product.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <Badge variant="blue">DISPONIBLE</Badge>
               <Icons.Ruler className="w-4 h-4 text-slate-300 group-hover:text-[#1F2373]" />
            </div>
          </Card>
        ))}
      </div>

      {selectedProduct && (
        <InspectionModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}