'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flecha } from '@/components/Iconos';

function normalizarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Para la dueña que ya tiene su centro: escribe la dirección y va a su login. No valida contra
 * el backend —el login se encarga—; solo lleva a `/[slug]/admin/ingresar`.
 */
export function EntrarACentro() {
  const router = useRouter();
  const [slug, setSlug] = useState('');

  function ir(evento: React.FormEvent) {
    evento.preventDefault();
    const s = normalizarSlug(slug);
    if (s.length >= 3) router.push(`/${s}/admin/ingresar`);
  }

  return (
    <form onSubmit={ir} className="flex flex-wrap items-stretch gap-3">
      <div className="flex items-stretch border border-papel/30 bg-papel/5 focus-within:border-verde">
        <span className="cifra flex items-center whitespace-nowrap border-r border-papel/20 px-3 text-[0.82rem] text-papel/55">
          /
        </span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="tu-centro"
          aria-label="La dirección de tu centro"
          className="cifra w-[11rem] bg-transparent px-3 py-2.5 text-[0.95rem] text-papel placeholder:text-papel/55 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="ancha inline-flex items-center gap-2 border border-papel/40 px-5 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-papel transition-colors hover:bg-papel hover:text-tinta"
      >
        Entrar
        <Flecha className="h-4 w-4" />
      </button>
    </form>
  );
}
