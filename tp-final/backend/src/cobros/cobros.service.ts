import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { EstadoPago, Prisma } from '@prisma/client';
import type { TenantRequest } from '../common/decorators.js';
import { aFecha, ahoraEn, minutosHasta } from '../common/horario.js';
import {
  type MercadoPago,
  MercadoPagoError,
  type Payment,
  type PaymentStatus,
} from '../lib/mercadopago/index.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import {
  avisoTurnoNuevo,
  datosDelTurno,
  fechaLarga,
  pagoDevuelto,
  reembolsoManual,
  turnoConfirmado,
  turnoDe,
  turnoVencido,
} from '../notificaciones/plantillas.js';
import { DB, type Db, type Tx } from '../prisma/prisma.module.js';
import { runSerializable } from '../prisma/run-serializable.js';
import { exigirCupo, exigirTopeDelMes } from '../reservas/cupo.js';
import { CuentasMercadoPagoService } from './cuentas-mercadopago.service.js';

/** Cuanto espera el cupo a que se pague. Despues, la reserva deja de contar y vence. */
export const MINUTOS_PARA_PAGAR = 20;

const ESTADOS: Record<PaymentStatus, EstadoPago> = {
  approved: 'aprobado',
  pending: 'pendiente',
  rejected: 'rechazado',
  cancelled: 'cancelado',
  refunded: 'reembolsado',
  charged_back: 'contracargo',
  disputed: 'disputa',
};

const MAX_INTENTOS = 7;
/** Espera despues de cada intento fallido: 1, 5 y 30 minutos, 2, 6 y 24 horas. */
const ESPERAS_MS = [
  60_000, 300_000, 1_800_000, 7_200_000, 21_600_000, 86_400_000,
];
const LEASE_MS = 5 * 60_000;

/** Lo que se lee de la reserva de un pago: los datos del mail, y lo que pide el aviso al centro. */
const delTurno = {
  ...datosDelTurno,
  horaFin: true,
  clienteTelefono: true,
  notas: true,
} as const;

/** La reserva que el sistema cancela: vencio sin pagarse, o el pago llego y no la confirma. */
const canceladaPorSistema = () => ({
  estado: 'cancelada' as const,
  canceladaPor: 'sistema' as const,
  canceladaAt: new Date(),
});

/** El centro del que se procesan los reembolsos. */
type Centro = { slug: string; nombre: string };

/** El descriptor del resumen de la tarjeta: MP acepta letras, numeros y espacios. */
const descriptor = (nombre: string): string =>
  nombre
    .normalize('NFD')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase();

