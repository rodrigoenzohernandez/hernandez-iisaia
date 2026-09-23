import Link from 'next/link';
import { CENTRO, HORARIOS } from '@/lib/centro';
import { Marca } from './Marca';

export function Pie() {
  return (
    <footer className="mt-auto bg-tinta text-papel">
      <div className="mx-auto max-w-[1380px] px-6 py-20 lg:px-12">
        <div className="grid gap-14 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Marca />
            <p className="angosta mt-7 max-w-[34ch] text-[0.95rem] leading-relaxed text-papel/65">
              Tratamientos faciales y corporales con aparatología. Los turnos se reservan acá,
              con la agenda real del centro.
            </p>
          </div>

          <div>
            <h2 className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-verde">
              Atención
            </h2>
            <dl className="mt-6 space-y-3.5">
              {HORARIOS.map((horario) => (
                <div key={horario.dias} className="flex flex-col gap-0.5">
                  <dt className="text-[0.82rem] font-medium">{horario.dias}</dt>
                  <dd className="cifra angosta text-[0.82rem] text-papel/55">{horario.franjas}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-verde">
              Ir a
            </h2>
            <ul className="mt-6 space-y-3.5 text-[0.82rem]">
              <li>
                <Link href="/#tratamientos" className="transition-colors hover:text-verde">
                  Todos los tratamientos
                </Link>
              </li>
              <li>
                <Link href="/reservar" className="transition-colors hover:text-verde">
                  Reservar un turno
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="angosta mt-16 border-t border-papel/12 pt-7 text-[0.7rem] uppercase tracking-[0.18em] text-papel/55">
          {CENTRO.nombre}
        </p>
      </div>
    </footer>
  );
}
