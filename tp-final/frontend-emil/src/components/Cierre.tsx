"use client";

import { SplitFlap } from "./SplitFlap";
import { useEnVista } from "./useEnVista";
import { Accion, PuntoVivo } from "./ui";
import { URL_RESERVAR } from "@/lib/datos";

export function Cierre() {
  const [ref, visible] = useEnVista<HTMLDivElement>();

  return (
    <section
      ref={ref}
      className="border-t border-marfil-débil/25 bg-tablero-hondo px-6 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto max-w-[1240px]">
        <div>
          <span className="sr-only">Reservá ahora.</span>
          <SplitFlap
            text="RESERVÁ AHORA"
            playing={visible}
            size={{ fontSize: "clamp(2rem, 8.4vw, 6.4rem)" }}
          />
        </div>

        <div className="mt-11 flex flex-wrap items-center gap-x-10 gap-y-6">
          <Accion href={URL_RESERVAR} grande>
            Reservar turno
          </Accion>
          <div className="max-w-[34ch]">
            <p className="mono flex items-center gap-2 text-[0.66rem] uppercase tracking-[0.22em] text-senal">
              <PuntoVivo />
              Agenda abierta las 24 h
            </p>
            <p className="mt-2 text-[1rem] leading-relaxed text-marfil-tenue">
              Elegís, ves los horarios reales y tomás el turno. Sin esperar que alguien conteste.
            </p>
          </div>
        </div>
      </div>

      {/* pie */}
      <footer className="mx-auto mt-24 max-w-[1240px] border-t border-marfil-débil/20 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <span className="ancha text-[0.95rem] font-semibold uppercase tracking-[0.3em] text-marfil">
            Natura <span className="text-marfil-tenue">Estética Integral</span>
          </span>
          <span className="mono text-[0.64rem] uppercase tracking-[0.22em] text-marfil-débil">
            Lun a Vie 09–19:30 · Sáb 09–13:30
          </span>
        </div>
      </footer>
    </section>
  );
}
