import type { components } from './api';

export type Servicio = components['schemas']['ServicioDto'];
export type Slot = components['schemas']['SlotDto'];
export type Disponibilidad = components['schemas']['DisponibilidadDto'];
export type Reserva = components['schemas']['ReservaDto'];
export type MetodoPago = components['schemas']['CreateReservaDto']['metodoPago'];
type CodigoApi = components['schemas']['ErrorDto']['code'];

// El throttler de Nest no usa el contrato de error de la API: devuelve { statusCode, message }
// sin `code`. Y un backend caído no devuelve nada. Los dos casos entran acá con nombre propio
// para que el `switch` de la UI siga siendo exhaustivo.
export type CodigoError = CodigoApi | 'demasiados_intentos' | 'sin_conexion';

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

const SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'lo-de-lili';

function raiz(): string {
  return `${BASE}/tenants/${SLUG}`;
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${raiz()}${ruta}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ErrorApi('sin_conexion', 'No pudimos contactar al servidor. Revisá tu conexión.');
  }

  if (respuesta.ok) return respuesta.json() as Promise<T>;

  if (respuesta.status === 429) {
    throw new ErrorApi(
      'demasiados_intentos',
      'Hiciste varios intentos seguidos. Esperá un minuto y probá de nuevo.',
    );
  }

  const cuerpo: unknown = await respuesta.json().catch(() => null);
  const error = cuerpo as { code?: CodigoApi; message?: string } | null;
  if (error?.code) throw new ErrorApi(error.code, error.message ?? 'Algo salió mal.');

  throw new ErrorApi('sin_conexion', 'El servidor respondió de una forma que no esperábamos.');
}

type Pagina<T> = { data: T[]; nextCursor: string | null };

export async function listarServicios(): Promise<Servicio[]> {
  // El catálogo entero entra en una página; la paginación por cursor importa en el panel.
  const pagina = await pedir<Pagina<Servicio>>('/servicios?limit=100', { cache: 'no-store' });
  return pagina.data;
}

export function obtenerDisponibilidad(servicioId: string, fecha: string): Promise<Disponibilidad> {
  return pedir<Disponibilidad>(
    `/servicios/${servicioId}/disponibilidad?fecha=${fecha}`,
    { cache: 'no-store' },
  );
}

export type DatosReserva = {
  servicioId: string;
  fecha: string;
  hora: string;
  metodoPago: MetodoPago;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  notas?: string;
};

export async function crearReserva(datos: DatosReserva): Promise<Reserva> {
  // Campo por campo y no un spread: el backend rechaza con 400 cualquier propiedad de más,
  // y `horaFin` y `senaCentavos` los calcula él.
  const cuerpo: components['schemas']['CreateReservaDto'] = {
    servicioId: datos.servicioId,
    fecha: datos.fecha,
    hora: datos.hora,
    metodoPago: datos.metodoPago,
    clienteNombre: datos.clienteNombre,
    clienteEmail: datos.clienteEmail,
    clienteTelefono: datos.clienteTelefono,
    ...(datos.notas ? { notas: datos.notas } : {}),
  };

  // `high_contention` es el único error que se resuelve solo: Postgres abortó la transacción
  // perdedora de un empate y reintentar entra limpio.
  for (let intento = 0; ; intento++) {
    try {
      return await pedir<Reserva>('/reservas', {
        method: 'POST',
        body: JSON.stringify(cuerpo),
        cache: 'no-store',
      });
    } catch (error) {
      const reintentable = error instanceof ErrorApi && error.codigo === 'high_contention';
      if (!reintentable || intento >= 2) throw error;
      await new Promise((listo) => setTimeout(listo, 150 * (intento + 1)));
    }
  }
}
