import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ApiSoloAdmin, ApiTenant } from '../common/api.decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { CuentasMercadoPagoService } from './cuentas-mercadopago.service.js';
import {
  AutorizacionDto,
  ConectarCuentaDto,
  CuentaMercadoPagoDto,
} from './dto/cuenta-mercadopago.dto.js';

/**
 * La cuenta de Mercado Pago del centro, donde cae la plata de sus clientas. Es un recurso
 * unico por centro: sin id en la ruta.
 */
@ApiTenant()
@Controller('tenants/:tenantSlug/cuenta-mercadopago')
export class CuentaMercadoPagoController {
  constructor(private readonly cuentas: CuentasMercadoPagoService) {}

  /** Si el centro tiene la cuenta conectada. Nunca devuelve los tokens. */
  @ApiSoloAdmin()
  @Get()
  @ApiOkResponse({ type: CuentaMercadoPagoDto })
  estado(): Promise<CuentaMercadoPagoDto> {
    return this.cuentas.estado();
  }

  /** La URL de Mercado Pago para autorizar a la plataforma a cobrar en nombre del centro. */
  @ApiSoloAdmin()
  @Get('autorizacion')
  @ApiOkResponse({ type: AutorizacionDto })
  @ApiServiceUnavailableResponse({
    type: ErrorDto,
    description: 'La plataforma no tiene configurada la app de Mercado Pago.',
  })
  // Un GET: no guarda nada. El state viaja cifrado en la URL y vuelve con la redirect.
  autorizacion(): AutorizacionDto {
    return this.cuentas.urlDeAutorizacion();
  }

  /** Conecta la cuenta con lo que devolvio Mercado Pago en la redirect: `code` y `state`. */
  @ApiSoloAdmin()
  @Post()
  @ApiCreatedResponse({ type: CuentaMercadoPagoDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description:
      'El state vencio, es de otro centro, o Mercado Pago rechazo el codigo.',
  })
  @ApiConflictResponse({
    type: ErrorDto,
    description:
      'Cambiar de cuenta dejaria sin reembolso pagos de turnos por venir.',
  })
  conectar(@Body() dto: ConectarCuentaDto): Promise<CuentaMercadoPagoDto> {
    return this.cuentas.conectar(dto.code, dto.state);
  }

  /** Desconecta la cuenta. El centro deja de cobrar online. */
  @ApiSoloAdmin()
  @Delete()
  @ApiOkResponse({ type: CuentaMercadoPagoDto })
  @ApiConflictResponse({
    type: ErrorDto,
    description:
      'Hay pagos de turnos por venir que se tendrian que poder reembolsar.',
  })
  // Un DELETE de verdad, a diferencia de la baja de un tratamiento: despues la conexion no
  // existe mas. Devuelve 200 con el estado nuevo, y no 204, como el resto de la API.
  desconectar(): Promise<CuentaMercadoPagoDto> {
    return this.cuentas.desconectar();
  }
}
