import Sidebar from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default function MainLayout({ children }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#F2F2F2] font-sans">
        {/* Sidebar fijo */}
        <Sidebar />

        {/* Contenido principal */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
