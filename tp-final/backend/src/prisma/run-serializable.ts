import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Db, Tx } from './prisma.module.js';

const MAX_INTENTOS = 3;

/** SQLSTATE 40001: serialization_failure. Es el unico error de esta transaccion que se reintenta. */
const SERIALIZATION_FAILURE = '40001';

/**
 * Detecta un conflicto de serializacion.
 *
 * Hay que mirar las dos formas, y no es defensivo de mas: con el driver adapter de Prisma 7
 * el conflicto NO llega como PrismaClientKnownRequestError con codigo P2034, llega como un
 * DriverAdapterError con `cause.originalCode: '40001'` y `cause.kind:
 * 'TransactionWriteConflict'`. Verificado con ocho altas simultaneas: mirando solo P2034 el
 * reintento no se disparaba nunca y el conflicto se escapaba como un 500.
 */
function esConflictoDeSerializacion(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034')
    return true;
  const causa = (e as { cause?: { originalCode?: string; kind?: string } })
    ?.cause;
  return (
    causa?.originalCode === SERIALIZATION_FAILURE ||
    causa?.kind === 'TransactionWriteConflict'
  );
}

/**
 * Corre fn en SERIALIZABLE y reintenta si Postgres aborta por conflicto de serializacion.
 *
 * Es el mecanismo que evita pasarse de la capacidad de una ventana sin una constraint de
 * base: FOR UPDATE y los advisory locks necesitan SQL crudo, y un unique parcial solo
 * expresaria cupos por hora de inicio, no ocupacion simultanea.
 *
 * ponytail: 3 intentos, sin backoff. La transaccion que gano ya commiteo, asi que el
 * reintento inmediato la ve y el segundo intento decide con datos frescos. Agregar backoff
 * cuando la tasa de conflictos se vea en logs.
 *
 * Con la tabla casi vacia Postgres resuelve la consulta con un seq scan, asi que SSI toma el
 * predicate lock sobre la relacion entera y una rafaga de altas simultaneas hace conflictuar
 * a casi todas entre si. Verificado: nunca entra una reserva de mas, ni siquiera sin
 * reintentos, porque Postgres aborta a la perdedora. Lo que aportan los reintentos es que la
 * perdedora vuelva con una respuesta util —un 201 si quedaba cupo, un 409 si no— en vez de
 * un error de infraestructura.
 */
export async function runSerializable<T>(
  db: Db,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      if (!esConflictoDeSerializacion(e)) throw e;
      if (intento >= MAX_INTENTOS) {
        // Agotar los reintentos es raro y no es culpa de quien reserva: se traduce a un 409
        // con un codigo que el front puede reconocer y reintentar, no a un 500.
        throw new ConflictException({
          code: 'high_contention',
          message:
            'Hubo muchas reservas al mismo tiempo. Proba de nuevo en unos segundos.',
        });
      }
    }
  }
}
