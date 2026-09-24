import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ApiSoloAdmin, ApiTenant } from '../common/api.decorators.js';
import {
  CurrentTenant,
  CurrentUsuario,
  type TenantRequest,
  type UsuarioRequest,
} from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { SuscripcionDto, UpdateSuscripcionDto } from './dto/suscripcion.dto.js';
import { SuscripcionesService } from './suscripciones.service.js';

/** El plan del centro y su suscripcion mensual a la plataforma. Recurso unico por centro. */
@ApiTenant()
@Controller('tenants/:tenantSlug/suscripcion')
export class SuscripcionController {
  constructor(private readonly suscripciones: SuscripcionesService) {}

  /** El plan que rige hoy y el estado de la suscripcion. */
  @ApiSoloAdmin()
  @Get()
  @ApiOkResponse({ type: SuscripcionDto })
  estado(): Promise<SuscripcionDto> {
    return this.suscripciones.estado();
  }

  /** Cambia de plan: al Profesional con el cobro mensual en Mercado Pago, o de vuelta al Basico. */
  @ApiSoloAdmin()
  @Put()
  @ApiOkResponse({
    type: SuscripcionDto,
    description:
      'Profesional: `suscripcion.url` es donde autorizar el cobro mensual, y el plan rige desde el primer cobro aprobado. Basico: cancela la suscripcion, y lo pagado sigue hasta `pagoHasta`. Pedir el plan que ya se pidio no cambia nada.',
  })
  @ApiConflictResponse({
    type: ErrorDto,
    description:
      'mercadopago_not_connected: el Profesional pide la cuenta de Mercado Pago del centro conectada.',
  })
  @ApiBadGatewayResponse({
    type: ErrorDto,
    description: 'Mercado Pago no respondio.',
  })
  @ApiServiceUnavailableResponse({
    type: ErrorDto,
    description: 'La plataforma no tiene configurado el cobro de los planes.',
  })
  cambiar(
    @CurrentTenant() tenant: TenantRequest,
    @CurrentUsuario() usuario: UsuarioRequest,
    @Body() dto: UpdateSuscripcionDto,
  ): Promise<SuscripcionDto> {
    return this.suscripciones.cambiar(tenant, usuario, dto);
  }
}
