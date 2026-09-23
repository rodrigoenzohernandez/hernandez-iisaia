import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import {
  CurrentTenant,
  Publico,
  type TenantRequest,
} from '../common/decorators.js';
import { env } from '../env.js';
import { MercadoPagoError } from '../lib/mercadopago/index.js';
import { CobrosService } from './cobros.service.js';
import { CuentasMercadoPagoService } from './cuentas-mercadopago.service.js';

/**
 * Los avisos de pago de Mercado Pago. La notification_url de cada checkout lleva el slug, asi
 * el guard resuelve el centro como en cualquier otra ruta.
 */
@Controller('tenants/:tenantSlug/webhooks/mercadopago')
export class WebhooksMercadoPagoController {
  private readonly logger = new Logger('Webhooks');

  constructor(
    private readonly cuentas: CuentasMercadoPagoService,
    private readonly cobros: CobrosService,
  ) {}

  // Fuera del OpenAPI: lo llama Mercado Pago, no el front.
  @ApiExcludeEndpoint()
  @Publico()
  @Post()
  @HttpCode(200)
  async recibir(
    @CurrentTenant() tenant: TenantRequest,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const mp = await this.cuentas.delCentro(tenant.slug);
    if (!mp) return { ok: true };
    try {
      // Firma opcional: MP no garantiza firma verificable en los avisos por notification_url,
      // y rechazarlos perderia pagos reales. Lo que protege es que parseWebhook no usa el
      // body: trae el pago de MP con el token del centro, y un aviso falso solo puede hacer
      // que se consulte un pago real.
      const evento = await mp.parseWebhook(
        { headers, query, body },
        { secret: env.mercadoPago.webhookSecret, signature: 'optional' },
      );
      if (!evento.verified) {
        this.logger.debug(`Aviso sin firma verificable en ${tenant.slug}`);
      }
      if (evento.type === 'payment') {
        await this.cobros.registrarPago(tenant, evento.payment);
      }
    } catch (e) {
      // Un 401 es que MP revoco el acceso: reintentar el aviso no lo arregla, se avisa al
      // centro y se responde 200. Cualquier otro error sale como 500 y MP reintenta.
      if (e instanceof MercadoPagoError && e.status === 401) {
        await this.cuentas.marcarReconexion(tenant);
        return { ok: true };
      }
      throw e;
    }
    return { ok: true };
  }
}
