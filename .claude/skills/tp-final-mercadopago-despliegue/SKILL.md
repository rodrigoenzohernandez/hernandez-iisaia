---
name: tp-final-mercadopago-despliegue
description: Configura y diagnostica Mercado Pago en el despliegue de tp-final (API en Render, front en Vercel, base en Supabase) con cuentas de prueba. Usala cuando haya que cargar o revisar las variables MP_* en Render, configurar la app en el panel de Mercado Pago (URL de vuelta, PKCE, webhook), o cuando en lo desplegado falle "Conectar con Mercado Pago", "Subir al Profesional" o el pago de una reserva — aunque el pedido solo diga "Mercado Pago no anda en prod", "payment_provider_unavailable", "algo anduvo mal en el checkout" o "qué credenciales van en Render".
---

# Mercado Pago en el despliegue de tp-final

La guía corta está en `tp-final/README.md`, sección *Desplegado: Supabase, Render y Vercel*.
Esta skill es el procedimiento y lo que se aprendió configurándolo: la primera vez llevó tres
intentos, y cada uno falló por una confusión que el panel de Mercado Pago no aclara.

## La regla que explica casi todo

Tp-final es un **marketplace**: la plataforma tiene una app de Mercado Pago y cada centro
conecta su cuenta por OAuth. Mercado Pago **no mezcla cuentas reales con cuentas de prueba** en
ningún cobro, y para eso cuenta también la **dueña de la app**. Para probar, las tres cuentas
son de prueba, distintas y del mismo país:

| Papel | Cuenta | Para qué |
| --- | --- | --- |
| Integradora | de prueba, dueña de la app de la plataforma | sus credenciales van en Render; cobra las suscripciones |
| Vendedora | de prueba | la que autoriza "Conectar con Mercado Pago" en un centro |
| Compradora | de prueba | la que paga las reservas |

Las tres se crean desde la cuenta real, en *Tus integraciones → Cuentas de prueba*. Una cuenta
de prueba no crea otras. Ninguna se puede pagar a sí misma.

Si la app es de la cuenta real, **conectar el centro anda igual** (OAuth no mueve plata), y por
eso la confusión dura: la suscripción da `400 Both payer and collector must be real or test
users` y el checkout falla con un `service_error` sin causa.

## Variables

En Render, servicio `pasate` → Environment. Las cinco de Mercado Pago salen de **la app de la
integradora**, logueada con ella en el panel:

| Variable | De dónde |
| --- | --- |
| `MP_CLIENT_ID` | *Credenciales de producción* → Client ID (no el "N.º de la aplicación" de las de prueba) |
| `MP_CLIENT_SECRET` | *Credenciales de producción* → Client Secret (solo existe ahí) |
| `MP_PLATFORM_ACCESS_TOKEN` | *Credenciales de producción* → Access Token |
| `MP_WEBHOOK_SECRET` | *Webhooks* → Clave secreta |
| `MP_REDIRECT_URI` | `https://pasate.vercel.app/mercadopago/vuelta` |

"De producción" de una cuenta de prueba no mueve plata: es lo que la documentación de Mercado
Pago indica para Checkout Pro y Suscripciones. Además, en Render: `PUBLIC_API_URL`,
`FRONTEND_URL`, `CORS_ORIGIN` y `TRUST_PROXY=3`. Hoy también `NODE_ENV=staging`, que pisa el
`production` del Dockerfile y afloja los chequeos de arranque de `env.ts`. En Vercel:
`NEXT_PUBLIC_API_BASE_URL=https://hernandez-iisaia.onrender.com/api/v1`, que se hornea en el
build.

**`MP_OAUTH_TEST_TOKEN` no se carga.** Con ella el centro queda con un token `TEST-`, el checkout
abre en `sandbox.mercadopago.com.ar` y el pago falla, logueada o como invitada.

Guardar en Render redespliega. Hay que cargar las variables de una vez: con
`MP_PLATFORM_ACCESS_TOKEN` y sin `MP_WEBHOOK_SECRET`, la API no arranca.

