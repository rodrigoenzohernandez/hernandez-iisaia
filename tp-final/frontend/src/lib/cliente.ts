import type { components } from './api';

export type Servicio = components['schemas']['ServicioDto'];
export type Slot = components['schemas']['SlotDto'];
export type Disponibilidad = components['schemas']['DisponibilidadDto'];
export type Reserva = components['schemas']['ReservaDto'];
export type Cobro = components['schemas']['CobroDto'];

/**
 * `GET /planes` devuelve más de lo que declara el OpenAPI: el `PlanDto` del contrato no
 * trae `nombre`, `capacidadMaxima`, `recordatorios` ni `cobroOnline`, pero el endpoint sí.
 * Los agregamos acá porque la pantalla de horarios necesita `capacidadMaxima` para no
 * ofrecer una capacidad que el plan va a rechazar.
 */
export type Plan = components['schemas']['PlanDto'] & {
  nombre: string;
  capacidadMaxima: number;
  recordatorios: boolean;
  cobroOnline: boolean;
};
export type MetodoPago = components['schemas']['CreateReservaDto']['metodoPago'];
export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada' | 'ausente';

type CodigoApi = components['schemas']['ErrorDto']['code'];

// El backend ya devuelve `{code, message}` en todo, incluidos el 404, el 413 y el 429. Lo
// único que queda fuera del contrato es no poder hablar con él.
export type CodigoError = CodigoApi | 'sin_conexion';

export class ErrorApi extends Error {
  readonly codigo: CodigoError;

  constructor(codigo: CodigoError, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
  }
}

// El navegador y el servidor no llegan a la API por la misma puerta. Dentro de Docker el
// contenedor del frontend resuelve `backend` por la red del compose, pero el navegador de
// la clienta solo conoce `localhost`. Fuera de Docker las dos coinciden y no hace falta
// definir API_BASE_URL_INTERNA.
const BASE =
  (typeof window === 'undefined' ? process.env.API_BASE_URL_INTERNA : undefined) ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3100/api/v1';

export const SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'lo-de-lili';

/** Prefijo de las rutas del centro. Las de plataforma y `/planes` no lo llevan. */
export function enCentro(ruta: string): string {
  return `/tenants/${SLUG}${ruta}`;
}

export type Opciones = Omit<RequestInit, 'body'> & { token?: string; body?: unknown };

export async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { token, body, headers, ...resto } = opciones;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      ...resto,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ErrorApi('sin_conexion', 'No pudimos contactar al servidor. Revisá tu conexión.');
  }

  if (respuesta.status === 204) return undefined as T;
  if (respuesta.ok) return (await respuesta.json()) as T;

  const cuerpo = (await respuesta.json().catch(() => null)) as {
    code?: CodigoApi;
    message?: string;
  } | null;

  if (cuerpo?.code) throw new ErrorApi(cuerpo.code, cuerpo.message ?? 'Algo salió mal.');
  throw new ErrorApi('sin_conexion', 'El servidor respondió de una forma que no esperábamos.');
}

export type Pagina<T> = { data: T[]; nextCursor: string | null };

/* ------------------------------------------------------------------ público */

export async function listarServicios(token?: string): Promise<Servicio[]> {
  // Sin token devuelve solo los activos; con token de administradora, también los dados de baja.
  const pagina = await pedir<Pagina<Servicio>>(enCentro('/servicios?limit=100'), { token });
  return pagina.data;
}

export function obtenerServicio(servicioId: string, token?: string): Promise<Servicio> {
  return pedir<Servicio>(enCentro(`/servicios/${servicioId}`), { token });
}

export function obtenerDisponibilidad(servicioId: string, fecha: string): Promise<Disponibilidad> {
  return pedir<Disponibilidad>(enCentro(`/servicios/${servicioId}/disponibilidad?fecha=${fecha}`));
}

/** `/planes` es un array pelado, no `{ data }`, y no lleva el prefijo del centro. */
export function listarPlanes(): Promise<Plan[]> {
  return pedir<Plan[]>('/planes');
}

/**
 * El estado real de una reserva, sin token y sin datos personales. Es lo que hay que creerle
 * a la vuelta de Mercado Pago: los parámetros que vienen en la query los escribe cualquiera.
 */
export function estadoReserva(reservaId: string): Promise<{ estado: EstadoReserva }> {
  return pedir<{ estado: EstadoReserva }>(enCentro(`/reservas/${reservaId}/estado`));
}

export function obtenerReserva(reservaId: string, token: string): Promise<Reserva> {
  return pedir<Reserva>(enCentro(`/reservas/${reservaId}`), { token });
}

export type DatosReserva = {
  servicioId: string;
  fecha: string;
  hora: string;
  metodoPago: MetodoPago;
  clienteNombre?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  notas?: string;
};

/**
 * El alta pública, la de una clienta con sesión y la que carga la administradora son el mismo
 * endpoint: cambia el token. Con sesión de clienta, los datos de contacto salen del perfil y
 * pueden omitirse.
 */
export async function crearReserva(datos: DatosReserva, token?: string): Promise<Reserva> {
  // Campo por campo y no un spread: el backend rechaza con 400 cualquier propiedad de más,
  // y `horaFin`, `senaCentavos` y `precioCentavos` los calcula él.
  const cuerpo: Record<string, unknown> = {
    servicioId: datos.servicioId,
    fecha: datos.fecha,
    hora: datos.hora,
    metodoPago: datos.metodoPago,
  };
  if (datos.clienteNombre) cuerpo.clienteNombre = datos.clienteNombre;
  if (datos.clienteEmail) cuerpo.clienteEmail = datos.clienteEmail;
  if (datos.clienteTelefono) cuerpo.clienteTelefono = datos.clienteTelefono;
  if (datos.notas?.trim()) cuerpo.notas = datos.notas.trim();

  // `high_contention` es el único error que se resuelve solo: Postgres abortó la transacción
  // perdedora de un empate y reintentar entra limpio.
  for (let intento = 0; ; intento++) {
    try {
      return await pedir<Reserva>(enCentro('/reservas'), { method: 'POST', body: cuerpo, token });
    } catch (error) {
      const reintentable = error instanceof ErrorApi && error.codigo === 'high_contention';
      if (!reintentable || intento >= 2) throw error;
      await new Promise((listo) => setTimeout(listo, 150 * (intento + 1)));
    }
  }
}
