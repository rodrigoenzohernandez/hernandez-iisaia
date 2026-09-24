import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SoloSuperadmin } from '../common/api.decorators.js';
import { LimiteEstricto, Publico } from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { ApiCursorPage } from '../common/pagination/api-cursor-page.decorator.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import {
  CentroDto,
  CrearSesionPlataformaDto,
  ListCentrosQueryDto,
  ResumenDto,
  SesionPlataformaDto,
  UpdateCentroDto,
} from './dto/plataforma.dto.js';
import { PlataformaService } from './plataforma.service.js';

/** El panel de la plataforma: todos los centros y sus numeros. Solo con la cuenta sembrada. */
@Controller('plataforma')
export class PlataformaController {
  constructor(private readonly plataforma: PlataformaService) {}

  /** Inicia sesion en la plataforma. No hay alta: la cuenta la crea el seed. */
  @Publico()
  @Post('sesiones')
  @HttpCode(201)
  @LimiteEstricto()
  @ApiCreatedResponse({ type: SesionPlataformaDto })
  @ApiUnauthorizedResponse({
    type: ErrorDto,
    description: 'Credenciales incorrectas.',
  })
  ingresar(
    @Body() dto: CrearSesionPlataformaDto,
  ): Promise<SesionPlataformaDto> {
    return this.plataforma.ingresar(dto);
  }

  /** Los centros, con su plan, su cuenta de Mercado Pago y los numeros del mes. */
  @SoloSuperadmin()
  @Get('tenants')
  @ApiCursorPage(CentroDto)
  centros(
    @Query() query: ListCentrosQueryDto,
  ): Promise<CursorPageDto<CentroDto>> {
    return this.plataforma.centros(query);
  }

  /** Los numeros de toda la plataforma en el mes en curso. */
  @SoloSuperadmin()
  @Get('resumen')
  @ApiOkResponse({ type: ResumenDto })
  resumen(): Promise<ResumenDto> {
    return this.plataforma.resumen();
  }

  /** Da de baja un centro, o lo reactiva. */
  @SoloSuperadmin()
  @Patch('tenants/:slug')
  @ApiOkResponse({ type: CentroDto })
  @ApiNotFoundResponse({ type: ErrorDto, description: 'El centro no existe.' })
  // El parametro se llama :slug y no :tenantSlug a proposito: con :tenantSlug el guard
  // resolveria el centro, y un centro dado de baja responderia 404 antes de poder
  // reactivarlo; ademas rechazaria el token de la plataforma en una ruta de centro.
  actualizar(
    @Param('slug') slug: string,
    @Body() dto: UpdateCentroDto,
  ): Promise<CentroDto> {
    return this.plataforma.actualizar(slug, dto);
  }
}
