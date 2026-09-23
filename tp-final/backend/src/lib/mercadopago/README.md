# Librería de Mercado Pago

Para que un proyecto cobre con Mercado Pago **sin conocer la API de Mercado Pago**. El proyecto
habla de cobros, suscripciones, cuentas conectadas y eventos; la librería lo traduce a
preferencias, preapprovals, formatos de webhook, firmas, idempotency keys y decimales.

Está construida sobre el SDK oficial (`mercadopago`, pineado en **3.6.1**; el SDK no publica una
línea LTS). No depende de ningún framework ni ORM y no guarda nada: tokens, pagos y eventos
procesados quedan en la base de cada proyecto.

**Qué abstrae y qué no.** Abstrae la API de Mercado Pago. No abstrae a Mercado Pago como
proveedor: no es una capa para cambiarlo por otro. Si algún día hay un segundo proveedor, esa
interfaz va arriba de esta librería.

## Las cuatro capacidades

```ts
import { MercadoPago } from './lib/mercadopago/index.js';

// Una instancia por cuenta: la de un vendedor conectado, o la propia.
const mp = new MercadoPago({ accessToken, notificationUrl });
```

### 1. Cobros únicos (Checkout Pro)

```ts
const checkout = await mp.createCheckout({
  reference: 'pedido-123',      // vuelve en cada pago y en cada aviso
  title: 'Seña',
  amountCents: 540_000,         // siempre centavos enteros
  payerEmail,
  expiresAt,                    // despues de esto MP no acepta el pago
  backUrls,                     // HTTPS: MP rechaza http
  onlyInstantMethods: true,     // sin Rapipago ni Pago Facil
});
// checkout.url -> redirigir a quien paga

const pago = await mp.getPayment(id);         // estado normalizado, montos en centavos
await mp.refund(id, { amountCents, idempotencyKey });   // total si no hay amountCents
```

### 2. Suscripciones (preapproval)

Una suscripción mensual **sin plan asociado**, pendiente hasta que quien paga la autoriza en
`url`. Es la única variante que no exige tokenizar una tarjeta en el front, y la única que ata
la suscripción a `reference` sin adivinar por email.

```ts
const sub = await mp.createSubscription({
  reference: 'cliente-42',
  reason: 'Plan Pro',
  amountCents: 1_990_000,
  payerEmail,                   // TIENE que ser el de la cuenta de MP que paga
  backUrl,
});
await mp.getSubscription(sub.id);
await mp.cancelSubscription(sub.id);         // irreversible en MP
await mp.getSubscriptionCharge(idDeCobro);   // cada cobro mensual
```

### 3. Cuentas conectadas (OAuth, modelo marketplace)

```ts
const oauth = MercadoPago.oauth({ clientId, clientSecret, redirectUri, platformAccessToken });
const verifier = oauth.newVerifier();                     // PKCE: guardarlo hasta el canje
const url = oauth.authorizationUrl(state, verifier);      // challenge S256
const cuenta = await oauth.connect(code, verifier);       // accessToken, refreshToken, userId...
const renovada = await oauth.refresh(cuenta.refreshToken); // el refresh viejo deja de servir
```

### 4. Webhooks

```ts
const evento = await mp.parseWebhook(
  { headers, query, body },
  { secret, signature: 'required' },  // 'optional' para avisos por notification_url
);
switch (evento.type) {
  case 'payment':             /* evento.payment, ya consultado a MP */ break;
  case 'subscription':        /* evento.subscription */ break;
  case 'subscription_charge': /* evento.charge */ break;
  case 'ignored':             /* evento.reason */ break;
}
```

`parseWebhook` sigue estos pasos:
1. Verifica la firma.
2. Entiende los dos formatos que manda MP, webhook e IPN.
3. **Trae el recurso actualizado de MP.** El body del aviso no se usa nunca como fuente, así que
   un aviso falso solo puede hacer que se consulte algo real.
4. Devuelve el evento normalizado.

