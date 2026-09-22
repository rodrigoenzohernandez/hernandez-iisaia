import { Module } from '@nestjs/common';
import { VentanasAtencionController } from './ventanas-atencion.controller.js';
import { VentanasAtencionService } from './ventanas-atencion.service.js';

@Module({
  controllers: [VentanasAtencionController],
  providers: [VentanasAtencionService],
})
export class VentanasAtencionModule {}
