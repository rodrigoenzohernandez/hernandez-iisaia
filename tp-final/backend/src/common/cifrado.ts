import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

// Sin imports de la app a proposito, como password.ts: lo usa prisma/seed.ts, que corre con
// `node prisma/seed.ts` y no puede resolver el env de la API. La clave entra por parametro.

/** Para que se usa cada subclave. Una clave por uso: la misma no firma y cifra a la vez. */
export type Uso = 'tokens-de-mercado-pago' | 'estado-oauth';

/**
 * Firmas y cifrado a partir de ENCRYPTION_KEY. Cada uso tiene su subclave, derivada con HKDF.
 */
export function crearCripto(claveBase64: string) {
  const base = Buffer.from(claveBase64, 'base64');
  const subclave = (uso: string): Buffer =>
    Buffer.from(hkdfSync('sha256', base, Buffer.alloc(0), uso, 32));
  const claveCodigos = subclave('codigos-de-ingreso');

  return {
    /** HMAC-SHA256 en hex. Con clave y no un hash pelado: seis digitos se revierten en un segundo. */
    firmar: (texto: string): string =>
      createHmac('sha256', claveCodigos).update(texto).digest('hex'),

    /** Compara dos firmas en tiempo constante. */
    mismaFirma: (a: string, b: string): boolean => {
      const x = Buffer.from(a, 'hex');
      const y = Buffer.from(b, 'hex');
      return x.length === y.length && timingSafeEqual(x, y);
    },

    /**
     * AES-256-GCM: cifra y autentica. Un texto cifrado que alguien toco no se descifra mal,
     * no se descifra. Formato `v1.iv.tag.datos`, en base64url.
     */
    cifrar: (texto: string, uso: Uso): string => {
      const iv = randomBytes(12);
      const cifrador = createCipheriv('aes-256-gcm', subclave(uso), iv);
      const datos = Buffer.concat([
        cifrador.update(texto, 'utf8'),
        cifrador.final(),
      ]);
      return ['v1', iv, cifrador.getAuthTag(), datos]
        .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
        .join('.');
    },

    descifrar: (guardado: string, uso: Uso): string => {
      const [version, iv, tag, datos] = guardado.split('.');
      if (version !== 'v1' || !iv || !tag || !datos) {
        throw new Error('Texto cifrado con un formato desconocido');
      }
      const descifrador = createDecipheriv(
        'aes-256-gcm',
        subclave(uso),
        Buffer.from(iv, 'base64url'),
      );
      descifrador.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        descifrador.update(Buffer.from(datos, 'base64url')),
        descifrador.final(),
      ]).toString('utf8');
    },
  };
}
