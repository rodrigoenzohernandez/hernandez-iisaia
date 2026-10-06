import Link from 'next/link';
import { Sello } from '@/components/Iconos';
import { PLATAFORMA } from '@/lib/centro';

/**
 * El encabezado de la plataforma (no de un centro): marca propia, sin slug. `conRegistro` en
 * falso lo deja solo con la marca, para el panel de superadmin donde el CTA de alta no va.
 */
export function EncabezadoPlataforma({
  sobreFoto = false,
  conRegistro = true,
}: {
  sobreFoto?: boolean;
  conRegistro?: boolean;
}) {
  return (
    <header className={sobreFoto ? 'absolute inset-x-0 top-0 z-20 text-papel' : 'relative z-20 bg-tinta text-papel'}>
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-6 px-6 py-6 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-3" aria-label={`${PLATAFORMA.nombre} — inicio`}>
          <Sello className="h-7 w-7 shrink-0" />
          <span className="ancha text-[0.95rem] font-bold uppercase tracking-[0.2em]">{PLATAFORMA.nombre}</span>
        </Link>
        {conRegistro && (
          <Link
            href="/registrarse"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] underline decoration-verde decoration-2 transition-colors duration-200 hover:text-verde"
          >
            Registrá tu centro
          </Link>
        )}
      </div>
    </header>
  );
}