@Injectable()
export class CobrosService {
  private readonly logger = new Logger('Cobros');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cuentas: CuentasMercadoPagoService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /**
   * Crea el link de pago de una reserva recien creada y lo guarda en ella.
   *
   * Va DESPUES del commit del alta, nunca adentro: una transaccion no se mantiene abierta
   * durante una llamada de red, y un reintento de SERIALIZABLE repetiria la llamada. Si MP
   * falla, la reserva se cancela: no queda un cupo retenido sin forma de pagarlo.
   */
  async iniciarCobro(
    tenant: TenantRequest,
    mp: MercadoPago,
    reserva: {
      id: string;
      montoOnlineCentavos: number;
      pagoVenceAt: Date;
      clienteNombre: string;
      clienteEmail: string;
      servicio: string;
      fecha: string;
      hora: string;
      esSena: boolean;
    },
  ): Promise<{ checkoutId: string; checkoutUrl: string }> {
    // El checklist de calidad de MP pide nombre, apellido y descripcion: suben la tasa de
    // aprobacion. La reserva guarda el nombre completo en un solo campo, asi que la primera
    // palabra va de nombre y el resto de apellido; es lo que mira el antifraude.
    const [nombre, ...apellido] = reserva.clienteNombre.trim().split(/\s+/);
    try {
      const checkout = await mp.createCheckout({
        reference: reserva.id,
        title: reserva.esSena ? `${reserva.servicio} (seña)` : reserva.servicio,
        description: `Turno en ${tenant.nombre}: ${fechaLarga(reserva.fecha)} a las ${reserva.hora}`,
        amountCents: reserva.montoOnlineCentavos,
        payerEmail: reserva.clienteEmail,
        payerFirstName: nombre,
        payerLastName: apellido.join(' ') || undefined,
        expiresAt: reserva.pagoVenceAt,
        backUrls: this.cuentas.urlsDeVuelta(tenant.slug, reserva.id),
        onlyInstantMethods: true,
        statementDescriptor: descriptor(tenant.nombre),
        idempotencyKey: `checkout-${reserva.id}`,
      });
      await this.db.reserva.update({
        where: { id: reserva.id },
        data: { checkoutId: checkout.id, checkoutUrl: checkout.url },
      });
      return { checkoutId: checkout.id, checkoutUrl: checkout.url };
    } catch (e) {
      await this.db.reserva.update({
        where: { id: reserva.id },
        data: canceladaPorSistema(),
      });
      // Un 401 al crear el cobro es que MP revoco el acceso de la cuenta.
      if (e instanceof MercadoPagoError && e.status === 401) {
        await this.cuentas.marcarReconexion(tenant);
      }
      this.logger.error(
        `Sin checkout para la reserva ${reserva.id}: ${String(e)}`,
      );
      throw new BadGatewayException({
        code: 'payment_provider_unavailable',
        message:
          'No pudimos iniciar el pago con Mercado Pago. Proba de nuevo en unos minutos.',
      });
    }
  }

  /** Procesa un pago que MP aviso. Llega ya consultado a MP con el token del centro. */
  async registrarPago(tenant: TenantRequest, pago: Payment): Promise<void> {
    // El re-fetch con el token del centro ya garantiza que el pago es de esta cuenta; esto lo
    // cierra por si el token viera pagos de otras.
    const cuenta = await this.db.cuentaMercadoPago.findFirst({
      select: { mpUserId: true },
    });
    if (!pago.reference || !cuenta || pago.collectorId !== cuenta.mpUserId) {
      return;
    }
    // SERIALIZABLE: dos avisos del mismo pago, o dos pagos de la misma reserva, no deciden en
    // paralelo.
    const decidido = await runSerializable(this.db, (tx) =>
      this.decidir(tx, tenant, pago),
    );
    // Las colas se despiertan solo si la decision encolo algo: un reembolso o un mail.
    if (decidido) {
      this.procesarReembolsosAhora(tenant);
      this.notificaciones.despacharAhora();
    }
  }

