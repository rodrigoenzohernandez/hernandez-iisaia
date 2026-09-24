import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiSoloAdmin, ApiTenant } from '../common/api.decorators.js';
import { CurrentTenant, type TenantRequest } from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { PLANES } from '../planes/planes.js';
import {
  ReplaceVentanasDto,
  VentanasAtencionDto,
} from './dto/replace-ventanas.dto.js';
import { VentanasAtencionService } from './ventanas-atencion.service.js';

@ApiTenant()
@Controller('tenants/:tenantSlug/ventanas-atencion')
export class VentanasAtencionController {
  constructor(private readonly ventanas: VentanasAtencionService) {}

  /** Las franjas en que el centro toma turnos, con su capacidad. */
  @ApiSoloAdmin()
  @Get()
  @ApiOkResponse({ type: VentanasAtencionDto })
  findAll(
    @CurrentTenant() tenant: TenantRequest,
  ): Promise<VentanasAtencionDto> {
    return this.ventanas.findAll(tenant.plan);
  }

  /** Reemplaza la semana completa de franjas de atencion. */
  @ApiSoloAdmin()
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
  @ApiForbiddenResponse({
    type: ErrorDto,
    description:
      'plan_limit_reached: alguna capacidad pasa la del plan del centro. Tambien forbidden_role.',
  })
  // Es un PUT sobre la coleccion y no un CRUD por franja: un endpoint en lugar de tres, y
  // nunca existe el estado intermedio en que la semana quedo a medio editar. Es idempotente
  // porque la representacion no lleva `id`.
  //
  // Bajar la capacidad con reservas ya tomadas NO cancela nada: la capacidad es una regla
  // que se aplica al reservar, no un invariante sobre filas guardadas. Esos horarios quedan
  // sin cupo y la agenda drena sola.
  replaceAll(
    @CurrentTenant() tenant: TenantRequest,
    @Body() dto: ReplaceVentanasDto,
  ): Promise<VentanasAtencionDto> {
    return this.ventanas.replaceAll(dto, PLANES[tenant.plan].capacidadMaxima);
  }
}
