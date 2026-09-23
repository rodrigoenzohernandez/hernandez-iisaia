import { Module } from '@nestjs/common';
import { RecordatoriosService } from './recordatorios.service.js';
import { ReservasController } from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';

@Module({
  controllers: [ReservasController],
  providers: [ReservasService, RecordatoriosService],
  exports: [RecordatoriosService],
})
export class ReservasModule {}
