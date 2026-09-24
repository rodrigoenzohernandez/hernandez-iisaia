const API = 'https://api.mercadopago.com';

/**
 * Redirige a otra URL base todas las llamadas que el SDK le hace a la API de MP. Es para
 * probar contra un mock: el SDK tiene la URL fija en el codigo y no la deja configurar, asi
 * que se envuelve el fetch global, que el SDK usa en cada request.
 *
 * Solo para pruebas. Quien la llama es responsable de no hacerlo en produccion.
 */
export function redirectMercadoPagoApi(baseUrl: string): void {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : null;
    return original(
      url?.startsWith(API) ? `${baseUrl}${url.slice(API.length)}` : input,
      init,
    );
  };
}
