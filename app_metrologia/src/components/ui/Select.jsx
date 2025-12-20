"use client";

import { useState, useRef, useEffect, Children } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

export const Select = ({ value, onChange, children, className, placeholder = "Seleccionar..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const options = Children.toArray(children).map((child) => ({
    value: child.props.value,
    label: child.props.children,
  }));

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        // CORRECCIÓN: Usamos coordenadas directas del viewport (rect)
        // porque el elemento usa 'position: fixed'.
        // Ya NO sumamos window.scrollY ni window.scrollX.
        top: rect.bottom + 4, 
        left: rect.left,
        width: rect.width,
      });
    }
  };

  const handleOpen = () => {
    if (!isOpen) updateCoords();
    setIsOpen(!isOpen);
  };

  const handleSelect = (newValue) => {
    if (onChange) onChange({ target: { value: newValue } });
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleEvent = (e) => {
      // Ignorar eventos que ocurren DENTRO del menú (para permitir scroll interno)
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
        return;
      }
      // Cerrar si se hace scroll/resize fuera (ej. en el modal o body)
      setIsOpen(false);
    };

    window.addEventListener("scroll", handleEvent, true);
    window.addEventListener("resize", handleEvent);
    
    return () => {
      window.removeEventListener("scroll", handleEvent, true);
      window.removeEventListener("resize", handleEvent);
    };
  }, [isOpen]);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "w-full flex items-center justify-between",
          "bg-slate-50 border border-slate-200 text-[#1F2373] text-sm px-3 py-2.5 rounded-sm",
          "hover:bg-slate-100 hover:border-[#1F2373]/30 transition-all font-mono",
          "focus:outline-none focus:ring-2 focus:ring-[#1F2373]/10 focus:border-[#1F2373]",
          isOpen && "border-[#1F2373] ring-2 ring-[#1F2373]/10"
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-slate-400")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={cn(
            "w-4 h-4 text-[#1F2373] transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998] cursor-default" 
            onClick={() => setIsOpen(false)} 
          />

          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-slate-200 rounded-md shadow-2xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100 custom-scrollbar"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
          >
            <ul className="py-1">
              {options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <li
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "relative cursor-pointer select-none py-2.5 pl-3 pr-9 text-sm font-mono transition-colors",
                      isSelected 
                        ? "bg-[#1F2373]/5 text-[#1F2373] font-bold" 
                        : "text-slate-700 hover:bg-slate-50 hover:text-[#1F2373]"
                    )}
                  >
                    <span className="block truncate">{opt.label}</span>
                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#1F2373]">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </li>
                );
              })}
              {options.length === 0 && (
                <li className="py-3 px-3 text-center text-xs text-slate-400 italic">
                  No hay opciones
                </li>
              )}
            </ul>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};