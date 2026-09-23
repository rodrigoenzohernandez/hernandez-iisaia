import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';

/**
 * Una sola clave en el entorno y una subclave por uso, derivada con HKDF: la misma clave no
 * firma codigos y cifra tokens a la vez.
 */
const subclave = (uso: string): Buffer =>
  Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(env.encryptionKey, 'base64'),
      Buffer.alloc(0),
      uso,
      32,
    ),
  );

const CLAVE_CODIGOS = subclave('codigos-de-ingreso');

/** HMAC-SHA256 en hex. Con clave, y no un hash pelado: seis digitos se revierten en un segundo. */
export const firmar = (texto: string): string =>
  createHmac('sha256', CLAVE_CODIGOS).update(texto).digest('hex');

/** Compara dos firmas en tiempo constante. */
export const mismaFirma = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
};
