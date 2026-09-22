/**
 * Escribe el contrato OpenAPI en un archivo, sin levantar el servidor ni tocar la base.
 *
 * Existe para que quien consuma la API no necesite Docker, Postgres y el seed solo para
 * saber que endpoints hay: el archivo se versiona y se lee en el repo o se le da de comer a
 * un generador de cliente.
 *
 *   npm run spec
 */
import './env.js';
import 'reflect-metadata';

import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { construirOpenApi } from './openapi.js';

const SALIDA = 'openapi.json';

// `create` sin listen: arma el grafo de modulos, que es lo que Swagger necesita para leer
// los controllers. No abre ningun puerto y no consulta la base.
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api/v1');
await app.init();

writeFileSync(SALIDA, JSON.stringify(construirOpenApi(app), null, 2) + '\n');
console.log(`OpenAPI escrito en ${SALIDA}`);

await app.close();
