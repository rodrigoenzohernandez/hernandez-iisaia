import type { components } from './api';
import { enCentro, pedir, type Pagina, type Reserva } from './cliente';

export type Cliente = components['schemas']['ClienteDto'];
export type SesionCliente = components['schemas']['SesionClienteDto'];

/**
 * Devuelve 202 exista o no la cuenta: decir cuáles existen publicaría qué emails tienen turnos.
 * Hasta tres códigos por email cada quince minutos y diez por día.
 */
export function pedirCodigo(email: string): Promise<{ expiraEnMinutos: number }> {
  return pedir<{ expiraEnMinutos: number }>(enCentro('/clientes/codigos'), {
    method: 'POST',
    body: { email },
  });
}

/**
 * La cuenta nace sola la primera vez. Cualquier falla —código equivocado, vencido, ya usado o
 * con los cinco intentos agotados— vuelve como el mismo `invalid_code`.
 */
export function iniciarSesionClienta(email: string, codigo: string): Promise<SesionCliente> {
  return pedir<SesionCliente>(enCentro('/clientes/sesiones'), {
    method: 'POST',
    body: { email, codigo },
  });
}

export function miPerfil(token: string): Promise<Cliente> {
  return pedir<Cliente>(enCentro('/clientes/me'), { token });
}

/** El email no se cambia: es la identidad de la cuenta. */
export function actualizarPerfil(
  token: string,
  datos: { nombre?: string; telefono?: string },
): Promise<Cliente> {
  return pedir<Cliente>(enCentro('/clientes/me'), { method: 'PATCH', body: datos, token });
}

/** Trae también los turnos que reservó sin cuenta con ese mismo email. */
export function misReservas(
  token: string,
  filtros: { estado?: string; desde?: string; cursor?: string } = {},
): Promise<Pagina<Reserva>> {
  const query = new URLSearchParams({ limit: '50' });
  if (filtros.estado) query.set('estado', filtros.estado);
  if (filtros.desde) query.set('desde', filtros.desde);
  if (filtros.cursor) query.set('cursor', filtros.cursor);
  return pedir<Pagina<Reserva>>(enCentro(`/clientes/me/reservas?${query}`), { token });
}

/**
 * En plazo devuelve el 100% de lo pagado; fuera de plazo, nada. Lo decide la política del
 * tratamiento, así que mandar `reembolsar` desde la clienta da 400.
 */
export function cancelarMiReserva(token: string, reservaId: string): Promise<Reserva> {
  return pedir<Reserva>(enCentro(`/reservas/${reservaId}`), {
    method: 'PATCH',
    body: { estado: 'cancelada' },
    token,
  });
}

/** Solo un turno confirmado y en plazo. Fuera de plazo da `reschedule_not_allowed`. */
export function reprogramarMiReserva(
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
