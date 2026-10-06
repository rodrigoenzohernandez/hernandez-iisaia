/**
 * El backend no expone el nombre de un centro por su slug en ninguna ruta pública (la tabla
 * Tenant solo se lee con token de plataforma). Hasta que haya un `GET /tenants/{slug}` público,
 * la marca se deriva del slug: `estetica-luz` → "Estética Integral"… no, → "Estetica Luz".
 *
 * Es un fallback honesto: title-case del slug, guiones a espacios. No recupera tildes ni
 * mayúsculas internas, pero es mejor que mostrar el slug crudo.
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

/** El nombre del producto (la plataforma), no de un centro. */
export const PLATAFORMA = {
  nombre: 'Turnos',
  nombreLargo: 'Turnos · agenda para centros de estética',
} as const;
