import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import {
  CurrentTenant,
  Publico,
  type TenantRequest,
} from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { DisponibilidadService } from './disponibilidad.service.js';
import { DisponibilidadQueryDto } from './dto/disponibilidad-query.dto.js';
import { DisponibilidadDto } from './dto/slot.dto.js';

@Controller('tenants/:tenantSlug/servicios/:servicioId/disponibilidad')
export class DisponibilidadController {
  constructor(private readonly disponibilidad: DisponibilidadService) {}

  /** Horarios de un dia para un tratamiento, con los cupos que quedan en cada uno. */
  @Publico()
  @Get()
  @ApiOkResponse({ type: DisponibilidadDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'Fecha invalida o muy lejana.',
  })
  @ApiNotFoundResponse({
    type: ErrorDto,
    description: 'El centro o el tratamiento no existe.',
  })
  // Va anidada en el tratamiento porque la grilla depende de su duracion: uno de 60 minutos
  // tiene menos horarios que uno de 30 en la misma franja.
  find(
    @CurrentTenant() tenant: TenantRequest,
    @Param('servicioId') servicioId: string,
    @Query() query: DisponibilidadQueryDto,
  ): Promise<DisponibilidadDto> {
    return this.disponibilidad.find(tenant, servicioId, query.fecha);
  }
}
