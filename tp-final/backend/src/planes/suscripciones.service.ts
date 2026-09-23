import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CuentasMercadoPagoService } from '../cobros/cuentas-mercadopago.service.js';
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
import { camposDelPlan, PLANES, planVigente } from './planes.js';

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
    const id = TenantContext.require();
    const actual = await this.db.tenant.findFirstOrThrow({
      where: { id },
      select: { suscripcionMpId: true, suscripcionEstado: true },
    });
    const viva =
      !!actual.suscripcionMpId && actual.suscripcionEstado !== 'cancelled';

    if (dto.plan === 'basico') {
      if (viva) {
        const s = await this.llamar((mp) =>
          mp.cancelSubscription(actual.suscripcionMpId!),
        );
        // La cuenta de MP queda conectada: los turnos ya pagados se tienen que poder reembolsar.
        await this.db.tenant.update({
          where: { id },
          data: { suscripcionEstado: s.status, suscripcionUrl: null },
        });
      }
      return this.estado();
    }

    if (viva) return this.estado();
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
        backUrl: env.frontendUrl?.startsWith('https://')
          ? `${env.frontendUrl}/${tenant.slug}/admin/suscripcion`
          : undefined,
      }),
    );
    await this.db.tenant.update({
      where: { id },
      data: {
        suscripcionPlan: 'profesional',
        suscripcionMpId: s.id,
        suscripcionEstado: s.status,
        suscripcionUrl: s.url,
      },
    });
    return this.estado();
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
    if (!mp) {
      throw new ServiceUnavailableException({
        code: 'mercadopago_not_configured',
        message: 'El cobro de los planes no esta configurado en la plataforma.',
      });
    }
    try {
      return await fn(mp);
    } catch (e) {
      if (!(e instanceof MercadoPagoError)) throw e;
      throw new BadGatewayException({
        code: 'payment_provider_unavailable',
        message: 'Mercado Pago no respondio. Proba de nuevo en unos minutos.',
      });
    }
  }
}
