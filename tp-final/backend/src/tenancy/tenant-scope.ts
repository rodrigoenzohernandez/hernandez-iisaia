import { Prisma } from '@prisma/client';
import { TenantContext } from './tenant-context.js';

/**
 * Extension de Prisma que sella el tenantId en el where y en el data de toda operacion.
 * Es la primera de las tres capas de aislamiento; las otras dos son el chequeo de arranque
 * de mas abajo y la FK compuesta de Reserva en el esquema.
 */
const COLUMNA = 'tenantId';
const RAIZ = 'Tenant';

const modelos = Prisma.dmmf.datamodel.models;
const conTenant = new Set(
  modelos
    .filter((m) => m.fields.some((f) => f.name === COLUMNA))
    .map((m) => m.name),
);

// Chequeo de arranque. Un modelo nuevo sin tenantId escaparia todos los filtros en silencio;
// asi la app no levanta y dice cual falta. El unico agujero silencioso del diseno se
// convierte en un crash al boot.
const sinTenant = modelos
  .map((m) => m.name)
  .filter((n) => n !== RAIZ && !conTenant.has(n));
if (sinTenant.length > 0) {
  throw new Error(
    `Modelos sin columna ${COLUMNA}: ${sinTenant.join(', ')}. ` +
      `Agregala, o sumalos a la excepcion de ${RAIZ} si de verdad son globales.`,
  );
}

// Las UNICAS operaciones que no aceptan where. Todo lo demas lleva el filtro de tenant.
//
// Es una deny-list y no una allow-list a proposito: la allow-list fallaba ABIERTO. Tenia
// catorce operaciones y no incluia updateManyAndReturn, que existe en el cliente generado y
// si acepta where, asi que esa llamada habria escrito sin filtrar. Con la deny-list, una
// operacion nueva de Prisma queda filtrada por default y el peor caso es un error de Prisma
// por un where que no acepta, no una escritura cruzada en silencio.
const SIN_WHERE = new Set(['create', 'createMany', 'createManyAndReturn']);

type Args = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

export const tenantScope = Prisma.defineExtension({
  name: 'tenantScope',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!conTenant.has(model)) return query(args);

        const tenantId = TenantContext.require();
        const sellar = (payload: Record<string, unknown>) => ({
          ...payload,
          tenantId,
        });
        const next = { ...(args as Args) };

        // tenantId va ULTIMO a proposito: un tenantId que venga del llamador se pisa, no se
        // mergea. En Prisma los campos de primer nivel del where se combinan con AND contra
        // cualquier OR interno, y { ...where, tenantId } es la unica forma valida para
        // findUnique / update / delete (extended where unique).
        if (!SIN_WHERE.has(operation)) next.where = { ...next.where, tenantId };
        if (next.data) {
          next.data = Array.isArray(next.data)
            ? next.data.map(sellar)
            : sellar(next.data);
        }
        if (next.create) next.create = sellar(next.create);
        if (next.update) next.update = sellar(next.update);

        return query(next);
      },
    },
  },
});
