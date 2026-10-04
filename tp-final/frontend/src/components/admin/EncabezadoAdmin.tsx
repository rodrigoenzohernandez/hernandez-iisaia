import Link from 'next/link';
import { CENTRO } from '@/lib/centro';
import { Marca } from '@/components/Marca';
import { NavAdmin } from './NavAdmin';

/**
 * El encabezado del panel. A diferencia del público, no lleva "Reservar" ni "Mis turnos":
 * la administradora no reserva para sí misma. Lleva la marca y la nav entre las tres
 * pantallas del panel.
 *
 * `conNav` queda en falso en el login, donde todavía no hay sesión y navegar no tiene sentido.
 */
export function EncabezadoAdmin({ conNav = true }: { conNav?: boolean }) {
  return (
    <header className="relative z-20 bg-tinta text-papel">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6 lg:px-12">
        <Link href="/admin" aria-label={`${CENTRO.nombre} — panel`}>
          <Marca />
        </Link>
        {conNav ? (
          <NavAdmin />
        ) : (
          <span className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-verde">
            Panel del centro
          </span>
        )}
      </div>
    </header>
  );
}
