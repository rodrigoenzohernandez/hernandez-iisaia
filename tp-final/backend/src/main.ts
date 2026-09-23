// PRIMERO: env valida el entorno y reflect-metadata habilita los decoradores. Los imports se
// hoistean, asi que cualquier modulo que lea process.env ya lo encuentra cargado.
import './env.js';
import 'reflect-metadata';

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { construirOpenApi } from './openapi.js';
import { AppModule } from './app.module.js';
import { ErroresFilter } from './common/errores.filter.js';
import { env } from './env.js';
import { TareasService } from './tareas/tareas.service.js';
import { TenantContext } from './tenancy/tenant-context.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Headers de seguridad antes que cualquier otra cosa, para que los lleven tambien las
  // respuestas de error. Entre otros, saca el X-Powered-By que anunciaba Express.
  app.use(helmet());
  if (env.trustProxy !== undefined) app.set('trust proxy', env.trustProxy);
  // Coincide con el default de express, y se escribe igual: es el tope de lo que se parsea, y
  // un default implicito es uno que se cambia sin darse cuenta.
  app.useBodyParser('json', { limit: '100kb' });

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    // La API autentica con Bearer y no con cookies: CORS sin credenciales, y por lo mismo
    // fuera del alcance de CSRF.
    credentials: false,
    maxAge: 600,
  });

  // Middleware de express pelado, antes del router de Nest: abre el AsyncLocalStorage para
  // toda la request. El guard lo llena y la extension de Prisma lo lee en cada query.
  app.use((_req: unknown, _res: unknown, next: () => void) =>
    TenantContext.run(next),
  );

  app.useGlobalFilters(new ErroresFilter(app.getHttpAdapter()));
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

  SwaggerModule.setup('docs', app, construirOpenApi(app), {
    useGlobalPrefix: true,
  });

  await app.listen(env.port);
  // Despues de listen y aca, no en un hook: el exportador del OpenAPI inicializa la app sin
  // levantar el servidor, y ahi no tiene que correr nada contra la base.
  app.get(TareasService).iniciar();
}

void bootstrap();
