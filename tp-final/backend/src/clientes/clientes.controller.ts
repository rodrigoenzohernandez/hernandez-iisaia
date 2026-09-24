import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiTenant, SoloClienta } from '../common/api.decorators.js';
import {
  CurrentTenant,
  CurrentUsuario,
  LimiteEstricto,
  Publico,
  type TenantRequest,
  type UsuarioRequest,
} from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import { ClientesService } from './clientes.service.js';
import { ClienteDto, SesionClienteDto } from './dto/cliente.dto.js';
import { CrearSesionClienteDto } from './dto/crear-sesion-cliente.dto.js';
import { CodigoPedidoDto, PedirCodigoDto } from './dto/pedir-codigo.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';

@ApiTenant()
@Controller('tenants/:tenantSlug/clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  /** Manda un codigo de ingreso de seis digitos al email de la clienta. */
  @Publico()
  @Post('codigos')
  @HttpCode(202)
  @LimiteEstricto()
  @ApiAcceptedResponse({ type: CodigoPedidoDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'El email no es valido.',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorDto,
    description: 'Demasiados codigos para ese email, o demasiadas peticiones.',
  })
  // Siempre 202, tenga cuenta o no: la cuenta nace al entrar, asi que no hay un email
  // "inexistente" que esta ruta pueda delatar. Es un 202 y no un 201 porque el codigo no es un
  // recurso que se pueda pedir despues: queda aceptado para mandarse por mail.
  pedirCodigo(
    @CurrentTenant() tenant: TenantRequest,
    @Body() dto: PedirCodigoDto,
  ): Promise<CodigoPedidoDto> {
    return this.clientes.pedirCodigo(tenant, dto.email);
  }

  /** Entra con el codigo. Si es la primera vez, crea la cuenta. */
  @Publico()
  @Post('sesiones')
  @LimiteEstricto()
  @ApiCreatedResponse({ type: SesionClienteDto })
  @ApiUnauthorizedResponse({
    type: ErrorDto,
    description:
      'Codigo invalido, vencido, ya usado o con los intentos agotados.',
  })
  ingresar(@Body() dto: CrearSesionClienteDto): Promise<SesionClienteDto> {
    return this.clientes.ingresar(dto.email, dto.codigo);
  }

  /** El perfil de la clienta de la sesion. */
  @SoloClienta()
  @Get('me')
  @ApiOkResponse({ type: ClienteDto })
  findMe(@CurrentUsuario() usuario: UsuarioRequest): Promise<ClienteDto> {
    return this.clientes.findMe(usuario.id);
  }

  /** Edita nombre y telefono. El email no se cambia: es la identidad de la cuenta. */
  @SoloClienta()
  @Patch('me')
  @ApiOkResponse({ type: ClienteDto })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Datos invalidos.' })
  updateMe(
    @CurrentUsuario() usuario: UsuarioRequest,
    @Body() dto: UpdateClienteDto,
  ): Promise<ClienteDto> {
    return this.clientes.updateMe(usuario.id, dto);
  }
}
