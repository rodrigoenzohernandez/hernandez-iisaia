import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { env } from '../env.js';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Publico } from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { AuthService } from './auth.service.js';
import { CrearSesionDto } from './dto/crear-sesion.dto.js';
import { SesionDto } from './dto/sesion.dto.js';

@Controller('tenants/:tenantSlug/sesiones')
export class SesionesController {
  constructor(private readonly auth: AuthService) {}

  /** Inicia sesion como administradora del centro. */
  @Publico()
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: env.throttleLimit, ttl: 60_000 } })
  @ApiCreatedResponse({ type: SesionDto })
  @ApiUnauthorizedResponse({
    type: ErrorDto,
    description: 'Credenciales incorrectas.',
  })
  @ApiNotFoundResponse({ type: ErrorDto, description: 'El centro no existe.' })
  // Es `POST /sesiones` y no `/auth/login` porque `login` seria un verbo en la URI: crear
  // una sesion es crear un recurso, y por eso devuelve 201. No hay DELETE: el JWT no tiene
  // estado en el servidor, y cerrar sesion es descartar el token en el cliente.
  create(@Body() dto: CrearSesionDto): Promise<SesionDto> {
    return this.auth.create(dto);
  }
}
