import { Module } from '@nestjs/common';
import { ReservasController } from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';

@Module({
  controllers: [ReservasController],
  providers: [ReservasService],
})
export class ReservasModule {}
