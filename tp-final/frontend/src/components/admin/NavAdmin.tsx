'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ENLACES = [
  { href: '/admin', texto: 'Agenda' },
  { href: '/admin/tratamientos', texto: 'Tratamientos' },
  { href: '/admin/horarios', texto: 'Horarios' },
] as const;

/**
 * La nav del panel. El tramo activo lo marca el subrayado verde —la misma señal que el
 * encabezado público usa para su acción primaria—, no un cambio de color del texto.
 */
export function NavAdmin() {
  const ruta = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 sm:gap-x-8">
      {ENLACES.map((e) => {
        // `/admin` es activo solo exacto; los otros, también en sus sub-rutas.
        const activo = e.href === '/admin' ? ruta === '/admin' : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? 'page' : undefined}
            className={`text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition-opacity duration-200 ${
              activo
                ? 'underline decoration-verde decoration-2 underline-offset-[0.35em]'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
