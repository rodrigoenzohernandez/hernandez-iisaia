import type { components } from './api';
import { pedir, type Pagina } from './cliente';

/**
 * La capa de datos *cross-tenant*: el alta de centros (`POST /tenants`) y el panel de
 * plataforma (`/plataforma/*`). A diferencia de `cliente`/`cuenta`/`admin`, acá NO se usa
 * `enCentro`: estas rutas no cuelgan de un centro.
 */
export type SesionPlataforma = components['schemas']['SesionPlataformaDto'];
export type Resumen = components['schemas']['ResumenDto'];
export type Centro = components['schemas']['CentroDto'];
export type CrearCentro = components['schemas']['CrearCentroDto'];
export type CentroCreado = components['schemas']['CentroCreadoDto'];

/* --------------------------------------------------------- alta de centros */

/**
 * Alta self-service de un centro, sin token: crea el centro en Básico y, como su
 * administradora, a quien lo da de alta. La respuesta trae su sesión, así que se entra directo
 * al panel. Slug repetido o reservado → `slug_taken`; hasta tres altas por hora por IP.
 */
export function crearCentro(datos: CrearCentro): Promise<CentroCreado> {
  return pedir<CentroCreado>('/tenants', { method: 'POST', body: datos });
}

/* ------------------------------------------------------- panel de plataforma */

export function iniciarSesionPlataforma(email: string, password: string): Promise<SesionPlataforma> {
  return pedir<SesionPlataforma>('/plataforma/sesiones', {
    method: 'POST',
    body: { email, password },
  });
}

export function obtenerResumen(token: string): Promise<Resumen> {
  return pedir<Resumen>('/plataforma/resumen', { token });
}

export function listarCentros(
  token: string,
  filtros: { activo?: boolean; cursor?: string } = {},
): Promise<Pagina<Centro>> {
  const query = new URLSearchParams({ limit: '50' });
  if (filtros.activo !== undefined) query.set('activo', String(filtros.activo));
  if (filtros.cursor) query.set('cursor', filtros.cursor);
  return pedir<Pagina<Centro>>(`/plataforma/tenants?${query}`, { token });
}

/** Baja (false) o reactivación (true) de un centro. Un centro de baja responde 404 en sus rutas. */
export function cambiarActivoCentro(token: string, slug: string, activo: boolean): Promise<Centro> {
  return pedir<Centro>(`/plataforma/tenants/${slug}`, {
    method: 'PATCH',
    body: { activo },
    token,
  });
}
