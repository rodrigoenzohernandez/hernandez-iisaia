import type { components } from './api';
import { enCentro, pedir, type Pagina, type Reserva, type Servicio } from './cliente';

export type Sesion = components['schemas']['SesionDto'];
export type Ventana = components['schemas']['VentanaAtencionDto'];
export type CuentaMercadoPago = components['schemas']['CuentaMercadoPagoDto'];
export type Suscripcion = components['schemas']['SuscripcionDto'];
export type CrearServicio = components['schemas']['CreateServicioDto'];
export type ActualizarServicio = components['schemas']['UpdateServicioDto'];

export function iniciarSesionAdmin(email: string, password: string): Promise<Sesion> {
  return pedir<Sesion>(enCentro('/sesiones'), { method: 'POST', body: { email, password } });
}

/* ------------------------------------------------------------------ agenda */

export type FiltrosReservas = {
  estado?: string;
  servicioId?: string;
  desde?: string;
  hasta?: string;
  cursor?: string;
};

export function listarReservas(token: string, filtros: FiltrosReservas = {}): Promise<Pagina<Reserva>> {
  const query = new URLSearchParams({ limit: '50' });
  for (const [k, v] of Object.entries(filtros)) if (v) query.set(k, v);
  return pedir<Pagina<Reserva>>(enCentro(`/reservas?${query}`), { token });
}

/**
 * Un turno con algo pagado exige decidir el reembolso: sin `reembolsar` da 400. Por eso el
 * parámetro es explícito y no opcional cuando se cancela.
 */
export function cancelarReserva(
  token: string,
  reservaId: string,
  reembolsar: boolean,
): Promise<Reserva> {
  return pedir<Reserva>(enCentro(`/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { estado: 'cancelada', reembolsar },
    token,
  });
}

export function confirmarReserva(token: string, reservaId: string): Promise<Reserva> {
  return pedir<Reserva>(enCentro(`/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { estado: 'confirmada' },
    token,
  });
}

/** Solo desde la hora del turno en adelante: antes da `too_early_for_no_show`. */
export function marcarAusente(token: string, reservaId: string): Promise<Reserva> {
  return pedir<Reserva>(enCentro(`/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { estado: 'ausente' },
    token,
  });
}

/** La administradora reprograma sin plazo, a diferencia de la clienta. */
export function reprogramarReserva(
  token: string,
  reservaId: string,
  fecha: string,
  hora: string,
): Promise<Reserva> {
  return pedir<Reserva>(enCentro(`/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { fecha, hora },
    token,
  });
}

/* ------------------------------------------------------- ABM de tratamientos */

export function crearServicio(token: string, datos: CrearServicio): Promise<Servicio> {
  return pedir<Servicio>(enCentro('/servicios'), { method: 'POST', body: datos, token });
}

/**
 * Un campo en `null` es un 400, salvo donde `null` significa algo, como
 * `reprogramacionHorasAntes`. Para no tocar un campo, se omite.
 */
export function actualizarServicio(
  token: string,
  servicioId: string,
  datos: ActualizarServicio,
): Promise<Servicio> {
  return pedir<Servicio>(enCentro(`/servicios/${servicioId}`), {
    method: 'PATCH',
    body: datos,
    token,
  });
}

/* --------------------------------------------------------------- franjas */

/** Vienen recortadas al tope del plan: si el centro bajó de plan, el PUT de esto mismo pasa. */
export function obtenerVentanas(token: string): Promise<{ data: Ventana[] }> {
  return pedir<{ data: Ventana[] }>(enCentro('/ventanas-atencion'), { token });
}

/** Reemplaza la semana entera: se manda la colección completa, no una franja. */
export function reemplazarVentanas(token: string, ventanas: Ventana[]): Promise<{ data: Ventana[] }> {
  return pedir<{ data: Ventana[] }>(enCentro('/ventanas-atencion'), {
    method: 'PUT',
    body: { data: ventanas },
    token,
  });
}

/* ------------------------------------------------------- cuenta de cobro */

export function obtenerCuentaMercadoPago(token: string): Promise<CuentaMercadoPago> {
  return pedir<CuentaMercadoPago>(enCentro('/cuenta-mercadopago'), { token });
}

export function urlAutorizacionMercadoPago(token: string): Promise<{ url: string }> {
  return pedir<{ url: string }>(enCentro('/cuenta-mercadopago/autorizacion'), { token });
}

/** `code` y `state` van tal como vinieron: el state va cifrado y vence a los diez minutos. */
export function conectarMercadoPago(
  token: string,
  code: string,
  state: string,
): Promise<CuentaMercadoPago> {
  return pedir<CuentaMercadoPago>(enCentro('/cuenta-mercadopago'), {
    method: 'POST',
    body: { code, state },
    token,
  });
}

export function desconectarMercadoPago(token: string): Promise<void> {
  return pedir<void>(enCentro('/cuenta-mercadopago'), { method: 'DELETE', token });
}

/* ------------------------------------------------------------ suscripción */

export function obtenerSuscripcion(token: string): Promise<Suscripcion> {
  return pedir<Suscripcion>(enCentro('/suscripcion'), { token });
}

/**
 * Subir al Profesional devuelve `suscripcion.url`: hay que redirigir ahí. El plan rige recién
 * desde el primer cobro aprobado, no desde este PUT.
 */
export function cambiarPlan(
  token: string,
  plan: 'basico' | 'profesional',
  emailPagador?: string,
): Promise<Suscripcion> {
  return pedir<Suscripcion>(enCentro('/suscripcion'), {
    method: 'PUT',
    body: emailPagador ? { plan, emailPagador } : { plan },
    token,
  });
}
