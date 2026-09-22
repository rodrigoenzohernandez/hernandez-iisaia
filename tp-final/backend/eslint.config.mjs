// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const PRISMA_RAW = ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe'];

export default tseslint.config(
  // Se ignora a si mismo: con projectService, un archivo fuera del tsconfig hace fallar al
  // parser, y no hay nada que linterar en 30 lineas de config.
  { ignores: ['dist', 'node_modules', 'eslint.config.mjs'] },
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
    },
  },
);
