import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { Publico } from '../common/decorators.js';
import { PLANES } from './planes.js';

export class PlanDto {
  @ApiProperty({ enum: Plan, example: 'profesional' })
  id!: Plan;
  nombre!: string;
  /** Por mes, en centavos. */
  @ApiProperty({ example: 1_990_000 })
  precioCentavos!: number;
  /** Turnos por mes. null: sin tope. */
  @ApiProperty({ type: Number, nullable: true, example: 60 })
  turnosPorMes!: number | null;
  /** Turnos simultaneos por franja. */
  capacidadMaxima!: number;
  recordatorios!: boolean;
  cobroOnline!: boolean;
}

@Controller('planes')
export class PlanesController {
  /** Los planes de la plataforma, para la pagina de precios. */
  @Publico()
  @Get()
  @ApiOkResponse({ type: PlanDto, isArray: true })
  findAll(): PlanDto[] {
    return Object.values(Plan).map((id) => ({ id, ...PLANES[id] }));
  }
}
