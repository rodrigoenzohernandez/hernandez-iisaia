import { cache } from 'react';
import type { components } from './api';
import { enCentro, ErrorApi, pedir } from './cliente';

export type Centro = components['schemas']['CentroPublicoDto'];

/**
 * El nombre derivado del slug: `estetica-luz` → "Estetica Luz". Es el respaldo para cuando la
 * API no contesta; con la API arriba, el nombre sale de `obtenerCentro`.
 *
 * Title-case del slug, guiones a espacios. No recupera tildes ni mayúsculas internas.
 */
export function nombreDeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

/** La primera palabra del nombre, para la marca compacta. */
export function nombreCortoDeSlug(slug: string): string {
  return nombreDeSlug(slug).split(' ')[0] ?? slug;
}

/**
 * El centro de un slug, pedido una sola vez por render: `cache` hace que el layout, el
 * encabezado y el pie de una misma página compartan la llamada. Solo memoiza en componentes de
 * servidor, que son los únicos que importan este módulo.
 *
 * `null` solo si la API dice que el centro no existe o está dado de baja. Ante cualquier otra
 * falla (API caída, 5xx, 429) devuelve el nombre derivado del slug: una caída de la API no
 * puede convertir todos los centros en 404.
 */
export const obtenerCentro = cache(async (slug: string): Promise<Centro | null> => {
  try {
    return await pedir<Centro>(enCentro(slug, ''));
  } catch (error) {
    if (error instanceof ErrorApi && error.codigo === 'tenant_not_found') return null;
    return { slug, nombre: nombreDeSlug(slug) };
  }
});

/** El nombre a mostrar. Si el centro no existe, el layout de `[slug]` ya respondió 404. */
export async function nombreDelCentro(slug: string): Promise<string> {
  return (await obtenerCentro(slug))?.nombre ?? nombreDeSlug(slug);
}

/** El nombre del producto (la plataforma), no de un centro. */
export const PLATAFORMA = {
  nombre: 'Turnos',
  nombreLargo: 'Turnos · agenda para centros de estética',
} as const;
