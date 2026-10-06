'use client';

import type { CodigoError } from './cliente';

/**
 * Un token de clienta o de administradora es de un solo centro y de un solo rol: la clave los
 * lleva a los dos (`turnos:${slug}:${rol}`), así un token de `lo-de-lili` no se usa contra
 * `bella-piel`. El token de plataforma es global: no pertenece a ningún centro, así que su
 * clave no lleva slug.
 */
type Rol = 'clienta' | 'admin' | 'plataforma';

function clave(rol: Rol, slug?: string): string {
  if (rol === 'plataforma') return 'turnos:plataforma';
  if (!slug) throw new Error(`El rol ${rol} necesita un slug de centro`);
  return `turnos:${slug}:${rol}`;
}

// El almacenamiento puede fallar o venir vacío: ventana privada, datos borrados, permisos.
// Nada de esto debe romper una pantalla.
export function leerToken(rol: Rol, slug?: string): string | null {
  try {
    return window.localStorage.getItem(clave(rol, slug));
  } catch {
    return null;
  }
}

export function guardarToken(rol: Rol, token: string, slug?: string): void {
  try {
    window.localStorage.setItem(clave(rol, slug), token);
  } catch {
    // Sin persistencia la sesión dura lo que dura la pestaña, que es mejor que romper.
  }
}

export function borrarToken(rol: Rol, slug?: string): void {
  try {
    window.localStorage.removeItem(clave(rol, slug));
  } catch {
    // Nada que hacer: el token ya no se va a poder leer igual.
  }
}

/** No hay endpoint de cierre de sesión: el token no tiene estado en el servidor. */
export function cerrarSesion(rol: Rol, slug?: string): void {
  borrarToken(rol, slug);
}

/**
 * Si el error dice que el token ya no sirve. Insistir con él no lleva a ningún lado: hay que
 * tirarlo y volver a pedir el ingreso.
 *
 * `wrong_tenant` entra acá porque un token es de un solo centro: contra otro slug no sirve
 * aunque sea válido. `forbidden_role`, porque una clienta en el panel —o al revés— tampoco
 * se arregla reintentando.
 */
export function sesionVencida(codigo: CodigoError): boolean {
  return (
    codigo === 'unauthenticated' ||
    codigo === 'invalid_token' ||
    codigo === 'wrong_tenant' ||
    codigo === 'forbidden_role'
  );
}

/**
 * La vuelta de OAuth de Mercado Pago cae en una URL fija para todos los centros, así que la
 * página de vuelta tiene que saber a qué centro volvió. Se guarda el slug antes de redirigir
 * y se lee al volver. `sessionStorage` y no `localStorage`: muere al cerrar la pestaña, que es
 * justo lo que dura una conexión.
 */
const CLAVE_SLUG_MP = 'turnos:mp:slug-conectando';

export function recordarSlugMp(slug: string): void {
  try {
    window.sessionStorage.setItem(CLAVE_SLUG_MP, slug);
  } catch {
    // Sin sessionStorage la vuelta usa el slug del propio frontend, que acá es uno solo.
  }
}

export function leerSlugMp(): string | null {
  try {
    return window.sessionStorage.getItem(CLAVE_SLUG_MP);
  } catch {
    return null;
  }
}
