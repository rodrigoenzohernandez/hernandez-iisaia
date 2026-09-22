// Prisma 7 movio la URL de la base y el comando de seed aca desde schema.prisma y
// package.json. Migrate lee esto; el cliente usa el driver adapter en tiempo de ejecucion.
// process importado explicitamente y no como global: este archivo queda fuera del
// tsconfig (corre con el type stripping de Node), asi que el import es lo que le da tipos.
import process from 'node:process';
import { defineConfig } from 'prisma/config';

// Prisma 7 ya no carga el .env por su cuenta, y este archivo se evalua entero en CADA
// comando de prisma, incluido el `generate` del postinstall. Sin esto, `npm install` sobre
// un clon recien bajado falla antes de que exista el .env.
try {
  process.loadEnvFile();
} catch {
  // Sin .env: en CI las variables ya vienen del entorno, y `generate` no necesita la URL.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Vacio y no `env('DATABASE_URL')`: el helper de Prisma tira al importar el archivo, asi
  // que romperia `generate`. Con la URL vacia, `generate` funciona y `migrate` falla con el
  // error de validacion de Prisma, que es donde la URL si hace falta.
  datasource: { url: process.env.DATABASE_URL ?? '' },
  migrations: { seed: 'node prisma/seed.ts' },
});
