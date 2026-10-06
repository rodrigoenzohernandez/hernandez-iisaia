"use client";

import { useEnVista } from "./useEnVista";
import { TRATAMIENTOS, duracion, precio, type Tratamiento } from "@/lib/datos";

export function Tablero() {
  const [ref, visible] = useEnVista<HTMLDivElement>();

  return (
    <section id="tratamientos" className="px-6 pb-20 pt-6 sm:px-10 sm:pb-28 sm:pt-8 lg:px-16">
      <div ref={ref} className="mx-auto max-w-[1240px]">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 className="ancha max-w-[20ch] text-[clamp(1.9rem,5vw,3.4rem)] font-bold uppercase leading-[0.98] tracking-[-0.02em]">
            El tablero del centro
          </h2>
          <p className="mono max-w-[32ch] text-[0.78rem] leading-relaxed text-marfil-tenue">
            Ocho tratamientos, con su duración, su precio y su seña. Lo que ves acá es lo que vas
            a ver al reservar.
          </p>
        </div>

        {/* cabecera de columnas (desktop) */}
        <div className="mono mt-6 hidden grid-cols-[1fr_7rem_9rem_8rem_10rem] gap-6 border-b border-marfil-débil/30 pb-3 text-[0.64rem] uppercase tracking-[0.2em] text-marfil-débil md:grid">
          <span>Tratamiento</span>
          <span className="text-right">Duración</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Seña</span>
          <span className="text-right">Estado</span>
        </div>

        <ul>
          {TRATAMIENTOS.map((t, i) => (
            <Fila key={t.nombre} t={t} visible={visible} orden={i} />
          ))}
        </ul>

        {/* leyenda del estado */}
        <div className="mono mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[0.68rem] leading-relaxed text-marfil-tenue">
          <span>
            <span className="text-senal">DIRECTO</span> · reservás y listo.
          </span>
          <span className="muesca ml-4 text-marfil-tenue">
            VALORACIÓN · una consulta previa define la técnica.
          </span>
        </div>
      </div>
    </section>
  );
}

function Fila({ t, visible, orden }: { t: Tratamiento; visible: boolean; orden: number }) {
  const estado = t.valoracion ? "VALORACIÓN" : "DIRECTO";

  return (
    <li
      className="sube grid grid-cols-1 gap-x-6 gap-y-2 border-b border-marfil-débil/18 py-6 md:grid-cols-[1fr_7rem_9rem_8rem_10rem] md:items-baseline"
      data-visible={visible || undefined}
      style={{ transitionDelay: `${orden * 55}ms` }}
    >
      <span className="ancha text-[1.35rem] font-semibold uppercase leading-none tracking-[-0.01em] md:text-[1.5rem]">
        {t.nombre}
      </span>

      {/* datos: en mono, tabulares. En móvil van en una línea compacta. */}
      <span className="mono text-[0.9rem] text-marfil-tenue md:text-right">
        <span className="text-marfil-débil md:hidden">dur </span>
        {duracion(t.duracionMin)}
      </span>
      <span className="mono text-[0.9rem] text-marfil md:text-right">
        <span className="text-marfil-débil md:hidden">precio </span>
        {precio(t.precioCentavos)}
      </span>
      <span className="mono text-[0.9rem] text-marfil-tenue md:text-right">
        <span className="text-marfil-débil md:hidden">seña </span>
        {precio(t.senaCentavos)}
      </span>

      {/* estado por estructura: DIRECTO en ámbar; VALORACIÓN apagado con muesca. El chip entero
          flipea al entrar en vista —el gesto del tablero asentándose— pero se lee como una
          unidad, no como celdas minúsculas. */}
      <span className="mt-1 block md:mt-0 md:justify-self-end" style={{ perspective: "220px" }}>
        {t.valoracion ? (
          <span
            className="flip-in mono muesca inline-block border border-marfil-débil/45 px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-marfil-tenue"
            data-visible={visible || undefined}
            style={{ transitionDelay: `${320 + orden * 70}ms` }}
          >
            {estado}
          </span>
        ) : (
          <span
            className="flip-in mono inline-block bg-senal/15 px-2.5 py-1 text-[0.64rem] font-medium uppercase tracking-[0.18em] text-senal"
            data-visible={visible || undefined}
            style={{ transitionDelay: `${320 + orden * 70}ms` }}
          >
            {estado}
          </span>
        )}
      </span>
    </li>
  );
}
