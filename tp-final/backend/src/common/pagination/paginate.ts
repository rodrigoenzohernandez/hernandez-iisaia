import { BadRequestException } from '@nestjs/common';
import { CursorPageDto, CursorPageQueryDto } from './cursor-page.dto.js';

/**
 * WHERE de keyset: "la fila siguiente a esta tupla", en orden ascendente.
 * Para claves [a, b] y valores [x, y] produce:  a > x  OR  (a = x AND b > y).
 */
const despuesDe = (claves: string[], valores: string[]) => ({
  OR: claves.map((clave, i) => ({
    ...Object.fromEntries(claves.slice(0, i).map((k, j) => [k, valores[j]])),
    [clave]: { gt: valores[i] },
  })),
});

// Solo strings: el cursor es input publico que termina en un where de Prisma, y un numero en
// una columna de texto hace explotar la validacion como error no manejado. aValor serializa
// todo a string, asi que no se pierde nada.
const esTupla = (v: unknown, largo: number): v is string[] =>
  Array.isArray(v) &&
  v.length === largo &&
  v.every((x) => typeof x === 'string');

/**
 * Serializa un valor de clave para el cursor.
 *
 * Una fecha va como ISO-8601 COMPLETO y no recortada a YYYY-MM-DD: el valor vuelve al where
 * de Prisma, y Prisma rechaza un date-only en un campo DateTime aunque la columna sea DATE.
 * Recortarla hacia el cursor rompia la segunda pagina del listado de reservas con un 500.
 * El recorte para el wire se hace en el DTO de salida, que es otra cosa.
 */
const aValor = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : String(v);

/**
 * Pagina por cursor cualquier findMany de Prisma.
 *
 * Cursor y no offset por el dominio: las reservas se ordenan por fecha y hora, y las altas
 * entran en el MEDIO de ese orden. Con OFFSET, una reserva nueva para maniana corre todo un
 * lugar y la pagina siguiente repite una fila o saltea una, y una reserva salteada es una
 * clienta que llega y no esta anotada.
 *
 * Es keyset puro y no el `cursor`/`skip` de Prisma: ese no pasa por la extension de tenant,
 * asi que un cursor forjado con un id ajeno entraria crudo al findMany. Aca el where del
 * keyset va DENTRO del where del llamador, la extension lo sella, y la fuga se cierra por
 * construccion.
 *
 * `claves` son los campos por los que se ordena y SIEMPRE terminan en 'id': sin ese
 * desempate el orden no es total —con capacidad mayor a 1 hay reservas con la misma fecha y
 * hora— y el cursor saltea filas. El orderBy lo deriva esta funcion de `claves` y lo pasa al
 * callback, asi el orden y el cursor no pueden quedar desalineados.
 */
export async function paginate<T extends Record<string, unknown>>(
  query: CursorPageQueryDto,
  claves: string[],
  find: (pagina: {
    take: number;
    where: object;
    orderBy: object[];
  }) => Promise<T[]>,
): Promise<CursorPageDto<T>> {
  let where: object = {};
  if (query.cursor) {
    let tupla: unknown;
    try {
      tupla = JSON.parse(
        Buffer.from(query.cursor, 'base64url').toString('utf8'),
      );
    } catch {
      // Base64 o JSON invalido: cae en el chequeo de abajo con tupla undefined.
    }
    if (!esTupla(tupla, claves.length)) {
      throw new BadRequestException({
        code: 'invalid_cursor',
        message: 'Ese cursor no es valido. Repeti la consulta sin cursor.',
      });
    }
    where = despuesDe(claves, tupla);
  }

  const orderBy = claves.map((k) => ({ [k]: 'asc' }));
  // take + 1 resuelve "hay pagina siguiente" sin un count() aparte.
  const filas = await find({ take: query.limit + 1, where, orderBy });
  const data = filas.slice(0, query.limit);
  const ultima = data.at(-1);
  const nextCursor =
    filas.length > query.limit && ultima
      ? Buffer.from(
          JSON.stringify(claves.map((k) => aValor(ultima[k]))),
        ).toString('base64url')
      : null;

  return { data, nextCursor };
}
