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
    @CurrentTenant() tenant: TenantRequest,
    @Param('reservaId') reservaId: string,
    @CurrentUsuario() usuario: UsuarioRequest,
  ): Promise<ReservaDto> {
    return this.reservas.findOne(tenant, reservaId, usuario);
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
    @CurrentTenant() tenant: TenantRequest,
    @Query() query: ListReservasQueryDto,
  ): Promise<CursorPageDto<ReservaDto>> {
    return this.reservas.findAll(tenant, query);
  }

  /** Cancela, reprograma, confirma o marca ausente un turno. */
  @Roles('cliente', 'admin')
  @Patch(':reservaId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ReservaDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description:
      'Estado y fecha juntos, fecha sin hora, o reembolsar fuera de lugar.',
  })
  @ApiUnauthorizedResponse({ type: ErrorDto, description: 'Falta el token.' })
  @ApiForbiddenResponse({
    type: ErrorDto,
    description:
      'Token de otro centro, o una clienta pidiendo algo que es del centro.',
  })
  @ApiNotFoundResponse({
    type: ErrorDto,
    description: 'La reserva no existe, o no es de la clienta de la sesion.',
  })
  @ApiConflictResponse({
    type: ErrorDto,
    description:
      'Transicion invalida, fuera de plazo para reprogramar, sin cupo en el horario nuevo o ausente antes de hora.',
  })
  // Es un PATCH y no un POST /cancelar ni /reprogramar: las dos cosas le cambian campos al
  // recurso, no crean uno nuevo. La clienta puede cancelar y reprogramar las suyas; el centro,
  // todo. `cancelada` y `ausente` son terminales.
  update(
    @CurrentTenant() tenant: TenantRequest,
    @Param('reservaId') reservaId: string,
    @Body() dto: UpdateReservaDto,
    @CurrentUsuario() usuario: UsuarioRequest,
  ): Promise<ReservaDto> {
    return this.reservas.update(tenant, reservaId, dto, usuario);
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
    @CurrentTenant() tenant: TenantRequest,
    @CurrentUsuario() usuario: UsuarioRequest,
    @Query() query: ListReservasQueryDto,
  ): Promise<CursorPageDto<ReservaDto>> {
    return this.reservas.findAll(tenant, query, usuario.id);
  }
}
