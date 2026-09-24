import { Module } from '@nestjs/common';
import { CobrosModule } from '../cobros/cobros.module.js';
import { ReservasModule } from '../reservas/reservas.module.js';
import { TareasService } from './tareas.service.js';

@Module({
  imports: [ReservasModule, CobrosModule],
  providers: [TareasService],
})
export class TareasModule {}
