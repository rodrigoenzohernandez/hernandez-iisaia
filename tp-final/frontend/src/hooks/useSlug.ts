'use client';

import { useParams } from 'next/navigation';

/**
 * El slug del centro, leído del segmento `[slug]` de la URL. Reemplaza a la constante horneada
 * de antes: ahora un mismo despliegue sirve a todos los centros.
 *
 * Solo tiene sentido dentro de `/[slug]/...`. En las rutas de plataforma (sin slug) no se usa.
 */
export function useSlug(): string {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  if (typeof slug !== 'string') {
    throw new Error('useSlug se usó fuera de una ruta /[slug]/...');
  }
  return slug;
}
