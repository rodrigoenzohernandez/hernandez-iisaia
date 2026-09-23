import { Module } from '@nestjs/common';
import { ReservasModule } from '../reservas/reservas.module.js';
import { TareasService } from './tareas.service.js';

@Module({
  imports: [ReservasModule],
  providers: [TareasService],
})
export class TareasModule {}
