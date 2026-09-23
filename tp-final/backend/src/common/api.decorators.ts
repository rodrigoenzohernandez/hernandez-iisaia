import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from './decorators.js';
import { ErrorDto } from './error.dto.js';

/**
 * Declara el `tenantSlug` del path en el OpenAPI.
 *
 * Hace falta explicitamente: NestJS documenta solo los parametros que un metodo ata con
 * @Param(), y el slug no lo lee ningun controller —lo resuelve el guard— asi que quedaba
 * fuera del contrato. Un generador de cliente no puede armar la URL sin esto.
 */
export const ApiTenant = () =>
  applyDecorators(
    ApiParam({
      name: 'tenantSlug',
      // El type explicito no sobra: sin el, un cliente generado del spec tipa el parametro
      // como `unknown` y obliga a castear en cada llamada.
      type: String,
      description:
        'Identificador del centro en la URL, por ejemplo `lo-de-lili`.',
      example: 'lo-de-lili',
    }),
    ApiNotFoundResponse({
      type: ErrorDto,
      description: 'El centro no existe o esta inactivo.',
    }),
  );

/**
 * Marca una operacion como de administracion: pide token y documenta sus dos rechazos.
 *
 * Va por operacion y no a nivel de controller a proposito. Con @ApiBearerAuth en la clase,
 * el OpenAPI decia que el catalogo publico y el alta de reservas necesitaban token, que es
 * justo lo contrario de lo que hacen y lo primero que iba a leer quien integre el front.
 */
export const ApiSoloAdmin = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      type: ErrorDto,
      description: 'Falta el token o no es valido.',
    }),
    ApiForbiddenResponse({
      type: ErrorDto,
      description:
        'El token es de otro centro, o de una cuenta que no es de administracion.',
    }),
  );

/**
 * Ruta de clienta: exige su rol y documenta los rechazos. El rol y la documentacion van en el
 * mismo decorador para que no puedan desalinearse.
 */
export const SoloClienta = () =>
  applyDecorators(
    Roles('cliente'),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      type: ErrorDto,
      description: 'Falta el token o no es valido.',
    }),
    ApiForbiddenResponse({
      type: ErrorDto,
      description: 'El token es de otro centro, o no es de una clienta.',
    }),
  );

/** Ruta de la plataforma: exige el rol de superadmin y documenta los rechazos. */
export const SoloSuperadmin = () =>
  applyDecorators(
    Roles('superadmin'),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      type: ErrorDto,
      description: 'Falta el token o no es valido.',
    }),
    ApiForbiddenResponse({
      type: ErrorDto,
      description: 'El token no es de la plataforma.',
    }),
  );
