// La unica puerta de entrada a la libreria: desde la app se importa solo esto, y una regla
// de ESLint lo exige. Es lo que la deja extraer a un paquete propio con un git mv.
export { MercadoPago, type MercadoPagoOptions } from './mercadopago.js';
export { redirectMercadoPagoApi } from './testing.js';
export * from './types.js';
