import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { CuentasMercadoPagoService } from '../cobros/cuentas-mercadopago.service.js';
import { Publico } from '../common/decorators.js';
import { env } from '../env.js';
import { InvalidWebhookSignatureError } from '../lib/mercadopago/index.js';
import { SuscripcionesService } from './suscripciones.service.js';

/**
 * Los avisos de la cuenta de la plataforma: las suscripciones de los centros y sus cobros. Se
 * activan una vez en el panel de la app de Mercado Pago, que los firma.
 */
@Controller('webhooks/mercadopago')
export class WebhookPlataformaController {
  constructor(
    private readonly cuentas: CuentasMercadoPagoService,
    private readonly suscripciones: SuscripcionesService,
  ) {}

  // Fuera del OpenAPI: lo llama Mercado Pago, no el front.
  @ApiExcludeEndpoint()
  @Publico()
  @Post()
  @HttpCode(200)
  async recibir(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const mp = this.cuentas.dePlataforma();
    if (!mp) return { ok: true };
    try {
      // Aca la firma se exige: son los webhooks de la app, que MP firma siempre. Un aviso
      // que no la trae no se procesa, aunque despues se consulte el recurso a MP.
      const evento = await mp.parseWebhook(
        { headers, query, body },
        { secret: env.mercadoPago.webhookSecret, signature: 'required' },
      );
      await this.suscripciones.registrarEvento(evento);
    } catch (e) {
      if (e instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException({
          code: 'invalid_signature',
          message: 'La firma del aviso no es valida.',
        });
      }
      // Cualquier otro error sale como 500 y MP reintenta el aviso.
      throw e;
    }
    return { ok: true };
  }
}
