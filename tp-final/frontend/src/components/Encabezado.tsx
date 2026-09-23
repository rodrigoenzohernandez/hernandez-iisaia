import Link from 'next/link';
import { CENTRO } from '@/lib/centro';
import { Marca } from './Marca';

export function Encabezado({ sobreFoto = false }: { sobreFoto?: boolean }) {
  return (
    <header
      className={
        sobreFoto
          ? 'absolute inset-x-0 top-0 z-20 text-papel'
          : 'relative z-20 bg-tinta text-papel'
      }
    >
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-6 px-6 py-6 lg:px-12">
        <Link href="/" aria-label={`${CENTRO.nombre} — inicio`}>
          <Marca />
        </Link>
        <Link
          href="/reservar"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] underline decoration-verde decoration-2 transition-colors duration-200 hover:text-verde"
        >
          Reservar turno
        </Link>
      </div>
    </header>
  );
}
