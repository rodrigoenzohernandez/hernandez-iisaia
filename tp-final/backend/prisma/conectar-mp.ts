/**
 * Conecta un centro a una cuenta de Mercado Pago de PRUEBA, sin pasar por OAuth.
 *
 *   npm run mp:conectar-prueba -- <slug>
 *
 * Toma SEED_MP_ACCESS_TOKEN, SEED_MP_PUBLIC_KEY y SEED_MP_USER_ID del entorno y escribe la
 * misma fila que dejaria OAuth, con el token cifrado: el resto de la API no distingue una
 * cuenta de la otra. Sin refresh token, asi que la renovacion la saltea.
 *
 * Como el seed, usa PrismaClient crudo: no hay request ni contexto de tenant.
 */
import type { PrismaClient } from '@prisma/client';
import { crearCripto } from '../src/common/cifrado.ts';

type Credenciales = { accessToken: string; publicKey: string; userId: string };

/**
 * Las credenciales de prueba del entorno, o null si no hay. Token y user id van juntos: con
 * uno solo, falla en vez de dejar al centro sin Mercado Pago en silencio. La public key es
 * opcional porque Checkout Pro no la usa; hace falta el dia que se sume un Brick.
 */
export function credencialesDePrueba(): Credenciales | null {
  const accessToken = process.env.SEED_MP_ACCESS_TOKEN;
  const userId = process.env.SEED_MP_USER_ID;
  if (!accessToken && !userId) return null;
  if (!accessToken || !userId) {
    throw new Error(
      'Las credenciales de prueba van juntas: SEED_MP_ACCESS_TOKEN y SEED_MP_USER_ID',
    );
  }
  return {
    accessToken,
    publicKey: process.env.SEED_MP_PUBLIC_KEY ?? '',
    userId,
  };
}

export async function conectarCuentaDePrueba(
  prisma: PrismaClient,
  tenantId: string,
  c: Credenciales,
): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Las cuentas de prueba no se conectan en produccion.');
  }
  const clave = process.env.ENCRYPTION_KEY;
  if (!clave) throw new Error('Falta ENCRYPTION_KEY');
  const datos = {
    mpUserId: c.userId,
    accessTokenCifrado: crearCripto(clave).cifrar(
      c.accessToken,
      'tokens-de-mercado-pago',
    ),
    refreshTokenCifrado: null,
    publicKey: c.publicKey,
    scope: 'prueba',
    liveMode: false,
    expiraAt: null,
    requiereReconexion: false,
  };
  await prisma.cuentaMercadoPago.upsert({
    where: { tenantId },
    create: { tenantId, ...datos },
    update: datos,
  });
}

// Solo cuando se corre directo, no cuando lo importa el seed.
if (import.meta.main) {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  try {
    process.loadEnvFile();
  } catch {
    // Sin .env: las variables ya vienen del entorno.
  }
  const slug = process.argv[2];
  const credenciales = credencialesDePrueba();
  if (!slug || !credenciales) {
    console.error(
      'Uso: npm run mp:conectar-prueba -- <slug>, con SEED_MP_ACCESS_TOKEN, SEED_MP_PUBLIC_KEY y SEED_MP_USER_ID en el entorno.',
    );
    process.exit(1);
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`No existe el centro ${slug}`);
    process.exit(1);
  }
  await conectarCuentaDePrueba(prisma, tenant.id, credenciales);
  console.log(`${slug} conectado a la cuenta de prueba ${credenciales.userId}`);
  await prisma.$disconnect();
}
