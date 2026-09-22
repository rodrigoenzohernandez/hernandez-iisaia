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
import { CurrentUsuario, Publico } from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { ApiCursorPage } from '../common/pagination/api-cursor-page.decorator.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import { CreateServicioDto } from './dto/create-servicio.dto.js';
import { ListServiciosQueryDto } from './dto/list-servicios-query.dto.js';
import { ServicioDto } from './dto/servicio.dto.js';
import { UpdateServicioDto } from './dto/update-servicio.dto.js';
import { ServiciosService } from './servicios.service.js';

@ApiNotFoundResponse({
  type: ErrorDto,
  description: 'El centro o el tratamiento no existe.',
})
@ApiTenant()
@Controller('tenants/:tenantSlug/servicios')
export class ServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  /** Catalogo de tratamientos del centro, paginado por cursor. */
  @Publico()
  @Get()
  @ApiCursorPage(ServicioDto)
  findAll(
    @Query() query: ListServiciosQueryDto,
    @CurrentUsuario() usuario?: { id: string },
  ): Promise<CursorPageDto<ServicioDto>> {
    return this.servicios.findAll(query, Boolean(usuario));
  }

  /** Un tratamiento puntual. */
  @Publico()
  @Get(':servicioId')
  @ApiOkResponse({ type: ServicioDto })
  findOne(
    @Param('servicioId') servicioId: string,
    @CurrentUsuario() usuario?: { id: string },
  ): Promise<ServicioDto> {
    return this.servicios.findOne(servicioId, Boolean(usuario));
  }

  /** Da de alta un tratamiento. Solo la administradora del centro. */
  @ApiSoloAdmin()
  @Post()
  @ApiCreatedResponse({ type: ServicioDto })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Datos invalidos.' })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'Ya hay un tratamiento con ese nombre.',
  })
  create(@Body() dto: CreateServicioDto): Promise<ServicioDto> {
    return this.servicios.create(dto);
  }

  /** Edita un tratamiento. Es tambien la baja, con `{"activo": false}`. */
  @ApiSoloAdmin()
  @Patch(':servicioId')
  @ApiOkResponse({ type: ServicioDto })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Datos invalidos.' })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'Ya hay un tratamiento con ese nombre.',
  })
  // No hay DELETE: la baja es logica porque el historial de reservas referencia al
  // tratamiento, y un DELETE tras el cual el recurso sigue existiendo es un contrato
  // mentiroso.
  update(
    @Param('servicioId') servicioId: string,
    @Body() dto: UpdateServicioDto,
  ): Promise<ServicioDto> {
    return this.servicios.update(servicioId, dto);
  }
}
