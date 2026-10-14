import type { components } from './api';
import { enCentro, pedir, type Pagina, type Reserva, type Servicio } from './cliente';

export type Sesion = components['schemas']['SesionDto'];
export type Ventana = components['schemas']['VentanaAtencionDto'];
export type CuentaMercadoPago = components['schemas']['CuentaMercadoPagoDto'];
export type Suscripcion = components['schemas']['SuscripcionDto'];
export type CrearServicio = components['schemas']['CreateServicioDto'];
export type ActualizarServicio = components['schemas']['UpdateServicioDto'];

export function iniciarSesionAdmin(slug: string, email: string, password: string): Promise<Sesion> {
  return pedir<Sesion>(enCentro(slug, '/sesiones'), { method: 'POST', body: { email, password } });
}

/* ------------------------------------------------------------------ agenda */

export type FiltrosReservas = {
  estado?: string;
  servicioId?: string;
  desde?: string;
  hasta?: string;
  cursor?: string;
};

export function listarReservas(slug: string, token: string, filtros: FiltrosReservas = {}): Promise<Pagina<Reserva>> {
  const query = new URLSearchParams({ limit: '50' });
  for (const [k, v] of Object.entries(filtros)) if (v) query.set(k, v);
  return pedir<Pagina<Reserva>>(enCentro(slug, `/reservas?${query}`), { token });
}

/**
 * Un turno con algo pagado exige decidir el reembolso: sin `reembolsar` da 400. Por eso el
 * parámetro es explícito y no opcional cuando se cancela.
 */
export function cancelarReserva(slug: string, 
  token: string,
  reservaId: string,
  reembolsar: boolean,
): Promise<Reserva> {
  return pedir<Reserva>(enCentro(slug, `/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { estado: 'cancelada', reembolsar },
    token,
  });
}

export function confirmarReserva(slug: string, token: string, reservaId: string): Promise<Reserva> {
  return pedir<Reserva>(enCentro(slug, `/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { estado: 'confirmada' },
    token,
  });
}

/** Solo desde la hora del turno en adelante: antes da `too_early_for_no_show`. */
export function marcarAusente(slug: string, token: string, reservaId: string): Promise<Reserva> {
  return pedir<Reserva>(enCentro(slug, `/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { estado: 'ausente' },
    token,
  });
}

/** La administradora reprograma sin plazo, a diferencia de la clienta. */
export function reprogramarReserva(slug: string, 
  token: string,
  reservaId: string,
  fecha: string,
  hora: string,
): Promise<Reserva> {
  return pedir<Reserva>(enCentro(slug, `/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { fecha, hora },
    token,
  });
}

/* ------------------------------------------------------- ABM de tratamientos */

export function crearServicio(slug: string, token: string, datos: CrearServicio): Promise<Servicio> {
  return pedir<Servicio>(enCentro(slug, '/servicios'), { method: 'POST', body: datos, token });
}

/**
 * Un campo en `null` es un 400, salvo donde `null` significa algo, como
 * `reprogramacionHorasAntes`. Para no tocar un campo, se omite.
 */
export function actualizarServicio(slug: string, 
  token: string,
  servicioId: string,
  datos: ActualizarServicio,
): Promise<Servicio> {
  return pedir<Servicio>(enCentro(slug, `/servicios/${servicioId}`), {
    method: 'PATCH',
    body: datos,
    token,
  });
}

/* --------------------------------------------------------------- franjas */

/** Vienen recortadas al tope del plan: si el centro bajó de plan, el PUT de esto mismo pasa. */
export function obtenerVentanas(slug: string, token: string): Promise<{ data: Ventana[] }> {
  return pedir<{ data: Ventana[] }>(enCentro(slug, '/ventanas-atencion'), { token });
}

/** Reemplaza la semana entera: se manda la colección completa, no una franja. */
export function reemplazarVentanas(slug: string, token: string, ventanas: Ventana[]): Promise<{ data: Ventana[] }> {
  return pedir<{ data: Ventana[] }>(enCentro(slug, '/ventanas-atencion'), {
    method: 'PUT',
    body: { data: ventanas },
    token,
  });
}

/* ------------------------------------------------------- cuenta de cobro */

export function obtenerCuentaMercadoPago(slug: string, token: string): Promise<CuentaMercadoPago> {
  return pedir<CuentaMercadoPago>(enCentro(slug, '/cuenta-mercadopago'), { token });
}

export function urlAutorizacionMercadoPago(slug: string, token: string): Promise<{ url: string }> {
  return pedir<{ url: string }>(enCentro(slug, '/cuenta-mercadopago/autorizacion'), { token });
}

/** `code` y `state` van tal como vinieron: el state va cifrado y vence a los diez minutos. */
export function conectarMercadoPago(slug: string, 
  token: string,
  code: string,
  state: string,
): Promise<CuentaMercadoPago> {
  return pedir<CuentaMercadoPago>(enCentro(slug, '/cuenta-mercadopago'), {
    method: 'POST',
    body: { code, state },
    token,
  });
}

export function desconectarMercadoPago(slug: string, token: string): Promise<void> {
  return pedir<void>(enCentro(slug, '/cuenta-mercadopago'), { method: 'DELETE', token });
}

/* ------------------------------------------------------------ suscripción */

export function obtenerSuscripcion(slug: string, token: string): Promise<Suscripcion> {
  return pedir<Suscripcion>(enCentro(slug, '/suscripcion'), { token });
}

/**
 * Subir al Profesional devuelve `suscripcion.url`: hay que redirigir ahí. El plan rige recién
 * desde el primer cobro aprobado, no desde este PUT.
 */
export function cambiarPlan(slug: string,
  token: string,
  plan: 'basico' | 'profesional',
): Promise<Suscripcion> {
  // Sin emailPagador: el backend usa el de la cuenta de Mercado Pago conectada del centro.
  return pedir<Suscripcion>(enCentro(slug, '/suscripcion'), { method: 'PUT', body: { plan }, token });
}
