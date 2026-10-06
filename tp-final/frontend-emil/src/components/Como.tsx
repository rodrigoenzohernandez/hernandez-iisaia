"use client";

import { useEnVista } from "./useEnVista";

const PASOS = [
  {
    n: "01",
    titulo: "Elegís el tratamiento",
    texto: "Con su duración, su precio y su seña a la vista. Sin pedir presupuesto por mensaje.",
  },
  {
    n: "02",
    titulo: "Ves los horarios reales del día",
    texto: "La grilla que aparece es la que existe: el cupo se controla contra la agenda en el momento de reservar.",
  },
  {
    n: "03",
    titulo: "Tomás el turno",
    texto: "Queda tomado al apretar el botón. Lo confirmás con la seña; el resto lo abonás en el centro.",
  },
];

export function Como() {
  const [ref, visible] = useEnVista<HTMLDivElement>();

  return (
    <section className="border-t border-marfil-débil/20 bg-tablero-hondo px-6 py-20 sm:px-10 sm:py-28 lg:px-16">
      <div ref={ref} className="mx-auto grid max-w-[1240px] gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <h2 className="ancha text-[clamp(1.9rem,5vw,3.4rem)] font-bold uppercase leading-[0.98] tracking-[-0.02em] lg:sticky lg:top-16 lg:self-start">
          Reservar es la
          <br />
          ruta corta
        </h2>

        {/* la ruta: paradas sobre una línea vertical, no tarjetas iguales */}
        <ol className="relative max-w-[40rem]">
          <span
            className="absolute bottom-[1.1rem] left-[0.46rem] top-[0.5rem] w-px bg-marfil-débil/30"
            aria-hidden="true"
          />
          {PASOS.map((p, i) => (
            <li
              key={p.n}
              className="sube relative grid grid-cols-[2.2rem_1fr] gap-x-5 pb-12 last:pb-0"
              data-visible={visible || undefined}
              style={{ transitionDelay: `${i * 110}ms` }}
            >
              <span
                className="relative z-10 mt-[0.35rem] h-[0.95rem] w-[0.95rem] rounded-full border-2 border-senal bg-tablero-hondo"
                aria-hidden="true"
              />
              <div className="pt-0">
                <span className="mono text-[0.8rem] font-medium tracking-[0.2em] text-senal">
                  Paso {p.n}
                </span>
                <h3 className="ancha mt-2 text-[clamp(1.4rem,3vw,2rem)] font-semibold uppercase leading-tight tracking-[-0.015em]">
                  {p.titulo}
                </h3>
                <p className="mt-3 max-w-[40ch] text-[1.05rem] leading-relaxed text-marfil-tenue">
                  {p.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
