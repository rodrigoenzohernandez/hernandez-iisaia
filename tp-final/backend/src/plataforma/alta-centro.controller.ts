import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { LimiteAltaDeCentro, Publico } from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { CentroCreadoDto, CrearCentroDto } from './dto/alta-centro.dto.js';
import { PlataformaService } from './plataforma.service.js';

/**
 * El alta de centros: asi aparecen los centros nuevos. Sigue sin haber GET /tenants: listar
 * los centros publicaria la cartera de clientes, y eso es del panel de la plataforma.
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
}
