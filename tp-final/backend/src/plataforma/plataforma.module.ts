import { Module } from '@nestjs/common';
import { AltaCentroController } from './alta-centro.controller.js';
import { PlataformaController } from './plataforma.controller.js';
import { PlataformaService } from './plataforma.service.js';

@Module({
  controllers: [PlataformaController, AltaCentroController],
  providers: [PlataformaService],
})
export class PlataformaModule {}
