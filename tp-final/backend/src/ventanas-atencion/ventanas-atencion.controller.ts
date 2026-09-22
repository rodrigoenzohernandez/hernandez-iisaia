import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ErrorDto } from '../common/error.dto.js';
import {
  ReplaceVentanasDto,
  VentanasAtencionDto,
} from './dto/replace-ventanas.dto.js';
import { VentanasAtencionService } from './ventanas-atencion.service.js';

@ApiBearerAuth()
@Controller('tenants/:tenantSlug/ventanas-atencion')
export class VentanasAtencionController {
  constructor(private readonly ventanas: VentanasAtencionService) {}

  /** Las franjas en que el centro toma turnos, con su capacidad. */
  @Get()
  @ApiOkResponse({ type: VentanasAtencionDto })
  findAll(): Promise<VentanasAtencionDto> {
    return this.ventanas.findAll();
  }

  /** Reemplaza la semana completa de franjas de atencion. */
  @Put()
  @ApiOkResponse({ type: VentanasAtencionDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'Alguna franja es invalida.',
  })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'Hay franjas superpuestas.',
  })
  // Es un PUT sobre la coleccion y no un CRUD por franja: un endpoint en lugar de tres, y
  // nunca existe el estado intermedio en que la semana quedo a medio editar. Es idempotente
  // porque la representacion no lleva `id`.
  //
  // Bajar la capacidad con reservas ya tomadas NO cancela nada: la capacidad es una regla
  // que se aplica al reservar, no un invariante sobre filas guardadas. Esos horarios quedan
  // sin cupo y la agenda drena sola.
  replaceAll(@Body() dto: ReplaceVentanasDto): Promise<VentanasAtencionDto> {
    return this.ventanas.replaceAll(dto);
  }
}
