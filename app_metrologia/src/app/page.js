import { redirect } from "next/navigation";

export default function Home() {
  // Redirigir automáticamente a la nueva ruta principal
  redirect("/dashboard");
}