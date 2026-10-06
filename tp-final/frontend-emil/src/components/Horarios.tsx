"use client";

import { useEnVista } from "./useEnVista";
import { HORARIOS } from "@/lib/datos";

export function Horarios() {
  const [ref, visible] = useEnVista<HTMLDivElement>();

  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-16">
      <div ref={ref} className="mx-auto grid max-w-[1240px] gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <div>
          <h2 className="ancha text-[clamp(1.9rem,5vw,3.4rem)] font-bold uppercase leading-[0.98] tracking-[-0.02em]">
            Cuándo
            <br />
            atiende
          </h2>
          <p className="mt-6 max-w-[30ch] text-[1.02rem] leading-relaxed text-marfil-tenue">
            La agenda abre en estas franjas. Reservar está disponible todo el día, todos los días.
          </p>
        </div>

        <ul className="w-full">
          {HORARIOS.map((f, i) => {
            const cerrado = f.horas === null;
            return (
              <li
                key={f.dia}
                className="sube flex items-baseline justify-between gap-6 border-b border-marfil-débil/18 py-4 first:border-t first:border-marfil-débil/30"
                data-visible={visible || undefined}
                style={{ transitionDelay: `${i * 45}ms` }}
              >
                <span className="ancha text-[1.1rem] font-semibold uppercase tracking-[0.02em] sm:text-[1.25rem]">
                  {f.dia}
                </span>
                {cerrado ? (
                  <span className="mono text-[0.78rem] uppercase tracking-[0.22em] text-marfil-débil">
                    Cerrado
                  </span>
                ) : (
                  <span className="mono text-right text-[0.82rem] tracking-[0.04em] text-marfil-tenue sm:text-[0.95rem]">
                    {f.horas}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
