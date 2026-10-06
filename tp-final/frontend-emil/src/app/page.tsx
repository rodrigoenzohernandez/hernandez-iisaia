import { Hero } from "@/components/Hero";
import { Tablero } from "@/components/Tablero";
import { Como } from "@/components/Como";
import { Horarios } from "@/components/Horarios";
import { Cierre } from "@/components/Cierre";

export default function Landing() {
  return (
    <main>
      <Hero />
      <Tablero />
      <Como />
      <Horarios />
      <Cierre />
    </main>
  );
}
