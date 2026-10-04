'use client';

import { SLUG, type CodigoError } from './cliente';

/**
 * Un token es de un solo centro y de un solo rol. La clave los lleva a los dos: un token de
 * `lo-de-lili` contra el catálogo de `bella-piel` da 403, también en las rutas públicas.
 */
type Rol = 'clienta' | 'admin';

function clave(rol: Rol): string {
  return `turnos:${SLUG}:${rol}`;
}

// El almacenamiento puede fallar o venir vacío: ventana privada, datos borrados, permisos.
// Nada de esto debe romper una pantalla.
export function leerToken(rol: Rol): string | null {
  try {
    return window.localStorage.getItem(clave(rol));
  } catch {
    return null;
  }
}

export function guardarToken(rol: Rol, token: string): void {
  try {
    window.localStorage.setItem(clave(rol), token);
  } catch {
    // Sin persistencia la sesión dura lo que dura la pestaña, que es mejor que romper.
  }
}

export function borrarToken(rol: Rol): void {
  try {
    window.localStorage.removeItem(clave(rol));
  } catch {
    // Nada que hacer: el token ya no se va a poder leer igual.
  }
}

/** No hay endpoint de cierre de sesión: el token no tiene estado en el servidor. */
export function cerrarSesion(rol: Rol): void {
  borrarToken(rol);
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
