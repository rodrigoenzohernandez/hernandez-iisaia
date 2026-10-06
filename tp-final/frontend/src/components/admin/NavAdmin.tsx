'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * La nav del panel. El tramo activo lo marca el subrayado verde —la misma señal que el
 * encabezado público usa para su acción primaria—, no un cambio de color del texto.
 */
export function NavAdmin({ slug }: { slug: string }) {
  const ruta = usePathname();
  const base = `/${slug}/admin`;
  const enlaces = [
    { href: base, texto: 'Agenda' },
    { href: `${base}/tratamientos`, texto: 'Tratamientos' },
    { href: `${base}/horarios`, texto: 'Horarios' },
    { href: `${base}/cobros`, texto: 'Cobros' },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 sm:gap-x-8">
      {enlaces.map((e) => {
        // La agenda es activa solo exacta; las otras, también en sus sub-rutas.
        const activo = e.href === base ? ruta === base : ruta.startsWith(e.href);
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
