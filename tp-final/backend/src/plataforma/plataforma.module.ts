import { Module } from '@nestjs/common';
import { PlanesModule } from '../planes/planes.module.js';
import { AltaCentroController } from './alta-centro.controller.js';
import { PlataformaController } from './plataforma.controller.js';
import { PlataformaService } from './plataforma.service.js';

@Module({
  imports: [PlanesModule],
  controllers: [PlataformaController, AltaCentroController],
  providers: [PlataformaService],
})
export class PlataformaModule {}
