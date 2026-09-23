import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiSoloAdmin, ApiTenant } from '../common/api.decorators.js';
import {
  CurrentTenant,
  LimiteEstricto,
  Publico,
  type TenantRequest,
} from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { ApiCursorPage } from '../common/pagination/api-cursor-page.decorator.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import { CreateReservaDto } from './dto/create-reserva.dto.js';
import { ListReservasQueryDto } from './dto/list-reservas-query.dto.js';
import { ReservaDto } from './dto/reserva.dto.js';
import { UpdateReservaDto } from './dto/update-reserva.dto.js';
import { ReservasService } from './reservas.service.js';

@ApiTenant()
@Controller('tenants/:tenantSlug/reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  /** Reserva un turno. Publico: la clienta no tiene cuenta, deja sus datos de contacto. */
  @Publico()
  @Post()
  @LimiteEstricto()
  @ApiCreatedResponse({ type: ReservaDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'Datos invalidos o fecha muy lejana.',
  })
  @ApiNotFoundResponse({
    type: ErrorDto,
    description: 'El centro o el tratamiento no existe.',
  })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'Sin cupo, fuera de agenda, horario pasado o turno duplicado.',
  })
  // Con `efectivo` la reserva nace confirmada, porque la sena se cobra en el local. Con
  // `mercadopago` nace pendiente y la administradora la confirma cuando el pago exista: sin
  // integracion real, dejarla nacer confirmada haria que el metodo de pago no signifique nada.
  create(
    @CurrentTenant() tenant: TenantRequest,
    @Body() dto: CreateReservaDto,
  ): Promise<ReservaDto> {
    return this.reservas.create(tenant, dto);
  }

  /** La agenda del centro, paginada por cursor. Solo la administradora. */
  @ApiSoloAdmin()
  @Get()
  @ApiCursorPage(ReservaDto)
  findAll(
    @Query() query: ListReservasQueryDto,
  ): Promise<CursorPageDto<ReservaDto>> {
    return this.reservas.findAll(query);
  }

  /** Confirma o cancela un turno. */
  @ApiSoloAdmin()
  @Patch(':reservaId')
  @ApiOkResponse({ type: ReservaDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'El estado pedido no existe.',
  })
  @ApiNotFoundResponse({ type: ErrorDto, description: 'La reserva no existe.' })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'Esa transicion de estado no es valida.',
  })
  // Es un PATCH del estado y no un POST /cancelar: cancelar es cambiarle un campo al
  // recurso, no crear uno nuevo. Cancelar libera el cupo; `cancelada` es terminal.
  update(
    @Param('reservaId') reservaId: string,
    @Body() dto: UpdateReservaDto,
  ): Promise<ReservaDto> {
    return this.reservas.update(reservaId, dto);
  }
}
