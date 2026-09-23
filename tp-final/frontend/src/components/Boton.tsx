import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Tono = 'verde' | 'tinta' | 'borde';

const base =
  'inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-[0.8rem] font-semibold uppercase tracking-[0.12em] transition-[background-color,color,border-color] duration-200 ease-[var(--ease-salida)] disabled:cursor-not-allowed disabled:opacity-45';

const tonos: Record<Tono, string> = {
  // Nunca texto claro sobre el verde: no alcanza 4.5:1. La tinta sí, con holgura.
  verde: 'bg-verde text-tinta hover:bg-verde-vivo',
  tinta: 'bg-tinta text-papel hover:bg-tinta-suave',
  borde: 'border border-current text-tinta hover:bg-tinta hover:text-papel',
};

export function Boton({
  tono = 'verde',
  className = '',
  children,
  ...resto
}: { tono?: Tono; children: ReactNode } & ComponentProps<'button'>) {
  return (
    <button className={`${base} ${tonos[tono]} ${className}`} {...resto}>
      {children}
    </button>
  );
}

export function BotonEnlace({
  tono = 'verde',
  className = '',
  children,
  ...resto
}: { tono?: Tono; children: ReactNode } & ComponentProps<typeof Link>) {
  return (
    <Link className={`${base} ${tonos[tono]} ${className}`} {...resto}>
      {children}
    </Link>
  );
}
