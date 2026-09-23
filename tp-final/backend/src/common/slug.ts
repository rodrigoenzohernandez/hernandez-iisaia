// Sin decoradores: lo importa prisma/seed.ts, que corre con el type stripping de Node.

/**
 * El formato del slug de un centro: minusculas, numeros y guiones, de 3 a 40 caracteres y
 * sin guion en las puntas. Es una regex y no una normalizacion porque el unique de Postgres
 * es byte-exacto: "Lo-De-Lili" y "lo-de-lili" convivirian como dos centros, y con homoglifos
 * Unicode se arma un slug que una persona lee igual que el de otro centro.
 */
export const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Slugs que chocarian con rutas del front o de la API, o que se prestan a suplantarlas. */
export const SLUGS_RESERVADOS = new Set([
  'admin',
  'api',
  'app',
  'ayuda',
  'docs',
  'login',
  'mercadopago',
  'panel',
  'planes',
  'plataforma',
  'precios',
  'registro',
  'soporte',
  'superadmin',
  'tenants',
  'webhooks',
  'www',
]);
