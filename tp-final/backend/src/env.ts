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

export const env = {
  databaseUrl: requerido('DATABASE_URL'),
  jwtSecret: requerido('JWT_SECRET'),
  port: Number(process.env.PORT ?? 3100),
  // Peticiones por minuto permitidas en los dos endpoints publicos que escriben. Es
  // configurable por una sola razon: verificacion/verificar.sh hace unas 25 altas seguidas y
  // con el default se limitaria a si mismo. El limite real se prueba aparte, con
  // verificacion/verificar-limite.sh contra la configuracion de default.
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 5),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3101').split(','),
};
