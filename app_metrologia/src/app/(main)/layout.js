import Sidebar from "@/components/layout/Sidebar";

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F2F2F2] font-sans">
      {/* El Sidebar se queda fijo a la izquierda */}
      <Sidebar />
      
      {/* El contenido de la página cambia aquí dentro */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Un contenedor con scroll para el contenido principal */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {children}
        </div>
      </main>
    </div>
  );
}