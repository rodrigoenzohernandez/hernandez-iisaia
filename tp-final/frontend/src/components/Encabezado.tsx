import Link from 'next/link';
import { nombreDelCentro } from '@/lib/centro';
import { Marca } from './Marca';

export async function Encabezado({ slug, sobreFoto = false }: { slug: string; sobreFoto?: boolean }) {
  const nombre = await nombreDelCentro(slug);
  return (
    <header
      className={
        sobreFoto
          ? 'absolute inset-x-0 top-0 z-20 text-papel'
          : 'relative z-20 bg-tinta text-papel'
      }
    >
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6 lg:px-12">
        <Link href={`/${slug}`} aria-label={`${nombre} — inicio`}>
          <Marca nombre={nombre} />
        </Link>
        {/* Dos enlaces, una sola jerarquía: el subrayado verde es de la acción primaria y
            no se reparte. "Mis turnos" va sin él, que es la diferencia que se ve. */}
        <nav className="flex items-center gap-7 sm:gap-9">
          <Link
            href={`/${slug}/mis-turnos`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] opacity-70 transition-opacity duration-200 hover:opacity-100"
          >
            Mis turnos
          </Link>
          <Link
            href={`/${slug}/reservar`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] underline decoration-verde decoration-2 transition-colors duration-200 hover:text-verde"
          >
            Reservar turno
          </Link>
        </nav>
      </div>
    </header>
  );
}
