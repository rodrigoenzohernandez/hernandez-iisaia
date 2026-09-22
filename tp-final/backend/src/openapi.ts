import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { env } from './env.js';

/**
 * El documento OpenAPI. Vive en su propio modulo, y no en main.ts, porque el exportador a
 * archivo lo necesita sin que importarlo levante el servidor.
 */
export function construirOpenApi(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API de turnos')
      .setDescription(
        'SaaS multi-tenant de turnos para centros de estetica. Cada centro es un tenant y ' +
          'viaja en el path. Los montos son enteros en centavos. Las horas son hora de ' +
          'pared del centro, en formato HH:mm, y las fechas YYYY-MM-DD.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      // Solo el origen: los paths del documento ya incluyen el prefijo /api/v1, asi que
      // repetirlo aca haria que un cliente generado armara la URL dos veces.
      .addServer(`http://localhost:${env.port}`, 'Desarrollo local')
      .build(),
  );
}