Un id que la cuenta no ve vuelve como `ignored`.

MP reintenta cada aviso durante días. Como el evento trae el estado actual, procesarlo dos veces
tiene que dar lo mismo: escribir estados, no incrementos.

## Instalación en Mercado Pago

1. **Crear la app** en Tus integraciones. Para cobrar en nombre de otras cuentas, el modelo de
   integración es **Marketplace**, y la cuenta dueña necesita KYC nivel 6.
2. **Registrar la URL de redirect.** Es fija, en HTTPS, y es la página del front que recibe
   `code` y `state`. Todo lo variable viaja en `state`.
3. **Activar PKCE** en los detalles de la app.
4. **Webhooks.**
   - Para los cobros no hace falta tocar el panel: cada checkout lleva su `notification_url`.
   - Para las suscripciones sí, porque MP no acepta `notification_url` en una preapproval: en
     Tus integraciones → Webhooks, cargar la URL y tildar `payment`, `subscription_preapproval`
     y `subscription_authorized_payment`.
   - Ahí MP genera el **secreto de la firma**. No encontré una API para registrar los webhooks
     por código.

## Credenciales de prueba

- **Credenciales.** Las de prueba de la app, que MP genera solas desde noviembre de 2025 con
  prefijo `APP_USR`, o las de una cuenta vendedora de prueba.
- **Pagar.** Logueada como compradora de prueba (Tus integraciones → Cuentas de prueba), en una
  pestaña de incógnito, con las tarjetas de prueba: titular `APRO` aprueba, `OTHE` rechaza.
- **Cuentas.** Compradora y vendedora tienen que ser del mismo país.

## Trampas que resuelve

| Trampa | Qué hace la librería |
|---|---|
| **SDK #481**: la idempotency key de una escritura queda pegada en la configuración compartida y viaja en todas las siguientes. Un segundo reembolso volvía como el primero, sin error. | Una configuración del SDK por operación. |
| **#480**: desde el 2/9/2026, en Argentina, el `init_point` de una suscripción sin plan trae `activation=true` y abre "Esta página no existe". | Saca el parámetro. Hay que quitar el parche cuando MP lo arregle. |
| MP documenta `canceled` y manda `cancelled`. | Acepta los dos. |
| La plata viaja en decimales. | Centavos enteros en toda la API. |
| Los tipos del SDK tienen todo opcional. | Tipos chicos y estrictos. |
| El SDK no tipa PKCE. | Genera el challenge S256 y lo agrega a la URL. |
| Errores de SDK con muchas formas. | Un solo `MercadoPagoError`, con `retryable` para 423, 424, 429, 5xx y red. |
| La firma usa el `data.id` del query, no el del body. | Lo toma del query, con el validador del propio SDK. |
| Un estado nuevo de MP podría confirmar un cobro. | Todo estado desconocido cae en `pending`. |

## Probar contra un mock

El SDK tiene la URL base fija en el código. Para probar sin salir a internet:

```ts
import { redirectMercadoPagoApi } from './lib/mercadopago/index.js';
redirectMercadoPagoApi('http://localhost:3199');  // solo en pruebas
```

Así el código real del SDK le habla a un servidor propio. Este proyecto usa
`verificacion/mercadopago-mock.mjs`.

## Lo que todavía no cubre

- Tarjeta embebida (Bricks, con la Orders API).
- Cobro presencial (QR y Point).
- Comisión de la plataforma por cobro (`marketplace_fee`).
- Pausar una suscripción o cambiarle el monto.

Se suma cuando un proyecto lo necesite, sobre el mismo cliente y el mismo `parseWebhook`.

## Extraerla

La carpeta no importa nada de fuera de sí misma, y una regla de ESLint lo garantiza. Extraerla
lleva tres pasos:
1. `git mv` a un repo propio.
2. Un `package.json` con `mercadopago@3.6.1` como dependencia.
3. Tests propios. Hoy la cubre la verificación de este proyecto, que prueba los caminos que este
   proyecto usa y nada más.
