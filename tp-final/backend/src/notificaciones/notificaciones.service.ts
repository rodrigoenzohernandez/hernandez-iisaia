import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DB, type Db, type Tx } from '../prisma/prisma.module.js';
import { EMAIL_SENDER, type EmailSender } from './email.js';
import type { Plantilla } from './plantillas.js';

const MAX_INTENTOS = 6;
/** Espera despues de cada intento fallido: 1, 5 y 30 minutos, 2 y 6 horas. */
const ESPERAS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000];
/**
 * Cuanto se corre la fila al tomarla. Si el proceso muere en medio del envio, la fila vuelve
 * a estar disponible despues de esto y otro despachador la retoma.
 */
const LEASE_MS = 5 * 60_000;
const LOTE = 20;

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger('Notificaciones');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
  ) {}

  /**
   * Encola un mail. Recibe el cliente de la transaccion de quien llama: la fila nace y muere
   * con el cambio que la origina, y un reintento de esa transaccion no la duplica.
   *
   * Con `venceAt`, despues de esa hora el mail no sale y la fila se borra: es para lo que
   * lleva un secreto que vence, como el codigo de ingreso.
   */
  async encolar(
    tx: Tx,
    para: string,
    plantilla: Plantilla,
    venceAt?: Date,
  ): Promise<void> {
    await tx.notificacion.create({
      data: {
        para,
        asunto: plantilla.asunto,
        html: plantilla.html,
        texto: plantilla.texto,
        venceAt: venceAt ?? null,
      } as Prisma.NotificacionUncheckedCreateInput,
      select: { id: true },
    });
  }

  /** El mismo mail para cada administradora del centro. */
  async encolarAlCentro(tx: Tx, plantilla: Plantilla): Promise<void> {
    const admins = await tx.usuario.findMany({ select: { email: true } });
    for (const { email } of admins) await this.encolar(tx, email, plantilla);
  }

  /**
   * Manda lo pendiente del centro en contexto sin hacer esperar a quien llama. Se usa despues
   * del commit: el mail sale en el acto y, si falla, la tarea periodica lo reintenta.
   */
  despacharAhora(): void {
    this.despacharPendientes().catch((e: unknown) =>
      this.logger.error(`No se pudo despachar: ${String(e)}`),
    );
  }

  /**
   * Borra los mails vencidos: un codigo de ingreso en claro no queda en la base mas alla de su
   * vencimiento. Lo corre la tarea periodica; el despacho, por su lado, nunca manda uno vencido.
   */
  async borrarVencidas(): Promise<void> {
    await this.db.notificacion.deleteMany({
      where: { venceAt: { lte: new Date() } },
    });
  }

  async despacharPendientes(): Promise<void> {
    const pendientes = await this.db.notificacion.findMany({
      where: { estado: 'pendiente', proximoIntentoAt: { lte: new Date() } },
      orderBy: { proximoIntentoAt: 'asc' },
      take: LOTE,
      select: { id: true },
    });
    for (const { id } of pendientes) await this.enviar(id);
  }

  private async enviar(id: string): Promise<void> {
    const ahora = new Date();
    // Tomarla es un UPDATE condicional y no leer y despues escribir: el despacho de la
    // request y el de la tarea periodica pueden cruzarse, y solo uno gana la fila. Un mail
    // vencido no se toma: lo borra la tarea.
    const [n] = await this.db.notificacion.updateManyAndReturn({
      where: {
        id,
        estado: 'pendiente',
        proximoIntentoAt: { lte: ahora },
        OR: [{ venceAt: null }, { venceAt: { gt: ahora } }],
      },
      data: { proximoIntentoAt: new Date(ahora.getTime() + LEASE_MS) },
    });
    if (!n) return;

    try {
      const { id: proveedorId } = await this.sender.send({
        to: n.para,
        subject: n.asunto,
        html: n.html,
        text: n.texto,
        idempotencyKey: n.id,
      });
      await this.db.notificacion.update({
        where: { id },
        data: {
          estado: 'enviada',
          enviadaAt: new Date(),
          proveedorId,
          intentos: n.intentos + 1,
          ultimoError: null,
        },
      });
    } catch (e) {
      const intentos = n.intentos + 1;
      this.logger.warn(
        `No salio el mail ${id}, intento ${intentos}: ${String(e)}`,
      );
      await this.db.notificacion.update({
        where: { id },
        data: {
          intentos,
          ultimoError: String(e).slice(0, 500),
          estado: intentos >= MAX_INTENTOS ? 'fallida' : 'pendiente',
          proximoIntentoAt: new Date(
            Date.now() + (ESPERAS_MS[intentos - 1] ?? 0),
          ),
        },
      });
    }
  }
}
