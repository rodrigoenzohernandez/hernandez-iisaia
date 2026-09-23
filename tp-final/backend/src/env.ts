// Se importa PRIMERO en main.ts: carga y valida el entorno antes de que cualquier modulo
// lea process.env. Sin @nestjs/config ni dotenv, porque loadEnvFile es stdlib en Node 24.
try {
  process.loadEnvFile();
} catch {
  // Sin .env: en CI las variables ya vienen del entorno.
}

const requerido = (clave: string): string => {
  const valor = process.env[clave];
  // Fail-fast al arranque. El `?? 'secret'` de los ejemplos es el unico bug que haria
  // irrelevante a todo el resto del diseno: con el secreto conocido se forja un token de
  // administrador de cualquier centro.
  if (!valor) throw new Error(`Falta la variable de entorno ${clave}`);
  return valor;
};

const produccion = process.env.NODE_ENV === 'production';

const jwtSecret = requerido('JWT_SECRET');
// Un secreto corto se rompe por fuerza bruta offline con un solo token capturado.
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET necesita 32 caracteres o mas');
}

// Cifra los tokens de Mercado Pago y firma los codigos de ingreso. 32 bytes exactos: es la
// clave de AES-256, y una clave corta no se estira, se rechaza.
const encryptionKey = requerido('ENCRYPTION_KEY');
if (Buffer.from(encryptionKey, 'base64').length !== 32) {
  throw new Error(
    'ENCRYPTION_KEY tiene que ser 32 bytes en base64: openssl rand -base64 32',
  );
}

const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3101').split(
  ',',
);
if (
  produccion &&
  corsOrigin.some((o) => o === '*' || !o.startsWith('https://'))
) {
  throw new Error(
    'En produccion, CORS_ORIGIN solo acepta origenes https y nunca *',
  );
}

/**
 * Cuantos saltos de proxy creerle a X-Forwarded-For. Sin default a proposito: detras de un
 * proxy sin esta variable, todas las requests traen la IP del proxy y el limite de
 * peticiones se comparte entre todos; prendido sin proxy, cualquiera falsifica el header y
 * se saltea el limite.
 */
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy !== undefined && !/^\d+$/.test(trustProxy)) {
  throw new Error(
    'TRUST_PROXY tiene que ser la cantidad de proxies, un entero',
  );
}

/**
 * Proveedor de mails. `log` imprime cada mail en la consola, que es lo que hace falta en
 * desarrollo para ver el codigo de ingreso de una clienta; en produccion no se acepta.
 */
const emailProvider = process.env.EMAIL_PROVIDER ?? 'log';
if (emailProvider !== 'log' && emailProvider !== 'resend') {
  throw new Error('EMAIL_PROVIDER tiene que ser log o resend');
}
if (produccion && emailProvider !== 'resend') {
  throw new Error('En produccion EMAIL_PROVIDER tiene que ser resend');
}

/**
 * Solo para la verificacion: redirige el SDK de Mercado Pago a un mock. En produccion haria
 * que la plata de verdad se "cobrara" contra un servidor de prueba, asi que no se acepta.
 */
const mpApiUrl = process.env.MP_API_URL;
if (produccion && mpApiUrl) {
  throw new Error(
    'MP_API_URL es solo para pruebas y no se acepta en produccion',
  );
}

// Mercado Pago exige HTTPS en notification_url y en back_urls. Una URL que no lo es se omite
// al crear el checkout; en produccion, directamente no se acepta.
const publicApiUrl = process.env.PUBLIC_API_URL;
const frontendUrl = process.env.FRONTEND_URL;
if (
  produccion &&
  [publicApiUrl, frontendUrl].some((u) => u && !u.startsWith('https://'))
) {
  throw new Error(
    'En produccion, PUBLIC_API_URL y FRONTEND_URL tienen que ser https',
  );
}

export const env = {
  databaseUrl: requerido('DATABASE_URL'),
  jwtSecret,
  encryptionKey,
  port: Number(process.env.PORT ?? 3100),
  // Peticiones por minuto permitidas en las escrituras publicas. Es configurable por una
  // sola razon: verificacion/verificar.sh hace decenas de altas seguidas y con el default se
  // limitaria a si mismo. El limite real se prueba aparte, con
  // verificacion/verificar-limite.sh contra la configuracion de default.
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 5),
  corsOrigin,
  trustProxy: trustProxy === undefined ? undefined : Number(trustProxy),
  email: {
    provider: emailProvider,
    resendApiKey:
      emailProvider === 'resend' ? requerido('RESEND_API_KEY') : undefined,
    // Sin dominio verificado, Resend solo deja mandar desde onboarding@resend.dev y solo a
    // la cuenta duenia de la API key.
    from: process.env.EMAIL_FROM ?? 'Turnos <onboarding@resend.dev>',
  },
  /**
   * Mercado Pago. Todo opcional: sin credenciales la API arranca igual y los centros quedan
   * sin cobro online, como en el MVP.
   */
  mercadoPago: {
    apiUrl: mpApiUrl,
    // La app de la plataforma, en modo Marketplace: conecta las cuentas de los centros.
    clientId: process.env.MP_CLIENT_ID,
    clientSecret: process.env.MP_CLIENT_SECRET,
    redirectUri: process.env.MP_REDIRECT_URI,
    // La cuenta de la plataforma: cobra las suscripciones de los centros.
    platformAccessToken: process.env.MP_PLATFORM_ACCESS_TOKEN,
    webhookSecret: process.env.MP_WEBHOOK_SECRET,
  },
  publicApiUrl,
  frontendUrl,
  // Pisa el intervalo de todas las tareas periodicas. Solo para la verificacion, que no
  // puede esperar diez minutos a un recordatorio.
  jobsIntervalMs: process.env.JOBS_INTERVAL_MS
    ? Number(process.env.JOBS_INTERVAL_MS)
    : undefined,
};
