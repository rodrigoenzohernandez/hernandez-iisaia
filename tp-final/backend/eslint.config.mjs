// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const PRISMA_RAW = ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe'];

export default tseslint.config(
  // Se ignora a si mismo: con projectService, un archivo fuera del tsconfig hace fallar al
  // parser, y no hay nada que linterar en 30 lineas de config. Por lo mismo queda afuera
  // verificacion/, que tiene el mock de Mercado Pago en JavaScript pelado.
  { ignores: ['dist', 'node_modules', 'eslint.config.mjs', 'verificacion'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // La unica regla propia, y es de aislamiento, no de estilo: la extension de tenant
      // intercepta operaciones de modelo, no SQL crudo. Una query cruda se lleva las filas
      // de todos los tenants.
      // ponytail: solo ve `db.$queryRaw(...)`, no `db['$queryRaw'](...)`. Si alguien se toma
      // ese trabajo, el problema no es el linter.
      'no-restricted-properties': [
        'error',
        ...PRISMA_RAW.map((property) => ({
          property,
          message: 'El SQL crudo no pasa por la extension de tenant. Usa el cliente de Prisma.',
        })),
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Desde la app, la libreria de Mercado Pago se importa solo por su index: lo de adentro
      // puede cambiar el dia que se extraiga a un paquete.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/mercadopago/*', '!**/lib/mercadopago/index.js'],
              message: 'Importa la libreria de Mercado Pago desde su index.js.',
            },
          ],
        },
      ],
    },
  },
  {
    // El borde de la libreria: sin framework, sin ORM y sin nada de la app. Es lo que la deja
    // extraer a un paquete propio con un git mv.
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', '@prisma/*'],
              message: 'La libreria no depende del framework ni del ORM.',
            },
            {
              group: ['../../*'],
              message: 'La libreria no importa nada de la app.',
            },
          ],
        },
      ],
    },
  },
);
