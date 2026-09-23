import {
  type ArgumentsHost,
  Catch,
  HttpException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { CodigoDeError } from './error.dto.js';

type Cuerpo = { code: CodigoDeError; message: string };

/** El cuerpo de los errores que genera el framework y no nuestro codigo. */
const GENERICOS: Record<number, Cuerpo> = {
  400: { code: 'validation_error', message: 'Revisa los datos enviados.' },
  404: { code: 'not_found', message: 'Esa ruta no existe.' },
  413: {
    code: 'payload_too_large',
    message: 'El cuerpo de la peticion es demasiado grande.',
  },
  429: {
    code: 'too_many_requests',
    message:
      'Hiciste demasiadas peticiones seguidas. Proba de nuevo en un minuto.',
  },
};

const INTERNO: Cuerpo = {
  code: 'internal_error',
  message: 'Algo fallo de nuestro lado. Proba de nuevo.',
};

/**
 * Un solo contrato de error en toda la API: `{ code, message }`.
 *
 * Nuestro codigo ya tira excepciones con ese cuerpo. Lo que no lo tenia eran los errores
 * del framework: un JSON roto devolvia el mensaje del parser en ingles, una ruta inexistente
 * repetia el path pedido, el throttler devolvia un string y un body gigante un objeto con
 * otra forma. El front tenia que ramificar por status en esos casos y por `code` en el resto.
 */
@Catch()
export class ErroresFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Errores');

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      const cuerpo = exception.getResponse();
      if (typeof cuerpo === 'object' && 'code' in cuerpo) {
        return super.catch(exception, host);
      }
      return this.responder(exception.getStatus(), host);
    }
    // Los errores del body parser de express no son HttpException: traen su status propio.
    const status = (exception as { statusCode?: unknown } | null)?.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return this.responder(status, host);
    }
    // Un error que nadie contemplo: entero al log, y a quien llama un mensaje sin detalles.
    this.logger.error(exception);
    super.catch(new HttpException(INTERNO, 500), host);
  }

  private responder(status: number, host: ArgumentsHost): void {
    const cuerpo = GENERICOS[status] ?? {
      code: 'http_error',
      message: 'No pudimos procesar la peticion.',
    };
    super.catch(new HttpException(cuerpo, status), host);
  }
}
