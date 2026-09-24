import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TenantRequest } from '../common/decorators.js';
import {
  aDate,
  aHora,
  aMinutos,
  ahoraEn,
  demasiadoTarde,
  DIAS_MAX_A_FUTURO,
  diaSemanaISO,
  esFechaReal,
  iniciosDeGrilla,
  ocupacionMaxima,
  sumarDias,
} from '../common/horario.js';
import { capacidadDe } from '../planes/planes.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { reservaViva } from '../reservas/cupo.js';
import type { DisponibilidadDto, SlotDto } from './dto/slot.dto.js';

@Injectable()
export class DisponibilidadService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async find(
    tenant: TenantRequest,
    servicioId: string,
    fecha: string,
  ): Promise<DisponibilidadDto> {
    // Una fecha sintacticamente valida pero imposible ("2026-02-30") pasa la regex del DTO.
    // El chequeo vive en horario.ts porque el alta de reservas necesita el mismo.
    if (!esFechaReal(fecha)) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'El valor de fecha no es una fecha que exista.',
      });
    }

    const ahora = ahoraEn(tenant.zonaHoraria);
    if (fecha > sumarDias(ahora.fecha, DIAS_MAX_A_FUTURO)) {
      throw new BadRequestException({
        code: 'too_far_ahead',
        message: 'Todavia no se puede consultar la agenda de esa fecha.',
      });
    }

    const servicio = await this.db.servicio.findFirst({
      where: { id: servicioId, activo: true },
      select: { duracionMinutos: true },
    });
    // Un solo 404: quien consulta sin token no tiene por que distinguir "no existe" de
    // "esta dado de baja".
    if (!servicio) {
      throw new NotFoundException({
        code: 'servicio_not_found',
        message: 'El tratamiento no esta disponible.',
      });
    }

    const [ventanas, reservas] = await Promise.all([
      this.db.ventanaAtencion.findMany({
        where: { diaSemana: diaSemanaISO(fecha) },
        orderBy: { horaInicio: 'asc' },
      }),
      // Una query para todo el dia; el conteo de solapes se hace en memoria, porque son
      // decenas de filas y no vale una query por horario.
      this.db.reserva.findMany({
        // La misma definicion de "ocupa cupo" que el alta: una reserva impaga que vencio ya
        // no cuenta, aunque la tarea de vencimiento todavia no la haya cancelado.
        where: { fecha: aDate(fecha), ...reservaViva(new Date()) },
        select: { horaInicio: true, horaFin: true },
      }),
    ]);

    const data: SlotDto[] = ventanas
      .flatMap((ventana) =>
        iniciosDeGrilla(ventana, servicio.duracionMinutos).map((hora) => {
          const horaFin = aHora(aMinutos(hora) + servicio.duracionMinutos);
          // La misma funcion que usa el alta: si contaran distinto, la disponibilidad
          // ofreceria horarios que el POST rechaza. `ocupacionMaxima` incluye el turno nuevo,
          // asi que se le resta para obtener la ocupacion actual.
          const ocupados = ocupacionMaxima(reservas, hora, horaFin) - 1;
          return {
            hora,
            // Piso en 0: si la capacidad bajo con reservas ya tomadas, el sobrecupo no se
            // reporta como un numero negativo. La capacidad es la que rige, con el tope del
            // plan, igual que en el alta: un centro que bajo de plan no conserva el doble turno.
            cuposDisponibles: Math.max(
              0,
              capacidadDe(ventana.capacidad, tenant.plan) - ocupados,
            ),
          };
        }),
      )
      // No ofrecer lo que el alta va a rechazar: el front no deberia pintar un horario que
      // explota al reservarlo.
      .filter(({ hora }) => !demasiadoTarde(fecha, hora, ahora))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    return { fecha, data };
  }
}
