import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import {
  CurrentTenant,
  Publico,
  TambienInactivo,
  type TenantRequest,
} from '../common/decorators.js';
import { env } from '../env.js';
import { MercadoPagoError } from '../lib/mercadopago/index.js';
import { CobrosService } from './cobros.service.js';
import { CuentasMercadoPagoService } from './cuentas-mercadopago.service.js';

const sinCuenta = () =>
  new ServiceUnavailableException({
    code: 'mercadopago_not_connected',
    message: 'El centro no tiene una cuenta de Mercado Pago que funcione.',
  });

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

  // Fuera del OpenAPI: lo llama Mercado Pago, no el front. Responde aunque el centro este dado
  // de baja: un pago hecho antes de la baja se tiene que registrar, y devolver.
  @ApiExcludeEndpoint()
  @Publico()
  @TambienInactivo()
  @Post()
  @HttpCode(200)
  async recibir(
    @CurrentTenant() tenant: TenantRequest,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    // Con la cuenta que haya, aunque espere reconexion: el token puede seguir sirviendo. Un
    // aviso que no se pudo procesar no se contesta 200, porque MP no lo mandaria de nuevo y
    // el pago no se registraria nunca: con el 503, MP reintenta durante unos dias, y si el
    // centro reconecta en ese tiempo, el aviso se procesa.
    const mp = await this.cuentas.paraSaldar(tenant.slug);
    if (!mp) {
      // Visible en el log: el filtro de errores no loguea las HttpException.
      this.logger.warn(`Aviso de pago sin cuenta de MP en ${tenant.slug}`);
      throw sinCuenta();
    }
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
      // Un 401 es que MP revoco el acceso: se avisa al centro para que reconecte, y el aviso
      // vuelve a llegar despues. Cualquier otro error sale como 500 y MP tambien reintenta.
      if (e instanceof MercadoPagoError && e.status === 401) {
        await this.cuentas.marcarReconexion(tenant);
        throw sinCuenta();
      }
      throw e;
    }
    return { ok: true };
  }
}
