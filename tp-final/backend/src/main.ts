// PRIMERO: env valida el entorno y reflect-metadata habilita los decoradores. Los imports se
// hoistean, asi que cualquier modulo que lea process.env ya lo encuentra cargado.
import './env.js';
import 'reflect-metadata';

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { construirOpenApi } from './openapi.js';
import { AppModule } from './app.module.js';
import { env } from './env.js';
import { TenantContext } from './tenancy/tenant-context.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.corsOrigin });

  // Middleware de express pelado, antes del router de Nest: abre el AsyncLocalStorage para
  // toda la request. El guard lo llena y la extension de Prisma lo lee en cada query.
  app.use((_req: unknown, _res: unknown, next: () => void) =>
    TenantContext.run(next),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // No es cosmetico: es lo que hace que un body con "tenantId" devuelva 400 en vez de
      // que el campo llegue al create y lo pise la extension en silencio.
      forbidNonWhitelisted: true,
      transform: true,
      // Un solo contrato de error en toda la API: { code, message }, y el mensaje en
      // espanol. forbidNonWhitelisted genera su propio texto en ingles
      // ("property X should not exist"), asi que ese caso se reescribe.
      exceptionFactory: (errores) => {
        const primero = errores[0];
        const constraints = Object.entries(primero?.constraints ?? {});
        const [clave, texto] = constraints[0] ?? [];
        const message =
          clave === 'whitelistValidation'
            ? `El campo "${primero?.property ?? ''}" no existe en este endpoint.`
            : (texto ?? 'Revisa los datos enviados.');
        return new BadRequestException({ code: 'validation_error', message });
      },
    }),
  );

  SwaggerModule.setup('docs', app, construirOpenApi(app), { useGlobalPrefix: true });

  await app.listen(env.port);
}


void bootstrap();
