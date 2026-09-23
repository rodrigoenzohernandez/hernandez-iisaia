import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module.js';
import { CobrosModule } from '../cobros/cobros.module.js';
import { RecordatoriosService } from './recordatorios.service.js';
import {
  MisReservasController,
  ReservasController,
} from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';

@Module({
  imports: [ClientesModule, CobrosModule],
  controllers: [ReservasController, MisReservasController],
  providers: [ReservasService, RecordatoriosService],
  exports: [RecordatoriosService],
})
export class ReservasModule {}
