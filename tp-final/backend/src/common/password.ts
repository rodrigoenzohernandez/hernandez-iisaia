import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Sin decoradores en este archivo a proposito: lo importa prisma/seed.ts, que corre con
// `node prisma/seed.ts` (type stripping de Node 24) y no soporta decoradores. Si
// hashPassword viviera junto a un @Injectable, el seed explotaria al importarlo.

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  largo: number,
) => Promise<Buffer>;

const ALGORITMO = 'scrypt';
const LARGO_SALT = 16;
const LARGO_HASH = 64;

/**
 * Hashea una contrasena con scrypt de node:crypto. Formato guardado:
 * `scrypt$<saltHex>$<hashHex>`.
 *
 * Asincronica y no scryptSync: scrypt tarda decenas de milisegundos y el login es un
 * endpoint publico, asi que la version sincronica bloquea el event loop de Node —uno solo
 * para todo el proceso— y un flood de logins anonimos congela la API para todos los centros.
 * La version asincronica lo delega al threadpool de libuv.
 *
 * ponytail: N es el default de Node (16384), por debajo de la recomendacion actual de OWASP
 * (2^17). Con la contrasena aleatoria de 18 bytes que genera el seed el margen sobra; si
 * alguna vez la elige una persona, subir el costo es un parametro mas en scrypt.
 * Nada de bcrypt ni argon2: son modulos nativos que se rompen cuando sube la version de
 * Node, justo lo que no se quiere con engines node 24 la semana de la demo.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(LARGO_SALT);
  const hash = await scryptAsync(password, salt, LARGO_HASH);
  return `${ALGORITMO}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Compara en tiempo constante: una comparacion con === filtra el hash por timing. */
export async function verifyPassword(
  password: string,
  guardado: string,
): Promise<boolean> {
  const [algoritmo, saltHex, hashHex] = guardado.split('$');
  if (algoritmo !== ALGORITMO || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtenido = await scryptAsync(
    password,
    Buffer.from(saltHex, 'hex'),
    esperado.length,
  );
  return (
    esperado.length === obtenido.length && timingSafeEqual(esperado, obtenido)
  );
}
