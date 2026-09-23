import { Module } from '@nestjs/common';
import { CobrosModule } from '../cobros/cobros.module.js';
import { PlanesController } from './planes.controller.js';
import { SuscripcionController } from './suscripcion.controller.js';
import { SuscripcionesService } from './suscripciones.service.js';
import { WebhookPlataformaController } from './webhook-plataforma.controller.js';

@Module({
  imports: [CobrosModule],
  controllers: [
    PlanesController,
    SuscripcionController,
    WebhookPlataformaController,
  ],
  providers: [SuscripcionesService],
})
export class PlanesModule {}
