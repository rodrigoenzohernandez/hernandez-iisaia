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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiSoloAdmin,
  ApiTenant,
  SoloClienta,
} from '../common/api.decorators.js';
import {
  CurrentTenant,
  CurrentUsuario,
  LimiteEstricto,
  Publico,
  Roles,
  type TenantRequest,
  type UsuarioRequest,
} from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { ApiCursorPage } from '../common/pagination/api-cursor-page.decorator.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import { CreateReservaDto } from './dto/create-reserva.dto.js';
import { ListReservasQueryDto } from './dto/list-reservas-query.dto.js';
import { EstadoReservaSoloDto, ReservaDto } from './dto/reserva.dto.js';
import { UpdateReservaDto } from './dto/update-reserva.dto.js';
import { ReservasService } from './reservas.service.js';

@ApiTenant()
@Controller('tenants/:tenantSlug/reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  /** Reserva un turno, con o sin cuenta. Con token de admin, el centro lo carga a nombre de una clienta. */
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
  // Publica y no @Roles: se puede reservar sin cuenta. El token, si viene, cambia de quien es
  // el turno (la clienta de la sesion) o quien lo carga (el centro), no si se puede reservar.
  // Con `efectivo` la reserva nace confirmada, porque la sena se cobra en el local. Con
  // `mercadopago` nace pendiente y la administradora la confirma cuando el pago exista: sin
  // integracion real, dejarla nacer confirmada haria que el metodo de pago no signifique nada.
  create(
    @CurrentTenant() tenant: TenantRequest,
    @Body() dto: CreateReservaDto,
    @CurrentUsuario() usuario?: UsuarioRequest,
  ): Promise<ReservaDto> {
    return this.reservas.create(tenant, dto, usuario);
  }

  /** Una reserva. La ve su duenia o la administracion. */
  @Roles('cliente', 'admin')
  @Get(':reservaId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ReservaDto })
  @ApiUnauthorizedResponse({ type: ErrorDto, description: 'Falta el token.' })
  @ApiForbiddenResponse({
    type: ErrorDto,
    description: 'El token es de otro centro.',
  })
  @ApiNotFoundResponse({
    type: ErrorDto,
    description: 'La reserva no existe, o no es de la clienta de la sesion.',
  })
  findOne(
    @Param('reservaId') reservaId: string,
    @CurrentUsuario() usuario: UsuarioRequest,
  ): Promise<ReservaDto> {
    return this.reservas.findOne(reservaId, usuario);
  }

  /** El estado de una reserva, sin datos personales. Para la pagina de vuelta de un pago. */
  @Publico()
  @Get(':reservaId/estado')
  @ApiOkResponse({ type: EstadoReservaSoloDto })
  @ApiNotFoundResponse({ type: ErrorDto, description: 'La reserva no existe.' })
  // Publica porque quien reservo sin cuenta vuelve de Mercado Pago sin token. No expone nada
  // mas que el estado, y el id es un cuid que no se adivina.
  estado(@Param('reservaId') reservaId: string): Promise<EstadoReservaSoloDto> {
    return this.reservas.estado(reservaId);
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
    @CurrentTenant() tenant: TenantRequest,
    @Param('reservaId') reservaId: string,
    @Body() dto: UpdateReservaDto,
  ): Promise<ReservaDto> {
    return this.reservas.update(tenant, reservaId, dto);
  }
}

/** Los turnos de la clienta de la sesion. Vive aca y no en clientes/ porque es una vista de reservas. */
@ApiTenant()
@Controller('tenants/:tenantSlug/clientes/me/reservas')
export class MisReservasController {
  constructor(private readonly reservas: ReservasService) {}

  /** Los turnos de la clienta, tambien los que reservo sin cuenta con el mismo email. */
  @SoloClienta()
  @Get()
  @ApiCursorPage(ReservaDto)
  findAll(
    @CurrentUsuario() usuario: UsuarioRequest,
    @Query() query: ListReservasQueryDto,
  ): Promise<CursorPageDto<ReservaDto>> {
    return this.reservas.findAll(query, usuario.id);
  }
}