## En el panel de la app de la integradora

- **Editar la app → URLs de redireccionamiento:** la de `MP_REDIRECT_URI`, exacta, y **PKCE**
  activado. Sin eso, Mercado Pago muestra "La aplicación no está preparada para conectarse".
- **Webhooks → pestaña Modo productivo:** `https://hernandez-iisaia.onrender.com/api/v1/webhooks/mercadopago`
  con el evento *Planes y suscripciones*. La pestaña de pruebas queda vacía. Los cobros de los
  centros no van acá: cada checkout lleva su propia `notification_url`.

La URL de vuelta del OAuth no es un webhook: van en lugares distintos.

## Probar, en este orden

1. **Que la API arrancó:** en los logs de Render, `Nest application successfully started` sin
   errores de `env.ts`. Además, `curl -X POST .../api/v1/webhooks/mercadopago -d '{}'` tiene
   que dar `401 invalid_signature`: el secreto está cargado.
2. **Conectar:** en incógnito, logueada en mercadopago.com.ar como la **vendedora**, porque
   Mercado Pago autoriza con la sesión que haya abierta y no deja elegir. Después apretar
   "Conectar con Mercado Pago" en el panel del centro.
3. **Subir al Profesional.**
4. **Pagar una reserva:** en otra ventana de incógnito, logueada como la **compradora**, con
   **tarjeta**: Mastercard `5031 7557 3453 0604`, CVV `123`, vencimiento `11/30`, titular
   `APRO`, DNI `12345678`. *Dinero en cuenta*, que Mercado Pago ofrece primero, falla.
5. **Que llegó el aviso:** en los logs, `Aviso sin firma verificable en <slug>` en nivel DEBUG
   es normal para los cobros de los centros. La API no confía en el cuerpo del aviso y le
   pregunta el pago a Mercado Pago.

## Diagnóstico

Cuando Mercado Pago responde con un error, la API deja en el log de Render
`WARN [MercadoPago] MP respondio <status>: <mensaje> <causas>`. Leelo antes de suponer.

| Síntoma | Causa |
| --- | --- |
| "La aplicación no está preparada para conectarse" | falta la URL de vuelta exacta o PKCE en la app |
| `payment_provider_unavailable` y en el log `Both payer and collector must be real or test users` | la app, o el `MP_PLATFORM_ACCESS_TOKEN`, es de una cuenta real |
| Checkout en `sandbox.` con "Oh, no, algo anduvo mal" | `MP_OAUTH_TEST_TOKEN` cargada: sacarla y reconectar el centro |
| Checkout sin `sandbox.` con `service_error` | la app es de una cuenta real (mirar `client_id` en el JSON del error), o se pagó con dinero en cuenta |
| `Not found 'card_token_id'` | compradora logueada contra un checkout de sandbox: mismo arreglo que el anterior |
| No deja desconectar: "Tu plan cobra con esta cuenta" | primero bajar al Básico |
| No deja desconectar: "pagos en curso" | hay un link de pago abierto: vence a los 20 minutos |

El JSON del error del checkout (devtools → la respuesta de la página de error) trae
`client_id`, `collector_id`, `payer_id`, `payment_method_id` y `liveMode`: alcanza para saber
qué app, qué cuentas y qué medio participaron.

**Cambiar de app obliga a reconectar.** El token de cada centro queda atado a la app que lo
emitió: hay que bajar al Básico, desconectar y volver a conectar.

## Límites para el agente

- Los secretos (Client Secret, Access Token, clave del webhook, `ENCRYPTION_KEY`) los pega la
  persona en Render. El agente carga los valores que no son secretos y lee los logs.
- El hook del plugin de Mercado Pago bloquea leer los `.env` y los comandos que mencionan
  tokens. Para saber qué variables hay sin ver los valores, un script en el scratchpad que
  parsee el archivo e imprima solo los nombres.
- Pagar y autorizar en Mercado Pago lo hace la persona, en un navegador común.
