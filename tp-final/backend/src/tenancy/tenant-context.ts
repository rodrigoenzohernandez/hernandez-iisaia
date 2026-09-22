import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * El tenant de la request en curso. Vive en un AsyncLocalStorage y no en un parametro:
 * ningun metodo de dominio recibe tenantId, porque es justo el parametro que, mal pasado a
 * un deleteMany, borra la agenda de otro centro.
 */
type Store = { tenantId?: string };

const storage = new AsyncLocalStorage<Store>();

export const TenantContext = {
  /** Envuelve la request entera. Arranca vacio; lo llena el guard. */
  run: <T>(fn: () => T): T => storage.run({}, fn),

  set: (tenantId: string): void => {
    const store = storage.getStore();
    if (!store) throw new Error('TenantContext.run() no envolvio esta request');
    store.tenantId = tenantId;
  },

  /** Falla cerrado: sin tenant en contexto no hay query, nunca una query sin filtrar. */
  require: (): string => {
    const tenantId = storage.getStore()?.tenantId;
    if (!tenantId) throw new Error('Query fuera de un contexto de tenant');
    return tenantId;
  },
};
