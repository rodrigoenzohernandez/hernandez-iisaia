# Perfil público del centro — diseño

Fecha: 2026-10-13. Salió de una sesión de `superpowers:brainstorming`: alcance, enfoque y las
tres secciones del diseño las aprobó Rodrigo antes de escribir este archivo.

## Por qué

Tres síntomas con la misma causa: ninguna ruta pública devuelve el centro por su slug.

- **El nombre es inventado.** El front lo deriva del slug: `lo-de-lili` se ve como "Lo De
  Lili". El nombre que la administradora cargó al registrar el centro no aparece en ninguna
  página pública.
- **Cualquier URL arma una landing.** `/cualquier-cosa` muestra un centro llamado "Cualquier
  Cosa" con el catálogo vacío: el `404 tenant_not_found` de la API se pierde en un `catch` y la
  página sigue como si el centro existiera.
- **El título es el de la plataforma.** Todas las páginas de un centro dicen "Turnos · agenda
  para centros de estética" en la pestaña y en la vista previa del link, que es lo que se
  comparte por WhatsApp.

## Alcance

Dentro:

- `GET /api/v1/tenants/{slug}`, público, con el slug y el nombre.
- El nombre real en el encabezado, el pie, el encabezado del panel y el título de la pestaña.
- Una página 404 para el centro que no existe o está dado de baja.

Fuera, a propósito:

- Los horarios de atención en el pie. Las franjas siguen siendo privadas.
- Datos de contacto, que no existen en el modelo.
- Cachear la respuesta del perfil (ver *Límites conocidos*).
- `GET /tenants`, la lista: publicaría la cartera de clientes de la plataforma.

## Backend

**La ruta.** `GET /tenants/:tenantSlug`, marcada `@Publico()`, en `AltaCentroController`, el
controller de `/tenants`: es el mismo recurso, el `POST` lo crea y el `GET` lo lee. El comentario
del controller que dice "sigue sin haber GET /tenants" pasa a aclarar que no hay lista, pero sí
el detalle de uno.

**La respuesta.** `CentroPublicoDto { slug, nombre }`, armado con `@CurrentTenant()`. El guard ya
buscó el centro para resolver el tenant, así que la ruta no consulta la base. No sale el id
(nunca sale por la API), ni el plan, ni la zona horaria, ni `activo`.

**Los errores no llevan código nuevo.** Los resuelve el guard:

| Caso | Respuesta |
| --- | --- |
| El centro existe y está activo | `200 { slug, nombre }` |
| El slug no existe | `404 tenant_not_found` |
| El centro está dado de baja | `404 tenant_not_found`, igual que si no existiera |
| Token de otro centro o de la plataforma | `403 wrong_tenant`, como cualquier ruta de un centro |

**Qué publica.** Nada que no se pudiera averiguar: `GET /tenants/{slug}/servicios` ya distingue
un centro activo (200) de uno que no existe (404). Lo nuevo es el nombre, que es el nombre
comercial que el centro muestra en su propia página.

**Límite de peticiones.** El global de lectura, 120 por minuto por IP. No lleva
`@LimiteEstricto`, que es para las escrituras públicas.

**El contrato.** `npm run spec` regenera `backend/openapi.json` y `npm run api:types` regenera
`frontend/src/lib/api.d.ts`. La guía de integración del post MVP suma la ruta.

## Front

**`lib/centro.ts`: `obtenerCentro(slug)`.** Envuelta en `React.cache`, así el layout, el
encabezado y el pie de un mismo render comparten una sola llamada. Devuelve:

- el centro, si la API contesta `200`;
- `null`, solo si la API contesta `tenant_not_found`;
- `{ slug, nombre: nombreDeSlug(slug) }` ante cualquier otra falla (API caída, 5xx, `429`): el
  sitio se arma igual con el nombre derivado, como hoy. Una caída de la API no puede convertir
  todos los centros en 404.

`nombreDeSlug` queda solo como ese respaldo. `lib/centro.ts` sigue siendo un módulo que solo
importan componentes de servidor: `React.cache` no memoiza en el navegador.

**`app/[slug]/layout.tsx`, nuevo.** Llama a `obtenerCentro`; con `null`, `notFound()`. Como el
layout cubre todo el segmento, el 404 alcanza a todas las páginas del centro, el panel
incluido, sin tocarlas. Su `generateMetadata` pone el nombre en el título con una plantilla:
`{ default: 'Lo de Lili', template: '%s · Lo de Lili' }`, así "Tu pago" se ve "Tu pago · Lo de
Lili".

**Los componentes.** `Encabezado`, `Pie` y `EncabezadoAdmin` pasan a ser componentes async de
servidor que leen el nombre de `obtenerCentro`. `Marca` lo recibe por prop y deja de conocer el
slug.

**`app/not-found.tsx`, nuevo.** En castellano y con la estética del sitio: que no se encontró la
página, que revise la dirección si buscaba un centro, y un link a la portada de la plataforma.
Va en la raíz porque el `notFound()` de un layout lo atrapa el segmento de arriba, no el propio.

## Pruebas

**Backend, con TDD.** Los casos van a `verificacion/verificar.sh` antes que el código, y se
corren en rojo:

1. `GET /tenants/lo-de-lili` da `200` y el cuerpo tiene exactamente las claves `nombre` y `slug`,
   con `"Lo de Lili"` y `"lo-de-lili"`.
2. `GET /tenants/no-existe` da `404 tenant_not_found`.
3. `GET /tenants/centro-cerrado` da `404 tenant_not_found`.
4. `GET /tenants/lo-de-lili` con el token de la administradora de `bella-piel` da `403
   wrong_tenant`.

El caso que ya existe, "ningún resumen es un párrafo", cubre el resumen de la ruta nueva en el
OpenAPI.

**Front.** No tiene framework de tests y no se suma uno para esto. El rojo y el verde son
chequeos con `curl` contra el servidor de Next, corridos antes y después del cambio:

- `/no-existe` y `/centro-cerrado` dan `404` (hoy dan `200`);
- el `<title>` de `/lo-de-lili` es "Lo de Lili" (hoy es el de la plataforma);
- el HTML de `/bella-piel` dice "Bella Piel".

**Al final.** Lint y build de los dos lados, `npm run verify` completo y un recorrido en el
navegador, que incluye apagar la API y ver que `/lo-de-lili` se arma con el nombre derivado.

## Límites conocidos

- **Una llamada más por página.** Las páginas del centro se arman en el servidor de Next, así
  que todas las visitas comparten su IP contra el tope de 120 por minuto. El panel, que hoy no
  hace ninguna llamada desde el servidor, pasa a hacer una. Con el tráfico de hoy no importa; si
  crece, el perfil se puede cachear unos minutos, porque el nombre casi no cambia.
- **Con la API caída, un slug inventado se ve como un centro.** Es lo que pasa hoy con todos;
  el 404 depende de que la API conteste.

## Criterios de aceptación

- La ruta responde los cuatro casos de la tabla y no devuelve otras claves.
- `openapi.json` y `api.d.ts` regenerados y commiteados.
- `/lo-de-lili` y `/bella-piel` muestran su nombre real en el encabezado, el pie y el título.
- `/no-existe` y `/centro-cerrado` dan la página 404 con status `404`.
- Con la API apagada, `/lo-de-lili` se arma con el nombre derivado del slug.
- `npm run verify` sin fallas, y lint y build en verde en los dos lados.
