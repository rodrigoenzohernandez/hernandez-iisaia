import Link from 'next/link';
import { nombreDeSlug } from '@/lib/centro';
import { Marca } from '@/components/Marca';
import { NavAdmin } from './NavAdmin';

/**
 * El encabezado del panel. A diferencia del público, no lleva "Reservar" ni "Mis turnos":
 * la administradora no reserva para sí misma. Lleva la marca y la nav entre las pantallas
 * del panel.
 *
 * `conNav` queda en falso en el login, donde todavía no hay sesión y navegar no tiene sentido.
 */
export function EncabezadoAdmin({ slug, conNav = true }: { slug: string; conNav?: boolean }) {
  return (
    <header className="relative z-20 bg-tinta text-papel">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6 lg:px-12">
        <Link href={`/${slug}/admin`} aria-label={`${nombreDeSlug(slug)} — panel`}>
          <Marca slug={slug} />
        </Link>
        {/* En el login (sin sesión) la nav no tiene sentido: queda solo la marca. */}
        {conNav && <NavAdmin slug={slug} />}
      </div>
    </header>
  );
}
