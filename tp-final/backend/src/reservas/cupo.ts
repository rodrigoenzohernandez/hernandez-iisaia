import { ConflictException } from '@nestjs/common';
import {
  aDate,
  diaSemanaISO,
  ocupacionMaxima,
  ventanaDe,
} from '../common/horario.js';
import type { Tx } from '../prisma/prisma.module.js';

/**
 * Las reservas que ocupan cupo: las confirmadas, y las pendientes cuyo pago todavia no
 * vencio. Una reserva impaga deja de contar sola al vencer, asi que si la tarea de
 * vencimiento se cae, los cupos igual se liberan.
 *
 * Es la unica definicion, y la usan el alta, la reprogramacion, la reactivacion de un pago
 * tardio y la disponibilidad: si contaran distinto, la agenda ofreceria horarios que el alta
 * rechaza.
 */
export const reservaViva = (ahora: Date) => ({
  OR: [
    { estado: 'confirmada' as const },
    {
      estado: 'pendiente' as const,
      OR: [{ pagoVenceAt: null }, { pagoVenceAt: { gt: ahora } }],
    },
  ],
});

export type Turno = {
  fecha: string;
  hora: string;
  horaFin: string;
  duracionMinutos: number;
  /** La propia reserva, cuando se reprograma o se reactiva: no compite consigo misma. */
  excluirId?: string;
  /** Para detectar el doble submit del mismo email en el mismo horario. */
  email?: string;
  /** El tope del plan del centro, si es menor que la capacidad de la franja. */
  capacidadMaxima?: number;
};

/**
 * Exige que el turno entre en la agenda y tenga cupo. Va DENTRO de la transaccion
 * SERIALIZABLE de quien llama.
 */
export async function exigirCupo(tx: Tx, t: Turno): Promise<void> {
  // Leer las franjas DENTRO de la transaccion es lo que hace que un PUT de horarios
  // concurrente conflictue con este alta en vez de pisarla.
  const ventanas = await tx.ventanaAtencion.findMany({
    where: { diaSemana: diaSemanaISO(t.fecha) },
  });
  const ventana = ventanaDe(ventanas, t.hora, t.duracionMinutos);
  if (!ventana) {
    throw new ConflictException({
      code: 'outside_business_hours',
      message: 'Ese horario no esta dentro de la agenda de atencion.',
    });
  }

  // Ocupacion simultanea: toda reserva viva que se pise con [hora, horaFin).
  const solapadas = await tx.reserva.findMany({
    where: {
      fecha: aDate(t.fecha),
      horaInicio: { lt: t.horaFin },
      horaFin: { gt: t.hora },
      ...reservaViva(new Date()),
      ...(t.excluirId ? { id: { not: t.excluirId } } : {}),
    },
    select: { horaInicio: true, horaFin: true, clienteEmail: true },
  });

  // La misma funcion que usa la disponibilidad: contar cuantas reservas PISAN el turno
  // nuevo no es lo mismo que cuantas hay A LA VEZ, porque dos que lo pisan en momentos
  // distintos suman 2 sin que nunca haya 2 simultaneas. ocupacionMaxima ya incluye el turno
  // nuevo.
  const capacidad = Math.min(ventana.capacidad, t.capacidadMaxima ?? Infinity);
  const sinCupo = ocupacionMaxima(solapadas, t.hora, t.horaFin) > capacidad;
  // Doble submit del formulario publico: con capacidad mayor a 1 entraban dos reservas
  // identicas de la misma persona.
  const duplicada =
    t.email !== undefined &&
    solapadas.some(
      (r) => r.horaInicio === t.hora && r.clienteEmail === t.email,
    );
  // Un solo codigo para los dos casos: uno distinto para el duplicado dejaba averiguar, sin
  // token, si un email dado tiene turno a una hora dada.
  if (sinCupo || duplicada) {
    throw new ConflictException({
      code: 'slot_full',
      message: 'Ese horario ya no tiene cupo. Elegi otro.',
    });
  }
}
