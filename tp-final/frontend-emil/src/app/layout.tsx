import type { Metadata } from "next";
import { Saira, Saira_Condensed, Martian_Mono } from "next/font/google";
import "./globals.css";

// La cara pintada del tablero: una grotesca condensada, mecánica, en caja alta.
const display = Saira_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--fuente-display",
  display: "swap",
});

// El texto corrido: la misma familia en ancho normal, para que el sistema sea uno solo.
const body = Saira({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-body",
  display: "swap",
});

// El dato del tablero: un monoespaciado de medición para horas, precios y duraciones.
const mono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Natura Estética Integral — reservá tu turno",
  description:
    "La grilla que ves es la que existe. Reservá tu tratamiento sola, al instante, sin esperar respuesta.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
