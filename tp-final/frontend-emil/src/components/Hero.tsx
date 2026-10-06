"use client";

import { useEffect, useState } from "react";
import { SplitFlap } from "./SplitFlap";
import { Accion, PuntoVivo } from "./ui";
import { URL_RESERVAR } from "@/lib/datos";

export function Hero() {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPlay(true), 220);
    return () => clearTimeout(t);
  }, []);

  return (
    <header className="flex min-h-[70svh] flex-col overflow-hidden px-6 pb-6 pt-6 sm:px-10 lg:px-16">
      {/* masthead */}
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 border-b border-marfil-débil/30 pb-5">
        <span className="ancha text-[0.82rem] font-semibold uppercase tracking-[0.26em] text-marfil sm:text-[0.95rem] sm:tracking-[0.34em]">
          Natura <span className="text-marfil-tenue">Estética Integral</span>
        </span>
        <span className="mono flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-senal sm:text-[0.68rem]">
          <PuntoVivo />
          Reservás 24 h
        </span>
      </div>

      {/* gancho en split-flap — centrado en el alto disponible para no dejar un vacío muerto */}
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center py-[2vh]">
        <h1 className="flex flex-col gap-[0.35rem]">
          <span className="sr-only">Tu turno se toma solo, al instante.</span>
          <SplitFlap
            text="SE TOMA SOLO"
            playing={play}
            size={{ fontSize: "clamp(2rem, 8.6vw, 7rem)" }}
          />
          <SplitFlap
            text="AL INSTANTE"
            playing={play}
            startDelay={260}
            size={{ fontSize: "clamp(2rem, 8.6vw, 7rem)" }}
          />
        </h1>

        <div className="mt-11 grid gap-x-10 gap-y-9 lg:grid-cols-[minmax(0,34rem)_1fr] lg:items-end">
          <p className="max-w-[34rem] text-[1.06rem] leading-relaxed text-marfil-tenue sm:text-[1.18rem]">
            La grilla que ves es la que existe. Elegís el tratamiento, ves los horarios reales del
            centro y tomás el turno vos misma — sin escribir un mensaje y esperar respuesta.
          </p>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-5 lg:justify-end">
            <Accion href={URL_RESERVAR} grande>
              Reservar turno
            </Accion>
            <a
              href="#tratamientos"
              className="ancha text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-marfil underline decoration-senal decoration-2 underline-offset-[0.4em] transition-colors hover:text-senal"
            >
              Ver tratamientos
            </a>
          </div>
        </div>
      </div>

      {/* costura inferior: una regla de tablero */}
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-4">
        <span className="mono text-[0.62rem] uppercase tracking-[0.3em] text-marfil-débil">
          Natura · Estética Integral
        </span>
        <span className="h-px flex-1 bg-marfil-débil/25" />
        <span className="mono hidden text-[0.62rem] uppercase tracking-[0.3em] text-marfil-débil sm:inline">
          Lun a Sáb
        </span>
      </div>
    </header>
  );
}
