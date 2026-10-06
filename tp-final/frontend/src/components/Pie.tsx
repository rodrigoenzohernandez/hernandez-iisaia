import Link from 'next/link';
import { nombreDeSlug } from '@/lib/centro';
import { Marca } from './Marca';

/**
 * El pie del centro. Ya no muestra los horarios: no hay endpoint público que los devuelva por
 * slug (las ventanas de atención se leen con token). Hasta que el backend exponga un
 * `GET /tenants/{slug}` público, el pie queda con la marca y los accesos.
 */
export function Pie({ slug }: { slug: string }) {
  return (
    <footer className="mt-auto bg-tinta text-papel">
      <div className="mx-auto max-w-[1380px] px-6 py-20 lg:px-12">
        <div className="grid gap-14 md:grid-cols-[1.5fr_1fr]">
          <div>
            <Marca slug={slug} />
            <p className="angosta mt-7 max-w-[38ch] text-[0.95rem] leading-relaxed text-papel/65">
              Reservá tu turno con la agenda real del centro: elegís el tratamiento, ves los
              horarios que existen y lo tomás vos misma, sin esperar que alguien conteste.
            </p>
          </div>

          <div>
            <h2 className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-verde">
              Ir a
            </h2>
            <ul className="mt-6 space-y-3.5 text-[0.82rem]">
              <li>
                <Link href={`/${slug}#tratamientos`} className="transition-colors hover:text-verde">
                  Todos los tratamientos
                </Link>
              </li>
              <li>
                <Link href={`/${slug}/reservar`} className="transition-colors hover:text-verde">
                  Reservar un turno
                </Link>
              </li>
              <li>
                <Link href={`/${slug}/mis-turnos`} className="transition-colors hover:text-verde">
                  Mis turnos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="angosta mt-16 border-t border-papel/12 pt-7 text-[0.7rem] uppercase tracking-[0.18em] text-papel/55">
          {nombreDeSlug(slug)}
        </p>
      </div>
    </footer>
  );
}