  /** Registra el pago y, si es la primera vez que llega aprobado, decide. true si decidio. */
  private async decidir(
    tx: Tx,
    tenant: TenantRequest,
    pago: Payment,
  ): Promise<boolean> {
    const anterior = await tx.pago.findFirst({
      where: { proveedorId: pago.id },
      select: {
        id: true,
        decididoAt: true,
        estado: true,
        estadoDetalle: true,
        reembolsadoCentavos: true,
      },
    });
    // Se decide una sola vez: la primera vez que llega aprobado. Un aviso repetido, o un pago
    // que vuelve a aprobado despues de una disputa ganada, solo actualiza el estado; mirar el
    // estado guardado no alcanza, porque cada aviso lo pisa con el de MP.
    const decidirAhora = pago.status === 'approved' && !anterior?.decididoAt;
    const datos = {
      estado: ESTADOS[pago.status],
      estadoDetalle: pago.statusDetail,
      montoCentavos: pago.amountCents,
      reembolsadoCentavos: pago.refundedCents,
      medio: pago.method,
      aprobadoAt: pago.approvedAt,
      ...(decidirAhora ? { decididoAt: new Date() } : {}),
    };
    // MP manda varios avisos por pago y la mayoria no trae nada nuevo: un pago ya registrado
    // que no hay que decidir solo se actualiza, y solo si cambio. Sin leer la reserva, que no
    // entra en conflicto con quien la este cancelando.
    if (anterior && !decidirAhora) {
      if (
        anterior.estado !== datos.estado ||
        anterior.estadoDetalle !== datos.estadoDetalle ||
        anterior.reembolsadoCentavos !== datos.reembolsadoCentavos
      ) {
        await tx.pago.update({ where: { id: anterior.id }, data: datos });
      }
      return false;
    }

    const reserva = await tx.reserva.findFirst({
      where: { id: pago.reference! },
      select: {
        id: true,
        estado: true,
        canceladaPor: true,
        montoOnlineCentavos: true,
        pagoVenceAt: true,
        ...delTurno,
      },
    });
    if (!reserva) return false;

    const fila = anterior
      ? await tx.pago.update({
          where: { id: anterior.id },
          data: datos,
          select: { id: true },
        })
      : await tx.pago.create({
          data: {
            ...datos,
            reservaId: reserva.id,
            proveedorId: pago.id,
          } as Prisma.PagoUncheckedCreateInput,
          select: { id: true },
        });

    if (!decidirAhora) return false;

    const turno = turnoDe(tenant.nombre, reserva);
    const devolver = async (): Promise<void> => {
      await tx.reembolso.create({
        data: {
          pagoId: fila.id,
          montoCentavos: pago.amountCents,
        } as Prisma.ReembolsoUncheckedCreateInput,
      });
      await this.notificaciones.encolar(
        tx,
        reserva.clienteEmail,
        pagoDevuelto({ ...turno, montoCentavos: pago.amountCents }),
      );
    };
    const confirmar = async (): Promise<void> => {
      await tx.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'confirmada', canceladaPor: null, canceladaAt: null },
      });
      await this.notificaciones.encolar(
        tx,
        reserva.clienteEmail,
        turnoConfirmado({ ...turno, pagadoCentavos: pago.amountCents }),
      );
      await this.notificaciones.encolarAlCentro(
        tx,
        avisoTurnoNuevo({
          ...turno,
          clienteEmail: reserva.clienteEmail,
          clienteTelefono: reserva.clienteTelefono,
          notas: reserva.notas,
        }),
      );
    };

    // La reserva que esperaba este pago no se confirma: se cancela, si seguia pendiente, y lo
    // pagado se devuelve.
    const cancelarYDevolver = async (): Promise<void> => {
      if (reserva.estado === 'pendiente') {
        await tx.reserva.update({
          where: { id: reserva.id },
          data: canceladaPorSistema(),
        });
      }
      return devolver();
    };

    // La decision, con sus tres salidas. Una funcion para poder salir con return en cada
    // rama y avisar despues que se decidio.
    const decision = async (): Promise<void> => {
      // Un centro dado de baja no toma turnos: lo que entre despues de la baja se devuelve.
      if (!tenant.activo) return cancelarYDevolver();

      const vencida =
        (reserva.estado === 'cancelada' &&
          reserva.canceladaPor === 'sistema') ||
        (reserva.estado === 'pendiente' &&
          !!reserva.pagoVenceAt &&
          reserva.pagoVenceAt <= new Date());

      if (reserva.estado === 'pendiente' && !vencida) {
        // Con Checkout Pro el monto lo fija la preferencia: uno distinto es una anomalia, y un
        // pago que no confirma nada se devuelve.
        if (pago.amountCents < reserva.montoOnlineCentavos) return devolver();
        return confirmar();
      }
      if (vencida) {
        // Un aviso que llega tarde, despues de la hora del turno, no reactiva nada.
        const ahora = ahoraEn(tenant.zonaHoraria);
        if (
          minutosHasta(aFecha(reserva.fecha), reserva.horaInicio, ahora) <= 0
        ) {
          return cancelarYDevolver();
        }
        // Vencio sin pagarse y el pago llego igual: si el horario sigue libre se reactiva, y
        // si ya lo tomo otra persona se devuelve. Mientras estuvo vencida no contaba para el
        // cupo, asi que hay que volver a pedirlo.
        try {
          await exigirTopeDelMes(tx, aFecha(reserva.fecha), tenant.plan);
          await exigirCupo(tx, {
            fecha: aFecha(reserva.fecha),
            hora: reserva.horaInicio,
            horaFin: reserva.horaFin,
            excluirId: reserva.id,
            plan: tenant.plan,
          });
        } catch (e) {
          if (!(e instanceof ConflictException)) throw e;
          return cancelarYDevolver();
        }
        return confirmar();
      }
      // Ya estaba confirmada (este pago sobra), o la cancelo la clienta o el centro, o no vino.
      return devolver();
    };
    await decision();
    return true;
  }

  /** Lo que se pago y sigue aprobado en una reserva. */
  async pagado(tx: Tx, reservaId: string): Promise<number> {
    const pagos = await tx.pago.findMany({
      where: { reservaId, estado: 'aprobado' },
      select: { montoCentavos: true },
    });
    return pagos.reduce((suma, p) => suma + p.montoCentavos, 0);
  }

  /**
   * Pide el reembolso de todo lo pagado online de una reserva. Va DENTRO de la transaccion de
   * la cancelacion: la fila nace con ella, y el pedido a MP sale despues. Devuelve el monto.
   */
  async reembolsarTodo(tx: Tx, reservaId: string): Promise<number> {
    const pagos = await tx.pago.findMany({
      where: { reservaId, estado: 'aprobado' },
      select: {
        id: true,
        montoCentavos: true,
        reembolsos: {
          where: { estado: { not: 'fallido' } },
          select: { montoCentavos: true },
        },
      },
    });
    let total = 0;
    for (const p of pagos) {
      const yaPedido = p.reembolsos.reduce((s, r) => s + r.montoCentavos, 0);
      const monto = p.montoCentavos - yaPedido;
      if (monto <= 0) continue;
      await tx.reembolso.create({
        data: {
          pagoId: p.id,
          montoCentavos: monto,
        } as Prisma.ReembolsoUncheckedCreateInput,
      });
      total += monto;
    }
    return total;
  }

  /** Procesa los reembolsos pendientes del centro en contexto sin hacer esperar a quien llama. */
  procesarReembolsosAhora(centro: Centro): void {
    this.procesarReembolsos(centro).catch((e: unknown) =>
      this.logger.error(`No se pudieron procesar reembolsos: ${String(e)}`),
    );
  }

  async procesarReembolsos(centro: Centro): Promise<void> {
    const pendientes = await this.db.reembolso.findMany({
      where: { estado: 'pendiente', proximoIntentoAt: { lte: new Date() } },
      orderBy: { proximoIntentoAt: 'asc' },
      take: 20,
      select: { id: true },
    });
    if (pendientes.length === 0) return;
    // Devolver es saldar lo ya cobrado: con la cuenta que haya, aunque espere reconexion,
    // porque el token puede seguir sirviendo.
    const mp = await this.cuentas.paraSaldar(centro.slug);
    for (const { id } of pendientes) await this.reembolsar(id, mp, centro);
    this.notificaciones.despacharAhora();
  }

  private async reembolsar(
    id: string,
    mp: MercadoPago | null,
    centro: Centro,
  ): Promise<void> {
    const ahora = new Date();
    // Tomarlo con un UPDATE condicional: el pedido inmediato y la tarea periodica pueden
    // cruzarse, y solo uno lo manda.
    const { count } = await this.db.reembolso.updateMany({
      where: { id, estado: 'pendiente', proximoIntentoAt: { lte: ahora } },
      data: { proximoIntentoAt: new Date(ahora.getTime() + LEASE_MS) },
    });
    if (count === 0) return;

    const r = await this.db.reembolso.findFirstOrThrow({
      where: { id },
      select: {
        montoCentavos: true,
        intentos: true,
        pago: {
          select: {
            id: true,
            proveedorId: true,
            reserva: { select: datosDelTurno },
          },
        },
      },
    });
    let hecho: { id: string };
    try {
      if (!mp) {
        // Sin cuenta: se reintenta, por si la conectan.
        throw new MercadoPagoError(
          'El centro no tiene la cuenta de Mercado Pago conectada',
          0,
          true,
        );
      }
      // La idempotency key es el id de la fila: reintentar un pedido que no se sabe si salio
      // nunca reembolsa dos veces.
      const pedido = await mp.refund(r.pago.proveedorId, {
        amountCents: r.montoCentavos,
        idempotencyKey: id,
      });
      // MP puede aceptar el pedido y rechazar el reembolso: eso no se reintenta, lo resuelve
      // el centro.
      if (pedido.status === 'rejected' || pedido.status === 'cancelled') {
        throw new MercadoPagoError(
          `Mercado Pago rechazo el reembolso (${pedido.status})`,
          0,
          false,
        );
      }
      hecho = pedido;
    } catch (e) {
      const intentos = r.intentos + 1;
      // Definitivo es lo que MP no va a aceptar aunque se reintente: un 401 por el scope de
      // reembolsos de OAuth (issue #419), un pago de mas de 180 dias, un estado invalido.
      const definitivo =
        (e instanceof MercadoPagoError && !e.retryable) ||
        intentos >= MAX_INTENTOS;
      const motivo = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Reembolso ${id}, intento ${intentos}: ${motivo}`);
      await this.db.$transaction(async (tx) => {
        await tx.reembolso.update({
          where: { id },
          data: {
            intentos,
            ultimoError: motivo.slice(0, 500),
            estado: definitivo ? 'fallido' : 'pendiente',
            proximoIntentoAt: new Date(
              Date.now() + (ESPERAS_MS[intentos - 1] ?? 0),
            ),
          },
        });
        // Ningun reembolso se pierde en silencio: o sale, o el centro recibe un mail que dice
        // que no salio y como hacerlo a mano.
        if (definitivo) {
          await this.notificaciones.encolarAlCentro(
            tx,
            reembolsoManual({
              ...turnoDe(centro.nombre, r.pago.reserva),
              montoCentavos: r.montoCentavos,
              motivo,
            }),
          );
        }
      });
      return;
    }

    // Salio: se marca en el acto, antes que nada mas. Si se marcara junto con el estado del
    // pago y esa lectura fallara, un reembolso hecho quedaria como fallido y el centro podria
    // devolver dos veces.
    await this.db.reembolso.update({
      where: { id },
      data: {
        estado: 'aprobado',
        proveedorId: hecho.id,
        intentos: r.intentos + 1,
        ultimoError: null,
      },
    });
    // Lo reembolsado se copia de MP y no se suma: si un intento anterior llego a MP y no se
    // registro, sumar lo contaria dos veces. Si esta lectura falla, lo corrige el proximo aviso
    // del pago, que escribe el mismo estado.
    await mp
      .getPayment(r.pago.proveedorId)
      .then((actual) =>
        this.db.pago.update({
          where: { id: r.pago.id },
          data: {
            estado: ESTADOS[actual.status],
            reembolsadoCentavos: actual.refundedCents,
          },
        }),
      )
      .catch((e: unknown) =>
        this.logger.warn(
          `Reembolso ${id} hecho, sin el estado del pago: ${String(e)}`,
        ),
      );
  }

  /** Cancela las reservas impagas del centro cuyo tiempo para pagar ya paso. */
  async vencerImpagas(centro: { nombre: string }): Promise<void> {
    const ahora = new Date();
    const vencidas = await this.db.reserva.findMany({
      where: { estado: 'pendiente', pagoVenceAt: { lt: ahora } },
      select: { id: true, ...datosDelTurno },
    });
    for (const r of vencidas) {
      await this.db.$transaction(async (tx) => {
        // Condicional: si el pago se aprobo recien, la reserva ya no esta pendiente y no se
        // toca.
        const { count } = await tx.reserva.updateMany({
          where: { id: r.id, estado: 'pendiente', pagoVenceAt: { lt: ahora } },
          data: canceladaPorSistema(),
        });
        if (count === 0) return;
        await this.notificaciones.encolar(
          tx,
          r.clienteEmail,
          turnoVencido(turnoDe(centro.nombre, r)),
        );
      });
    }
    if (vencidas.length > 0) this.notificaciones.despacharAhora();
  }
}
