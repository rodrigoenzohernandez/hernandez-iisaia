import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module.js';
import { RecordatoriosService } from './recordatorios.service.js';
import {
  MisReservasController,
  ReservasController,
} from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';

@Module({
  imports: [ClientesModule],
  controllers: [ReservasController, MisReservasController],
  providers: [ReservasService, RecordatoriosService],
  exports: [RecordatoriosService],
})
export class ReservasModule {}
