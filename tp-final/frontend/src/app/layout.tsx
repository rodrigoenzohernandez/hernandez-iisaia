import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { CENTRO } from "@/lib/centro";
import "./globals.css";

// Un solo sistema tipográfico llevado a los dos extremos del eje de ancho: caps anchas para
// las declaraciones, angosta para las fichas. El eje hace el trabajo que en otro sistema
// pediría una segunda familia.
const archivo = Archivo({
  variable: "--fuente",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${CENTRO.nombre} — Reservá tu turno`,
  description:
    "Centro de estética integral. Elegí el tratamiento, mirá los horarios que realmente quedan libres y reservá tu turno sin crear una cuenta.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      data-scroll-behavior="smooth"
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
