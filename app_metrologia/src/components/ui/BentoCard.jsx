import React from 'react';

export default function BentoCard({ children, className = "", title, icon }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-4 text-slate-500 font-medium text-sm uppercase tracking-wider">
          {icon && <span className="text-slate-400">{icon}</span>}
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        {children}
      </div>
    </div>
  );
}