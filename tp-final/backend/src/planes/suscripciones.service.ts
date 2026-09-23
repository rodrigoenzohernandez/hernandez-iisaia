import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CuentasMercadoPagoService,
  esHttps,
  mpNoResponde,
  mpSinConfigurar,
} from '../cobros/cuentas-mercadopago.service.js';
import type { TenantRequest, UsuarioRequest } from '../common/decorators.js';
import { env } from '../env.js';
import {
  type MercadoPago,
  MercadoPagoError,
  type WebhookEvent,
} from '../lib/mercadopago/index.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import type {
  SuscripcionDto,
  UpdateSuscripcionDto,
} from './dto/suscripcion.dto.js';
import {
  camposDelPlan,
  PLANES,
  planVigente,
  suscripcionViva,
} from './planes.js';

/** Un mes despues de un cobro: hasta ahi queda pago el plan. */
function unMesDespues(fecha: Date): Date {
  const d = new Date(fecha);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/**
 * La suscripcion de cada centro a la plataforma. Vive en Tenant y no en una tabla propia: el
 * aviso de Mercado Pago llega a una ruta sin centro en la URL, y una tabla con tenantId no se
 * podria leer desde ahi sin abrir un agujero en la extension.
 *
 * Tenant es la raiz y la extension no lo filtra: cada where lleva el id explicito.
 */
@Injectable()
export class SuscripcionesService {
  private readonly logger = new Logger('Suscripciones');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cuentas: CuentasMercadoPagoService,
  ) {}

  async estado(): Promise<SuscripcionDto> {
    const t = await this.db.tenant.findFirstOrThrow({
      where: { id: TenantContext.require() },
      select: { ...camposDelPlan, suscripcionMpId: true, suscripcionUrl: true },
    });
    return {
      plan: planVigente(t),
      pagoHasta: t.planPagoHasta,
      suscripcion:
        t.suscripcionMpId && t.suscripcionPlan && t.suscripcionEstado
          ? {
              plan: t.suscripcionPlan,
              estado: t.suscripcionEstado,
              url: t.suscripcionEstado === 'pending' ? t.suscripcionUrl : null,
            }
          : null,
    };
  }

  /**
   * Profesional crea la suscripcion y devuelve donde autorizarla; el plan rige desde el
   * primer cobro aprobado. Basico la cancela, y lo pagado sigue hasta pagoHasta. Las dos son
   * idempotentes: pedir el plan que ya se pidio devuelve el estado sin tocar Mercado Pago.
   */
  async cambiar(
    tenant: TenantRequest,
    usuario: UsuarioRequest,
    dto: UpdateSuscripcionDto,
  ): Promise<SuscripcionDto> {
    if (dto.plan === 'basico') {
      await this.cancelar();
      return this.estado();
    }

    const id = TenantContext.require();
    const actual = await this.db.tenant.findFirstOrThrow({
      where: { id },
      select: { suscripcionMpId: true, suscripcionEstado: true },
    });
    if (suscripcionViva(actual)) return this.estado();
    // El Profesional existe para cobrar online: sin la cuenta del centro no hay a donde.
    const cuenta = await this.cuentas.estado();
    if (!cuenta.conectada || cuenta.requiereReconexion) {
      throw new ConflictException({
        code: 'mercadopago_not_connected',
        message:
          'Para el plan Profesional, primero conecta la cuenta de Mercado Pago del centro.',
      });
    }
    const payerEmail =
      dto.emailPagador ??
      (
        await this.db.usuario.findFirstOrThrow({
          where: { id: usuario.id },
          select: { email: true },
        })
      ).email;
    const plan = PLANES.profesional;
    const s = await this.llamar((mp) =>
      mp.createSubscription({
        // El slug ata la suscripcion al centro sin adivinar por email.
        reference: tenant.slug,
        reason: `Plan ${plan.nombre} - ${tenant.nombre}`,
        amountCents: plan.precioCentavos,
        payerEmail,
        backUrl: esHttps(env.frontendUrl)
          ? `${env.frontendUrl}/${tenant.slug}/admin/suscripcion`
          : undefined,
      }),
    );
    // Se guarda solo si nadie la cambio mientras tanto: dos pedidos a la vez (un doble click)
    // crean dos suscripciones en MP, y la que pierde se cancela antes de que alguien la
    // autorice. Las dos respuestas muestran la misma, la que quedo.
    const { count } = await this.db.tenant.updateMany({
      where: { id, suscripcionMpId: actual.suscripcionMpId },
      data: {
        suscripcionPlan: 'profesional',
        suscripcionMpId: s.id,
        suscripcionEstado: s.status,
        suscripcionUrl: s.url,
      },
    });
    if (count === 0) {
      await this.llamar((mp) => mp.cancelSubscription(s.id)).catch(
        (e: unknown) =>
          // Una pendiente que nadie autoriza no cobra nada: alcanza con dejarlo en el log.
          this.logger.warn(
            `No se cancelo la suscripcion sobrante ${s.id}: ${String(e)}`,
          ),
      );
    }
    return this.estado();
  }

  /**
   * Cancela la suscripcion del centro en contexto, si hay una viva. Lo pagado sigue hasta
   * pagoHasta, y la cuenta de MP queda conectada: los turnos ya pagados se tienen que poder
   * reembolsar.
   */
  async cancelar(): Promise<void> {
    const id = TenantContext.require();
    const actual = await this.db.tenant.findFirstOrThrow({
      where: { id },
      select: { suscripcionMpId: true, suscripcionEstado: true },
    });
    if (!suscripcionViva(actual)) return;
    const s = await this.llamar((mp) =>
      mp.cancelSubscription(actual.suscripcionMpId!),
    );
    await this.db.tenant.update({
      where: { id },
      data: { suscripcionEstado: s.status, suscripcionUrl: null },
    });
  }

  /**
   * Un aviso de la cuenta de la plataforma, ya consultado a MP. Escribe estados y no suma
   * nada, asi que procesar el mismo aviso dos veces da lo mismo.
   */
  async registrarEvento(evento: WebhookEvent): Promise<void> {
    if (evento.type === 'subscription') {
      const s = evento.subscription;
      await this.db.tenant.updateMany({
        where: { suscripcionMpId: s.id },
        data: {
          suscripcionEstado: s.status,
          ...(s.status === 'pending' ? {} : { suscripcionUrl: null }),
        },
      });
    }
    if (
      evento.type === 'subscription_charge' &&
      evento.charge.paymentStatus === 'approved' &&
      evento.charge.subscriptionId
    ) {
      const hasta = unMesDespues(evento.charge.chargedAt ?? new Date());
      // max(actual, hasta) con un UPDATE condicional: un aviso repetido o viejo no mueve la
      // fecha para atras.
      await this.db.tenant.updateMany({
        where: {
          suscripcionMpId: evento.charge.subscriptionId,
          OR: [{ planPagoHasta: null }, { planPagoHasta: { lt: hasta } }],
        },
        data: { planPagoHasta: hasta },
      });
    }
  }

  private async llamar<T>(fn: (mp: MercadoPago) => Promise<T>): Promise<T> {
    const mp = this.cuentas.dePlataforma();
    if (!mp) mpSinConfigurar();
    try {
      return await fn(mp);
    } catch (e) {
      if (!(e instanceof MercadoPagoError)) throw e;
      mpNoResponde();
    }
  }
}
