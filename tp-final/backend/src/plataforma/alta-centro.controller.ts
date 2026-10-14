import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiTenant } from '../common/api.decorators.js';
import {
  CurrentTenant,
  LimiteAltaDeCentro,
  Publico,
  type TenantRequest,
} from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import {
  CentroCreadoDto,
  CentroPublicoDto,
  CrearCentroDto,
} from './dto/alta-centro.dto.js';
import { PlataformaService } from './plataforma.service.js';

/**
 * El recurso centro: su alta y su cara publica. Sigue sin haber GET /tenants: listar los
 * centros publicaria la cartera de clientes, y eso es del panel de la plataforma. El detalle de
 * uno si existe, porque quien lo pide ya sabe el slug.
 */
@Controller('tenants')
export class AltaCentroController {
  constructor(private readonly plataforma: PlataformaService) {}

  /** Da de alta un centro en el plan Basico, con quien lo crea como administradora. */
  @Publico()
  @Post()
  @HttpCode(201)
  @LimiteAltaDeCentro()
  @ApiCreatedResponse({ type: CentroCreadoDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'Algun dato es invalido: el slug, el email o la contrasena.',
  })
  @ApiConflictResponse({
    type: ErrorDto,
    description:
      'slug_taken: el slug ya esta en uso o es una palabra reservada.',
  })
  crear(@Body() dto: CrearCentroDto): Promise<CentroCreadoDto> {
    return this.plataforma.crearCentro(dto);
  }

  /** El nombre de un centro, para mostrarlo en su sitio. */
  @Publico()
  @ApiTenant()
  @Get(':tenantSlug')
  @ApiOkResponse({ type: CentroPublicoDto, description: 'El slug y el nombre del centro.' })
  // El guard ya busco el centro para resolver el tenant, y un centro dado de baja ya dio 404
  // ahi: esta ruta no consulta la base. Copia dos campos y no el objeto, asi lo que se sume a
  // TenantRequest no sale solo. Nunca el id: es el claim tid del JWT, y filtrarlo es la razon
  // por la que el MVP no tenia esta ruta.
  perfil(@CurrentTenant() centro: TenantRequest): CentroPublicoDto {
    return { slug: centro.slug, nombre: centro.nombre };
  }
}
