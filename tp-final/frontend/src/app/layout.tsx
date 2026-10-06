import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { PLATAFORMA } from "@/lib/centro";
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
  title: PLATAFORMA.nombreLargo,
  description:
    "La agenda de turnos de tu centro de estética, online. Tus clientas reservan solas contra la grilla real, sin WhatsApp y sin esperar respuesta.",
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
