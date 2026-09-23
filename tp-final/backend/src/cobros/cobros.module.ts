import { Module } from '@nestjs/common';
import { CobrosService } from './cobros.service.js';
import { CuentaMercadoPagoController } from './cuenta-mercadopago.controller.js';
import { CuentasMercadoPagoService } from './cuentas-mercadopago.service.js';
import { WebhooksMercadoPagoController } from './webhooks.controller.js';

@Module({
  controllers: [CuentaMercadoPagoController, WebhooksMercadoPagoController],
  providers: [CuentasMercadoPagoService, CobrosService],
  exports: [CuentasMercadoPagoService, CobrosService],
})
export class CobrosModule {}
