import { Inject, Injectable } from '@nestjs/common';
import {
  aDate,
  aFecha,
  ahoraEn,
  minutosHasta,
  sumarDias,
} from '../common/horario.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { recordatorio } from '../notificaciones/plantillas.js';
import { DB, type Db } from '../prisma/prisma.module.js';

/** Con cuanta anticipacion sale el recordatorio. */
export const RECORDATORIO_MINUTOS = 24 * 60;

@Injectable()
export class RecordatoriosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Encola el recordatorio de cada turno confirmado del centro que empieza en menos de 24 h. */
  async enviar(centro: { nombre: string; zonaHoraria: string }): Promise<void> {
    const ahora = ahoraEn(centro.zonaHoraria);
    const candidatas = await this.db.reserva.findMany({
      where: {
        estado: 'confirmada',
        recordatorioEnviadoAt: null,
        // Hoy y maniana alcanzan para cubrir 24 horas; el filtro fino es en memoria.
        fecha: {
          gte: aDate(ahora.fecha),
          lte: aDate(sumarDias(ahora.fecha, 1)),
        },
      },
      select: {
        id: true,
        fecha: true,
        horaInicio: true,
        clienteNombre: true,
        clienteEmail: true,
        servicio: { select: { nombre: true } },
      },
    });

    for (const r of candidatas) {
      const faltan = minutosHasta(aFecha(r.fecha), r.horaInicio, ahora);
      if (faltan <= 0 || faltan > RECORDATORIO_MINUTOS) continue;
      await this.db.$transaction(async (tx) => {
        // Marcar y encolar juntos, y marcar con un UPDATE condicional: una segunda corrida,
        // o una segunda instancia, no encola el mismo recordatorio dos veces.
        const { count } = await tx.reserva.updateMany({
          where: { id: r.id, recordatorioEnviadoAt: null },
          data: { recordatorioEnviadoAt: new Date() },
        });
        if (count === 0) return;
        await this.notificaciones.encolar(
          tx,
          r.clienteEmail,
          recordatorio({
            centro: centro.nombre,
            clienteNombre: r.clienteNombre,
            servicio: r.servicio.nombre,
            fecha: aFecha(r.fecha),
            hora: r.horaInicio,
          }),
        );
      });
    }
    if (candidatas.length > 0) this.notificaciones.despacharAhora();
  }
}
