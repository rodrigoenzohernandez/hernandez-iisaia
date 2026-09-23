# Trabajo Práctico Final — Plataforma de turnos multi-tenant

Una plataforma que gestiona turnos de centros de estética: catálogo de tratamientos, franjas de
atención con cupo, reserva con o sin cuenta, cobro de señas y turnos con Mercado Pago en la
cuenta de cada centro, mails, planes con suscripción mensual y un panel para la plataforma. Es
multi-tenant desde el esquema: "Lo de Lili" es el primer cliente y no el único. NestJS sobre
Node 24, Prisma 7 y Postgres 17 en Docker. El frontend en Next.js lo hace un compañero
consumiendo esta API.

Se hizo en dos etapas, cada una con su plan: el MVP ([plan](docs/1.backend-mvp-plan.md)) y el
post MVP ([plan](docs/3.backend-post-mvp-plan.md)). Este informe cubre las dos; donde algo del MVP
cambió después, está dicho.

## Cómo se ejecuta

Hace falta Node 24, Docker y `jq` (solo para el script de verificación).

```bash
cd tp-final/backend
nvm use                 # lee .nvmrc
cp .env.example .env    # completar JWT_SECRET, ENCRYPTION_KEY y SEED_ADMIN_PASSWORD
npm install
npm run setup           # levanta Postgres, aplica las migraciones y siembra
npm run start:dev
```

La API queda en `http://localhost:3100/api/v1` y la documentación interactiva en
`http://localhost:3100/api/v1/docs`.

El contrato también está versionado en [backend/openapi.json](backend/openapi.json), que
`npm run spec` regenera sin levantar el servidor ni tocar la base. Ver qué endpoints hay no
debería exigir Docker, Postgres y el seed. Con la API corriendo, el mismo documento se sirve
en `/api/v1/docs-json`.

Para integrar el frontend hay dos guías que cubren lo que un OpenAPI no puede decir: el orden de
las llamadas, qué hacer con cada código de error y las reglas del contrato que no se ven en los
tipos. [La del MVP](docs/2.frontend-mvp-integracion.md) sigue valiendo, y
[la del post MVP](docs/4.frontend-post-mvp-integracion.md) suma cobros, cuentas de clientas,
planes y el panel de la plataforma.

Las tres variables sin default hay que generarlas, porque el proceso no arranca sin ellas:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY: cifra los tokens de Mercado Pago y firma los códigos
openssl rand -base64 18   # SEED_ADMIN_PASSWORD
```

El seed crea tres centros, cada uno con una clienta de prueba, y la cuenta de la plataforma:

- `lo-de-lili`, con los 8 tratamientos del prototipo, en el plan Profesional de cortesía;
- `bella-piel`, con otros dos, en el plan Básico;
- `centro-cerrado`, desactivado;
- `superadmin@turnos.test`, la plataforma.

Todos entran con la contraseña de `SEED_ADMIN_PASSWORD`: `lili@lodelili.test`,
`admin@bellapiel.test`, `admin@cerrado.test` y `superadmin@turnos.test`. Las clientas
(`clienta@<centro>.test`) entran con un código que la API imprime en su consola.

Mercado Pago es opcional. Sin credenciales, la API arranca igual y ningún centro cobra online.
Para probar contra el sandbox sin pasar por OAuth, alcanza con las credenciales de prueba en
`SEED_MP_ACCESS_TOKEN` y `SEED_MP_USER_ID`; el resto está en el
[README de la librería](backend/src/lib/mercadopago/README.md).

Si algo no arranca:

| Síntoma | Qué es | Salida |
| --- | --- | --- |
| `address already in use :::3100` | Otro proceso tiene el puerto | Cambiar `PORT` en el `.env` |
| `bind: 0.0.0.0:5442 failed` | Otro Postgres tiene el puerto | Cambiar el puerto del `docker-compose.yml` **y** el del `DATABASE_URL`: van de a dos |
| `Can't reach database server` | La base no terminó de arrancar | `npm run db:up`, que espera el healthcheck |
| `Falta la variable de entorno X` | El `.env` está incompleto | Es a propósito: no hay defaults para los secretos |
| `ENCRYPTION_KEY tiene que ser 32 bytes` | La clave no es de 32 bytes en base64 | `openssl rand -base64 32` |
| La migración `clientas` falla con `contains null values` | La base tiene reservas del MVP | `npm run db:reset`: las columnas nuevas son obligatorias |
| `EBADENGINE` | Node distinto de 24 | `nvm use` |

Para dejar la base como recién instalada: `npm run db:reset`.

Para correr la verificación hacen falta dos cosas, en dos corridas distintas:

```bash
npm run start:verify     # en otra terminal
npm run verify           # 553 casos de dominio

npm run start:dev        # ahora con los límites de default
npm run verify:limite    # que el límite de peticiones exista
```

`start:verify` levanta la API como la necesita el script: el límite de peticiones alto (hace
decenas de altas seguidas y con el default se limitaría a sí mismo), las tareas periódicas cada
dos segundos, los mails a la consola, y Mercado Pago apuntando a un mock que el script levanta
solo. El límite real se prueba en la segunda corrida, que es la que necesita los defaults.

La corrida imprime el resultado por sección y deja el detalle —el request y el response de
cada caso— en `docs/verificacion.md`. Ese archivo **no se commitea**: cambia entero en cada
corrida, porque los identificadores y las fechas se recalculan. La tabla de resultados de la
última corrida está en el pull request.

## Arquitectura

Un solo proceso sirve la API bajo `/api/v1` y corre las tareas periódicas. La base corre en
Docker; la aplicación, afuera.

```
tp-final/
├── docs/
│   ├── 1.backend-mvp-plan.md          el plan del MVP, sin editar
│   ├── 2.frontend-mvp-integracion.md  la guía del MVP para integrar el front
│   ├── 3.backend-post-mvp-plan.md     el plan del post MVP, sin editar
│   ├── 4.frontend-post-mvp-integracion.md  la guía del post MVP
│   └── verificacion.md                lo genera verificar.sh; no se commitea
└── backend/
    ├── docker-compose.yml         solo Postgres 17, con healthcheck, en el puerto 5442
    ├── prisma/
    │   ├── schema.prisma          las 12 tablas
    │   ├── migrations/            8 migraciones, todas generadas por Prisma
    │   ├── seed.ts                3 centros y la plataforma, con PrismaClient crudo
    │   └── conectar-mp.ts         conecta un centro a una cuenta de prueba de MP, sin OAuth
    ├── openapi.json               el contrato, regenerado con `npm run spec`
    ├── verificacion/
    │   ├── verificar.sh           los 553 casos de dominio
    │   ├── verificar-limite.sh    que el límite de peticiones exista
    │   └── mercadopago-mock.mjs   la API de Mercado Pago en memoria, para verificar
    └── src/
        ├── main.ts                helmet, CORS, tope de body, Swagger, las tareas
        ├── app.module.ts          los dos guards globales y los módulos
        ├── env.ts                 carga y valida el entorno al importarse
        ├── common/
        │   ├── horario.ts         la aritmética de la grilla, en funciones puras
        │   ├── cifrado.ts         AES-256-GCM y HMAC con subclaves derivadas
        │   ├── errores.filter.ts  todos los errores con la forma { code, message }
        │   ├── password.ts        scrypt de node:crypto y el hash señuelo
        │   └── pagination/        el cursor keyset reutilizable
        ├── prisma/                el cliente extendido y la transacción con reintento
        ├── tenancy/               el contexto del tenant, la extensión y el guard
        ├── lib/mercadopago/       la librería sobre el SDK oficial, sin Nest ni Prisma
        ├── auth/                  el login de las administradoras
        ├── clientes/              el ingreso con código, el perfil
        ├── servicios/             el ABM de tratamientos, con su política
        ├── ventanas-atencion/     las franjas
        ├── disponibilidad/        los horarios de un día
        ├── reservas/              el alta, la gestión, el cupo y los recordatorios
        ├── cobros/                la cuenta de MP del centro, el webhook y los reembolsos
        ├── notificaciones/        la cola de mails, las plantillas y el proveedor
        ├── planes/                los dos planes, la suscripción y el webhook de la plataforma
        ├── plataforma/            el superadmin y el alta de centros
        └── tareas/                todo lo que corre cada tanto
```

### Endpoints

Todos bajo `/api/v1`. El cuerpo de error es siempre `{ code, message }`: el `code` es un
identificador en inglés para el front, el `message` está en español porque lo lee una persona.
`{slug}` es el centro.

| Método | Ruta | Quién | Respuestas destacadas |
| --- | --- | --- | --- |
| `POST` | `/tenants/{slug}/sesiones` | público | `201` token · `401` `invalid_credentials` |
| `POST` | `/tenants/{slug}/clientes/codigos` | público | `202` · `429` `too_many_codes` |
| `POST` | `/tenants/{slug}/clientes/sesiones` | público | `201` token · `401` `invalid_code` |
| `GET` · `PATCH` | `/tenants/{slug}/clientes/me` | clienta | `200` · `404` `cliente_not_found` |
| `GET` | `/tenants/{slug}/clientes/me/reservas` | clienta | `200` página |
| `GET` | `/tenants/{slug}/servicios` | público | `200` página · `400` `invalid_cursor` |
| `GET` | `/tenants/{slug}/servicios/{id}` | público | `200` · `404` `servicio_not_found` |
| `POST` · `PATCH` | `/tenants/{slug}/servicios[/{id}]` | admin | `201`/`200` · `409` `servicio_name_taken` |
| `GET` | `/tenants/{slug}/servicios/{id}/disponibilidad?fecha=` | público | `200` · `400` · `404` |
| `GET` · `PUT` | `/tenants/{slug}/ventanas-atencion` | admin | `200` · `403` `plan_limit_reached` · `409` `ventanas_superpuestas` |
| `POST` | `/tenants/{slug}/reservas` | público, clienta o admin | `201` · `409` `slot_full` / `monthly_limit_reached` / `online_payment_unavailable` · `502` |
| `GET` | `/tenants/{slug}/reservas` | admin | `200` página |
| `GET` | `/tenants/{slug}/reservas/{id}` | dueña o admin | `200` · `404` |
| `GET` | `/tenants/{slug}/reservas/{id}/estado` | público | `200`, solo el estado |
| `PATCH` | `/tenants/{slug}/reservas/{id}` | dueña o admin | `200` · `409` `invalid_transition` / `reschedule_not_allowed` / `too_early_for_no_show` |
| `GET` · `POST` · `DELETE` | `/tenants/{slug}/cuenta-mercadopago` | admin | `200` · `400` `invalid_state` · `409` `mp_account_change_blocked` |
| `GET` | `/tenants/{slug}/cuenta-mercadopago/autorizacion` | admin | `200` · `503` `mercadopago_not_configured` |
| `GET` · `PUT` | `/tenants/{slug}/suscripcion` | admin | `200` · `409` `mercadopago_not_connected` |
| `POST` | `/tenants/{slug}/webhooks/mercadopago` | Mercado Pago | fuera del OpenAPI |
| `GET` | `/planes` | público | `200` |
| `POST` | `/tenants` | público | `201` centro y sesión · `409` `slug_taken` |
| `POST` | `/webhooks/mercadopago` | Mercado Pago, firmado | fuera del OpenAPI · `401` `invalid_signature` |
| `POST` | `/plataforma/sesiones` | público | `201` token · `401` |
| `GET` | `/plataforma/tenants` · `/plataforma/resumen` | superadmin | `200` |
| `PATCH` | `/plataforma/tenants/{slug}` | superadmin | `200` · `404` |

Treinta operaciones en el contrato y dos webhooks fuera de él. El único `DELETE` es el de la
conexión con Mercado Pago, que después de la llamada no existe más. Toda escritura pública tiene
límite de peticiones: 5 por minuto en logins, códigos y altas de reserva, y 3 por hora en el
alta de centros.

### Datos

Doce tablas. `Tenant` y `Superadmin` son las únicas globales; todas las demás llevan `tenantId`.

- **El MVP:** `Usuario`, `Servicio`, `VentanaAtencion` y `Reserva`. La reserva guarda `fecha` como
  `DATE`, `horaInicio` y `horaFin` como `"HH:mm"`, los datos de contacto como texto, y una copia
  de la seña, del precio y de la política que aceptó la clienta.
- **Las clientas:** `Cliente`, única por `(tenantId, email)`, y `CodigoAcceso`, que guarda el HMAC
  del código, nunca el código.
- **Los cobros:** `CuentaMercadoPago`, con los tokens del centro cifrados; `Pago`, único por el id
  de Mercado Pago; y `Reembolso`, que es una cola: la fila nace con la cancelación y su id es la
  idempotency key del pedido a Mercado Pago.
- **Los mails:** `Notificacion`, otra cola, que se escribe en la misma transacción que el cambio
  que la origina.
- **Los planes:** la suscripción vive en columnas de `Tenant` y el plan vigente no se guarda: se
  calcula.

Las reglas que cruzan filas y viven en la base son claves foráneas compuestas:
`Reserva → Servicio`, `Reserva → Cliente`, `Pago → Reserva` y `Reembolso → Pago`, todas por
`(tenantId, id)`. Impiden que una fila de un centro apunte a una de otro, aunque la aplicación
se equivoque. Todas las migraciones las generó Prisma: esta entrega no tiene una línea de SQL
escrita a mano.

### Contrato entre la interfaz y el servidor

```
GET /api/v1/tenants/lo-de-lili/servicios/<id>/disponibilidad?fecha=2026-09-28

200
{ "fecha": "2026-09-28",
  "data": [ { "hora": "09:00", "cuposDisponibles": 1 },
            { "hora": "09:45", "cuposDisponibles": 0 } ] }
```

```
POST /api/v1/tenants/lo-de-lili/reservas
{ "servicioId": "<id>", "fecha": "2026-09-28", "hora": "09:00",
  "metodoPago": "efectivo", "clienteNombre": "Ana Perez",
  "clienteEmail": "ana@example.com", "clienteTelefono": "1155512345" }

201
{ "id": "...", "fecha": "2026-09-28", "horaInicio": "09:00", "horaFin": "10:00",
  "estado": "confirmada", "metodoPago": "efectivo", "senaCentavos": 1200000, ... }
```

La disponibilidad devuelve `{fecha, hora}` y la reserva se crea mandando eso mismo: el
contrato es simétrico, no hay que armar un instante ni elegir una zona. `horaFin` y
`senaCentavos` los calcula el servidor y no se aceptan del cliente.

Las páginas son `{ data, nextCursor }`. El cursor es opaco: se devuelve tal cual vino.

Después del MVP, la reserva trae además:

- `cobro`: qué se paga online, cuánto entró, cuánto se devolvió y el link de Mercado Pago
  mientras está pendiente;
- dos banderas, `puedeReprogramar` y `puedeCancelarConReembolso`, calculadas por el servidor
  con la hora del centro.

En un centro que cobra online, un turno en efectivo nace `pendiente`, con la seña a pagar. El
detalle está en la [guía del post MVP](docs/4.frontend-post-mvp-integracion.md).

## Qué decidí yo

### En el MVP

**El tenant va en el path, también en las rutas de administración, y el token es la
autoridad.** Mi primera idea era lo contrario: sacar el tenant del JWT y dejar las URLs
limpias. Lo cambié porque el alta de reserva es pública y no tiene token, así que el slug
tiene que estar en la URL de todas formas; con el esquema híbrido el catálogo de tratamientos
—que es el mismo recurso— quedaba colgando de dos URIs distintas según quién lo leyera. Ahora
hay una sola URI por recurso. La seguridad no se apoya en el path: el JWT lleva el id del
centro y si no coincide con el del path es `403`. El cliente nombra su centro, no lo elige.

**El aislamiento entre centros tiene tres capas, y una de ellas rompe el arranque a
propósito.** La primera es una extensión de Prisma que inyecta el `tenantId` en el `where` y
en el `data` de toda operación, leyéndolo de un `AsyncLocalStorage`. La segunda es la clave
foránea compuesta, que cubre lo que la extensión no ve. La tercera es un chequeo que recorre
el modelo al arrancar y **tira la aplicación** si aparece una tabla sin `tenantId`. Esa
tercera capa es la que más me importa: sin ella, el día que alguien agregue una tabla y se
olvide la columna, sus queries saldrían sin filtrar y nadie se enteraría. Con ella, el olvido
es un error de arranque en la primera corrida.

**Ningún método del dominio recibe el `tenantId` como parámetro.** Es la contracara de lo
anterior y es deliberado: un `tenantId` que viaja por la firma es exactamente el argumento
que, mal pasado a un `deleteMany`, borra la agenda de otro negocio. Si no está en la firma,
no se puede pasar mal.

**El guard es global y lo público es la excepción.** Va al revés del ejemplo de NestJS, que
protege ruta por ruta. Elegí que falle cerrado: olvidarse un `@Publico()` rompe el flujo de
reserva en el primer `curl` y me entero en diez segundos, mientras que olvidarse un
`@UseGuards` dejaría el borrado de tratamientos abierto y no me enteraría nunca.

**El doble turno es configurable, no imposible.** Cada franja de atención lleva una
`capacidad`: con 1 se acepta un turno por horario, con 3 se aceptan tres simultáneos. Esto
salió de una corrección al plan original, que usaba una constraint de Postgres para prohibir
todo solapamiento. La constraint era más elegante y estaba mal: un centro que atiende a dos
personas a la vez no es un caso raro, es el caso normal. Y bajar la capacidad con reservas ya
tomadas **no cancela ninguna**: la capacidad es una regla que se aplica al reservar, no un
invariante sobre lo ya guardado, porque una reserva es un compromiso con una persona. Esos
horarios quedan sin cupo y la agenda drena sola.

**El cupo se controla con una transacción `SERIALIZABLE` y no con una constraint.** Esto es
consecuencia de una restricción que me puse: la migración es el baseline que genera Prisma y
nada más, sin una línea de SQL a mano. Un `EXCLUDE` con `tstzrange` no se puede expresar en
`schema.prisma`, y `FOR UPDATE` o los advisory locks necesitan SQL crudo. `SERIALIZABLE` es
opción de primera clase de `$transaction`, así que la decisión la toma Postgres y no mi
código. Lo verifiqué con 48 altas simultáneas sobre seis horarios: entra exactamente una por
horario, siempre.

**La fecha es un `DATE` y las horas son strings `"HH:mm"`, no un `timestamptz`.** El dominio
es hora de pared: "el martes a las 15:00" no cambia porque cambie una zona. Con este modelo
desaparece toda la aritmética de offsets y el único lugar del backend que conoce una zona
horaria es la función que responde qué hora es *ahora* en el centro, para rechazar turnos
pasados. El costo es que las comparaciones son lexicográficas, y por eso el formato con cero
a la izquierda se valida en el borde: si entra un `"9:00"`, las comparaciones dejan de
significar nada.

**La plata va en centavos enteros.** El `Decimal` de Prisma sale como string en el JSON y
entra como número, que es asimétrico y obliga a quien consume la API a hacer `parseFloat`.
Con enteros, validar que la seña no supere al precio es una comparación y no necesita
librería. La división por 100 pasa en un solo lugar: el front.

**La reserva guarda una copia de la seña y de la hora de fin.** Si mañana sube el precio de
un tratamiento o cambia su duración, el turno de ayer conserva lo que la clienta aceptó. Son
dos columnas y evitan una discusión.

**La clienta no tiene cuenta.** El paso "Tus datos" del prototipo pide nombre, teléfono,
email y notas, y ninguna contraseña: eso es un dato del producto, no una simplificación mía.
Sus datos van como texto en la reserva, no como una fila de `Usuario`. El costo está escrito
abajo. *Después del MVP la cuenta existe, pero sigue siendo opcional: ver abajo.*

**La paginación es keyset y el `where` del cursor va adentro del `where` del llamador.**
Prisma tiene su propio `cursor`, y no lo uso: ese parámetro no pasa por la extensión de
tenant, así que un cursor falsificado con un id ajeno entraría crudo a la consulta. Con
keyset la fuga se cierra por construcción, no por un chequeo que alguien tiene que recordar.
Elegí cursor y no `offset` por el dominio: las reservas se ordenan por fecha y hora y las
altas entran *en el medio* de ese orden, así que con `offset` la página siguiente saltea
filas, y una reserva salteada es una clienta que llega y no está anotada.

**El catálogo público solo muestra lo que se puede reservar.** `?activo=` es un filtro común
y significa lo mismo para todos, pero el *default* depende de quién pregunta: sin token se
devuelven solo los activos, con token de administradora se devuelve todo, porque el ABM
necesita administrar los dados de baja. Con cuentas de clientas, lo decide el rol del token y
no su presencia. Mi primera versión no distinguía, y el catálogo público ofrecía tratamientos que
al reservarse daban `404`. Lo que sigue sin pasar es que un parámetro cambie el nivel de
acceso: cambia el valor por omisión, no el significado.

**El conflicto de un turno devuelve siempre el mismo código, incluso cuando sé más.** El alta
detecta el doble submit del formulario comparando el email con las reservas del horario, y al
principio le devolvía un código propio, `reserva_duplicada`, con el mensaje "ya tenés un turno
reservado". Era más amable y era un oráculo: cualquiera, sin token, podía averiguar si un email
dado tiene turno a una hora dada. Ahora los dos casos devuelven `slot_full`. Perdí un mensaje
útil para no publicar la agenda de una persona.

**No hay `DELETE` en el dominio.** La baja de un tratamiento es lógica, porque el
historial de reservas lo referencia, y un `DELETE` tras el cual el recurso sigue existiendo
es un contrato mentiroso. Es un `PATCH {"activo": false}`. Cancelar un turno también es un
`PATCH` del estado y no un `POST /cancelar`: es cambiarle un campo al recurso, no crear uno
nuevo.

**El `PUT` de franjas reemplaza la semana entera.** Un endpoint en lugar de tres, y nunca
existe el estado intermedio en el que la semana quedó a medio editar. Es idempotente porque
la representación no lleva `id`: si lo llevara, el borrar-e-insertar generaría ids nuevos en
cada llamada y la segunda respuesta no sería igual a la primera.

**Con efectivo la reserva nace confirmada; con Mercado Pago, pendiente.** No hay integración
real de pagos en esta entrega. Dejar que la reserva de Mercado Pago naciera confirmada haría
que el método de pago no signifique nada, así que queda pendiente y la administradora la
confirma. La costura para cuando entre el SDK son tres cambios que sólo agregan: dos columnas,
una llamada después del insert y un endpoint de webhook. *Así entró, después del MVP.*

**Lo que dejé afuera a propósito, y qué implica.** Sin cuentas de cliente, la clienta no puede
cancelar ni reprogramar su turno: no hay con qué autenticarla, y la versión barata no es una
cuenta sino un token firmado en el mail de confirmación, que todavía no existe. Sin
expiración de las reservas pendientes, una abandonada retiene el cupo hasta que la
administradora la cancele. Sin notificaciones, nadie avisa nada. Y como el alta es pública y
anónima, cualquiera con `curl` puede llenar la agenda; el límite de 5 por minuto lo hace
molesto pero no imposible, y es lo único que hay. *Todo esto, salvo el llenado de la agenda,
se resolvió después del MVP; un turno impago ahora libera el cupo a los veinte minutos.*

### Después del MVP

**Checkout Pro, y no Bricks.** Yo había propuesto Checkout Bricks porque pensaba que era lo más
simple. Al analizarlo resultó al revés: con Bricks el front embebe el formulario y el backend
tiene que crear el cobro, interpretar los rechazos y resolver el 3DS, y el Payment Brick
documenta el cobro con tarjeta contra la Payments API, que Mercado Pago dejó de evolucionar.
Con Checkout Pro el backend crea una preferencia, Mercado Pago resuelve el resto en su página y
el resultado llega por webhook. Las tarjetas nunca pasan por nuestro sitio, y si algún día se
quiere tarjeta embebida, el Brick reusa la misma preferencia.

**La plata cae en la cuenta de cada centro, conectada por OAuth.** La plataforma nunca toca el
dinero de las clientas: cada centro autoriza con "Conectar con Mercado Pago" y los cobros salen
con su token. Los tokens se guardan cifrados con AES-256-GCM. El `state` de OAuth viaja cifrado
con el centro, el verifier de PKCE y un vencimiento: no hace falta una tabla, y un state robado
no sirve en otro centro. En local y en pruebas no hace falta OAuth: un script escribe la misma
fila con credenciales de prueba.

**La integración con Mercado Pago es una librería sobre el SDK oficial.** La quería extraíble,
como librería de la empresa. Mi primer impulso fue un cliente propio con `fetch`, y lo descarté
para no reinventar el SDK. Quedó un envoltorio con cuatro capacidades —cobros, suscripciones,
cuentas conectadas y webhooks—, sin Nest, sin Prisma y sin estado, con una regla de ESLint que
le impide importar algo de la app. Lo que agrega arriba del SDK es lo que evita las trampas
conocidas:

- la plata en centavos;
- una configuración nueva por operación, porque el SDK deja pegada la idempotency key de una
  escritura en las siguientes;
- los errores con una sola decisión de reintento;
- el parche del link de suscripción, roto en Argentina.

**Mails y reembolsos son colas en la base.** El mail de un turno confirmado se escribe en la
misma transacción que la confirmación: nunca queda un turno sin su mail, y un reintento de la
transacción no lo manda dos veces. Los reembolsos igual:

- la fila nace con la cancelación, y su id es la idempotency key del pedido a Mercado Pago;
- una tarea reintenta con backoff;
- si Mercado Pago lo rechaza para siempre, el centro recibe un mail para hacerlo a mano.

Ningún reembolso se pierde en silencio.

**La clienta entra con un código de seis dígitos, y la cuenta es opcional.** Reservar sigue sin
pedir cuenta: la reserva queda asociada al email, y cuando la clienta quiere gestionar sus
turnos pide un código a ese email y entra. No hay contraseña ni paso de registro. Por qué
aguanta la fuerza bruta:

- el código se guarda como HMAC;
- vence a los diez minutos y se usa una vez;
- acepta cinco intentos, y hay tope de códigos por email;
- cualquier falla devuelve el mismo `401`.

Los datos de una reserva sin cuenta nunca pisan un perfil existente: si no, cualquiera podría
cambiarle el nombre a otra persona reservando con su email.

**Fuera de plazo se pierde todo lo pagado.** Así lo pidió el negocio:

- en plazo, reprogramar es gratis y cancelar devuelve el 100%;
- fuera de plazo, la clienta no reprograma sola y cancelar no devuelve nada;
- el centro puede cancelar con o sin reembolso —elige, y tiene que decirlo si hubo pago— y
  reprogramar cuando quiera.

La política se copia a la reserva, como la seña: si el centro la endurece después, el turno ya
tomado conserva la que aceptó.

**El pago se decide en una transacción `SERIALIZABLE`, y una sola vez.** Un pago que se aprueba
mientras la clienta cancela no puede quedar sin decidir: o lo ve la cancelación y lo reembolsa,
o lo ve el webhook con la reserva cancelada y lo devuelve. Un pago que llega después del
vencimiento reactiva la reserva si el horario sigue libre, y si no se devuelve. Cada pago se
decide la primera vez que llega aprobado y nunca más: un aviso repetido, o un pago que vuelve de
una disputa, solo actualizan su estado.

**Un cobro pendiente ocupa el cupo solo mientras no venció.** La definición de "reserva viva" es
una sola, compartida por el alta, la reprogramación, la reactivación y la disponibilidad. La
tarea que cancela las vencidas es higiene: si se cae, los cupos se liberan igual.

**El plan vigente se calcula, no se guarda.** Es Profesional si lo pagado alcanza, con diez días
de gracia mientras la suscripción siga autorizada, que cubren los reintentos de Mercado Pago.
No hay una tarea de vencimiento, y un plan no puede quedar activo porque un aviso no llegó. Los
límites del plan viven junto al control de cupo: la capacidad y el tope de turnos del mes se
aplican en un solo lugar, y los usan el alta, la reprogramación y la reactivación.

**Dos planes, y el pago depende de la cuenta conectada.** Básico gratis y Profesional pago: las
funciones que justificarían un tercero no existen todavía. El Profesional existe para cobrar
online, así que suscribirse exige la cuenta de Mercado Pago conectada. La suscripción es una
preapproval sin plan asociado, atada al slug del centro y cobrada por la cuenta de la
plataforma.

**Dos webhooks, con dos niveles de confianza.**

- El de la plataforma exige la firma: son los webhooks de la app, que Mercado Pago firma.
- El de cada centro la verifica pero no la exige, porque Mercado Pago no la garantiza en los
  avisos por `notification_url`. Lo protege que nunca usa el body: trae el pago de Mercado Pago
  con el token del centro, así que un aviso falso solo puede hacer que se consulte un pago real.
- Un aviso que no se pudo procesar no se contesta `200`: con un error, Mercado Pago lo vuelve a
  mandar.

**El superadmin no tiene alta; los centros sí.** La cuenta de la plataforma la crea el seed y es
la única. Los centros se registran solos, en Básico, con quien los da de alta como
administradora. Un token de la plataforma no sirve en las rutas de un centro, ni al revés.

**La seguridad base fue lo primero.** Todo lo que venía sumaba rutas públicas —el ingreso de
clientas, los cobros, los webhooks, el alta de centros—, así que antes entraron:

- helmet y CORS con lista explícita y sin credenciales;
- un tope de 100 kb en el body y `trust proxy` explícito;
- límite de peticiones en toda escritura pública;
- chequeos de entorno al arrancar;
- roles en el guard.

Lo último cerraba un agujero real: hasta el MVP, cualquier token del centro pasaba las rutas de
administración, y con cuentas de clientas eso les habría abierto la agenda completa.

## Cómo gestioné el contexto

### En el MVP

Arranqué en modo plan, y el plan quedó en [docs/1.backend-mvp-plan.md](docs/1.backend-mvp-plan.md) sin editar. No salió de
una sola pasada: hubo tres rondas de preguntas antes de escribir una línea, y la segunda
ronda cambió el diseño entero. Yo había aceptado una propuesta que prohibía el doble turno con
una constraint de Postgres, y cuando la leí escrita me di cuenta de que estaba resolviendo el
problema al revés. De ahí salieron el multi-tenancy desde el día uno, la capacidad
configurable y la prohibición de SQL a mano.

Antes de escribir código hice un paso de verificación de supuestos contra una base real, y fue
la decisión que más tiempo ahorró. Iba a chequear cinco cosas que el plan daba por ciertas
sobre Prisma 7, Node 24 y NestJS 12, y terminé con **siete desvíos**, tres de ellos de fondo:
Prisma 7 sacó la URL del `datasource` y ahora exige un driver adapter, el `latest` de
TypeScript no expone la API que el CLI de NestJS necesita, y el argumento del plan para usar
CommonJS era falso. Los otros cuatro eran de entorno y de detalle. Verificarlo en un proyecto
de descarte costó unos minutos; descubrirlo con veinte archivos escritos habría costado una
tarde.

Los archivos están todos por debajo de 300 líneas y el más grande tiene 225, así que para
trabajar en la disponibilidad no necesité tener el módulo de reservas en contexto. Lo que lo
hace posible es que `common/horario.ts` sea puro: la aritmética de la grilla no depende de
Prisma ni de NestJS, y los dos módulos que la usan no se conocen entre sí.

La verificación es un script de 151 casos con `curl` que arranca reseteando la base, y esa
decisión la aprendí a la mala. Dos veces una prueba mía corrió sobre datos de la prueba
anterior y el resultado *parecía* un bug del código: una vez eran reservas viejas, otra vez
una capacidad que había subido y no restauré. Las dos veces la aplicación estaba bien y el
que estaba mal era mi método. Sin tests automatizados, ese script es la única red que hay, y
una red que arrastra estado no es una red.

Cerré con seis revisiones en paralelo sobre el mismo cambio —seguridad, corrección,
concurrencia, sobre-ingeniería, operación y consistencia— y cada hallazgo pasó por tres
escépticos que intentaban refutarlo leyendo el código. De cincuenta y cinco hallazgos crudos
sobrevivieron veintisiete: la mitad se caía sola cuando alguien iba a leer el archivo. El
punto de los seis ángulos es que tienen puntos ciegos distintos; el de los escépticos, que un
hallazgo plausible y falso cuesta más que uno que no aparece.

Y encontró dos cosas que mis ciento cincuenta y una pruebas no podían encontrar, las dos por
el mismo motivo: la prueba no existía porque no se me había ocurrido el caso. Ninguna pedía un
`429`, así que el limitador de peticiones podía estar apagado sin que nada fallara; y ninguna
paginaba reservas, así que la segunda página del listado devolvía `500` sin que nada fallara.
Las pruebas que escribí cubren lo que pensé; la revisión cubre lo que no. Los dos casos están
ahora en el script, que pasó de 151 a 173.

El plan y lo construido no coinciden en todo. El plan decía CommonJS y quedó ESM; decía
puerto 5433 y 3000, y los dos estaban ocupados en mi máquina; no sabía del driver adapter ni
del `prisma.config.ts`. Dejé el plan como estaba y las diferencias quedan explicadas acá y en
la sección que sigue.

### Después del MVP

**El plan se escribió comentándolo.** Otra vez en modo plan, pero con el plan abierto para
comentarlo en el lugar. Fueron tres rondas de comentarios, y cambiaron cosas de fondo:

- de Bricks a Checkout Pro;
- de un cliente propio a un envoltorio del SDK oficial;
- una librería que cubriera también los webhooks y las suscripciones, no solo los cobros;
- de tres planes a dos;
- un superadmin sembrado, sin alta, y centros que sí se dan de alta solos;
- la seguridad base antes que cualquier ruta pública nueva;
- credenciales de prueba sin OAuth;
- la reserva sin cuenta;
- la cancelación del centro con o sin reembolso.

El plan quedó en [docs/3.backend-post-mvp-plan.md](docs/3.backend-post-mvp-plan.md) antes de la
primera línea de código.

**Un commit por fase, sin frenar entre fases.** Fueron ocho fases, cada una terminada con el
lint, el build y su sección de la verificación en verde, y commiteada sola. Revisé el conjunto
al final, en el pull request.

**El contexto se terminó a mitad de la fase de planes.** La conversación se resumió sola y siguió
desde el resumen. Retomar costó poco porque lo que importaba vivía en disco, no en la memoria de
la conversación:

- el plan, en `docs/`;
- un commit por fase, así que el estado del código era el último commit más un diff chico;
- el script de verificación, que es la especificación ejecutable.

Un resumen puede perder un matiz; un caso de `verificar.sh` que falla no.

**Las revisiones fueron al final y en paralelo.**

- **`/code-review`:** nueve ángulos de búsqueda independientes (línea por línea, lo que se
  borró, los llamadores de cada cambio, las trampas del lenguaje, los envoltorios, reuso,
  simplificación, eficiencia y profundidad). Salieron 69 candidatos crudos, unos cuarenta
  distintos. Cada uno pasó por un verificador que intentaba refutarlo leyendo el código, y un
  barrido final buscó solo lo que faltaba. Los quince más graves están arreglados, con un caso
  de verificación cada uno, y varios más de los que quedaron abajo del corte también.
- **`/security-review`:** un solo candidato, descartado con confianza 2 sobre 10.
- **`/simplify`:** cuatro ángulos más de limpieza sobre el código ya corregido. Encontró, entre
  otras cosas, un error que yo había metido en el arreglo de un hallazgo; está en la sección
  que sigue.

## Qué salió mal

### En el MVP

**El reintento de la transacción era código muerto y no lo detectaba nada.** El control de
cupo depende de que, cuando Postgres aborta una transacción por conflicto de serialización, la
aplicación la reintente. Yo detectaba ese conflicto mirando si el error era un
`PrismaClientKnownRequestError` con código `P2034`, que es lo que documenta Prisma. Con el
driver adapter de Prisma 7 el conflicto **no llega así**: llega como un `DriverAdapterError`
con `cause.originalCode: '40001'` y `cause.kind: 'TransactionWriteConflict'`. Así que la
condición nunca se cumplía, el reintento no se disparaba jamás y el error se escapaba como un
`500` sin explicación. Apareció recién con ocho altas simultáneas: seis devolvían `409`, una
`201` y una `500`. Lo peor es que el síntoma era leve y la causa no: nunca entró una reserva
de más —Postgres aborta a la perdedora, así que falla cerrado— pero la lógica en la que yo
confiaba para eso no estaba corriendo. Ahora el detector mira las dos formas del error y el
último conflicto se traduce a un `409` con código `high_contention`. Con 48 altas simultáneas:
cero `500`, y exactamente una reserva por horario.

**El limitador de peticiones estaba instalado, configurado y apagado.** Había agregado
`@nestjs/throttler`, lo había configurado con un tope global y le había puesto un `@Throttle`
de cinco por minuto a los dos endpoints públicos que escriben. Nunca registré el guard. En
NestJS, `ThrottlerModule.forRoot()` publica la configuración y el almacenamiento, y nada más:
el guard hay que registrarlo a mano, y sin él los decoradores son metadata que nadie lee.
Resultado: la API no tenía ningún límite, el login admitía intentos infinitos y el alta
pública también, y los tres lugares donde el código decía lo contrario reforzaban la
confusión. Ninguna de mis pruebas esperaba un `429`, así que para el script estaba todo bien.
Es el mismo error que el del reintento, en otra forma: código que declara una protección que
no se aplica. El arreglo es una línea. Lo que me llevó a la línea fue que alguien mirara el
`app.module.ts` preguntándose quién lee esos decoradores.

**La segunda página del listado de reservas devolvía 500.** El cursor de paginación codifica
los valores por los que se ordena, y para las reservas el primero es la fecha. Yo la
serializaba con `toISOString().slice(0, 10)`, que es el formato del contrato de la API. Pero
ese valor no va al cliente para mostrarse: vuelve al `where` de Prisma, y Prisma rechaza un
`2026-09-28` en un campo `DateTime` aunque la columna sea `DATE`. Así que la primera página
funcionaba, devolvía un cursor, y usarlo explotaba. No lo detecté porque la única paginación
que probé fue la del catálogo, cuyas claves son texto, y porque el listado de reservas nunca
tuvo en mis pruebas más filas que el límite por página. El recorte a diez caracteres es
correcto para el contrato y estaba en el lugar equivocado: ahora el cursor lleva el ISO
completo y el recorte pasa solo al armar la respuesta.

**Dos veces creí haber encontrado un bug que era mío.** La primera, una prueba de capacidad
devolvió `409` donde esperaba `201` y estuve a punto de tocar el control de cupo; el `reset` de
la base había fallado en silencio porque redirigí su salida a `/dev/null`, y la prueba corría
sobre reservas de la corrida anterior. La segunda, aparecieron dos reservas en un horario de
capacidad 1 y lo anoté como sobrecupo; había dejado esa franja en capacidad 2 en una prueba
anterior, así que dos era el número correcto. Las dos veces el error estuvo en mirar el
resultado sin controlar el estado de entrada. Es lo que me convenció de que el script de
verificación tenía que resetear la base antes de cada corrida, y de no volver a esconder la
salida de un comando del que depende una prueba.

**Swagger no arrancaba por un genérico.** La página de resultados es un `CursorPageDto<T>`, y
el genérico se borra en compilación: el plugin de Swagger infería que `data` era un array de
`CursorPageDto`, detectaba una dependencia circular y tiraba la aplicación en el arranque, con
un error que no mencionaba la palabra "genérico". Se corta dándole a esa propiedad un esquema
explícito; el tipo real de cada elemento lo pone un decorador aparte.

**El razonamiento se me escapó a la documentación pública de la API.** Había escrito los
motivos de cada decisión en el JSDoc de los métodos del controller. El plugin de Swagger toma
ese bloque entero y lo pone como `summary`, que es el título de una línea que se ve al lado de
la ruta: la documentación que va a leer mi compañero tenía párrafos de tres oraciones como
título de cada endpoint. Lo corregí dejando el JSDoc en una línea y moviendo el razonamiento a
comentarios comunes. Y ahí apareció el segundo detalle: si los comentarios van *arriba* del
JSDoc, el plugin deja de verlo y el resumen queda vacío, sin avisar. Tienen que ir debajo de
los decoradores.

**Un mensaje de error se me quedó en inglés.** La API rechaza los campos desconocidos en el
body, que es lo que hace que mandar un `tenantId` devuelva `400` en vez de que el campo llegue
al insert. Ese rechazo lo genera NestJS con su propio texto, `"property tenantId should not
exist"`, y mi fábrica de excepciones lo pasaba tal cual. Quedaba un solo mensaje en inglés en
una API cuyos mensajes son todos en español, y lo encontré leyendo la respuesta de un `curl`,
no fallando ninguna prueba.

### Después del MVP

**El webhook de un centro podía perder un pago en silencio.** Si la cuenta de Mercado Pago del
centro quedaba esperando reconexión —por ejemplo, porque falló la renovación del token mientras
el token todavía servía—, el aviso de un pago se contestaba `200` sin procesarlo. Mercado Pago
no reintenta un `200`, así que una clienta que pagaba un cobro abierto en ese momento se quedaba
sin turno y sin su plata: no había fila de pago, la reserva vencía y nada la devolvía.

Mi verificación tenía el caso de la reconexión, pero miraba que no se cobrara nada nuevo, no qué
pasaba con un pago que llegaba justo ahí. Lo encontraron cinco de los nueve ángulos de la
revisión, cada uno por su lado. Ahora el aviso se procesa con el token guardado, y si no se
puede, se contesta con un error para que Mercado Pago lo vuelva a mandar. Hay un caso nuevo:
un cobro abierto antes de que la cuenta falle, pagado después.

**Un pago que volvía de una disputa se reembolsaba entero.** La guarda de "decidir una sola vez"
miraba el estado guardado del pago, y cada aviso lo pisa con el de Mercado Pago. Un pago
aprobado, disputado y resuelto a favor del centro volvía a "aprobado", se decidía de nuevo, y
como la reserva ya estaba confirmada, caía en "este pago sobra": se devolvía la plata de una
disputa ganada. Ahora la decisión deja su propia marca, que ningún aviso pisa.

**Lo reembolsado se sumaba en un lado y se copiaba en otro.** La tarea de reembolsos sumaba el
monto a un valor que había leído antes de llamar a Mercado Pago, y el aviso del pago escribía el
total que decía Mercado Pago. Si un reintento llegaba después del aviso, el reembolso contaba
doble. Ahora hay un solo criterio: el estado se copia de Mercado Pago, nunca se suma.

**El arreglo de un hallazgo trajo otro.** Al corregir lo anterior, puse la lectura del pago en
Mercado Pago dentro del mismo bloque que el reembolso. Si esa lectura fallaba, un reembolso que
ya había salido quedaba como fallido, y el centro recibía el mail para hacerlo a mano: podía
devolver dos veces. Lo encontró `/simplify`, revisando el código ya corregido. Ahora el
reembolso se marca hecho en cuanto Mercado Pago lo acepta, y el estado del pago se copia
después, sin poder voltearlo. La lección es que un arreglo en el camino de la plata necesita la
misma revisión que el código original.

**`IsOptional` deja pasar `null`, y lo arreglé dos veces por separado.** En la fase de cobros lo
parché en un campo del `PATCH` de tratamientos, donde un `null` llegaba a la base y daba `500`.
En la revisión apareció el mismo agujero en el `PATCH` de reservas, con otra consecuencia:
`reembolsar: null` cancelaba un turno pago sin devolver nada. El arreglo de fondo es uno solo,
un decorador que valida si el campo vino (sea el valor que sea, también `null`). Se aplica
también en el `PartialType` de los tratamientos.

**La verificación se colgó diez minutos.** Un `wait` sin argumentos esperaba también al mock de
Mercado Pago, que corre de fondo y no termina nunca. Ahora el script espera a los procesos de
`curl` que lanzó, y cada `curl` tiene un tope de tiempo.

**El SDK reintentaba solo y me escondía el reintento de la cola.** Para probar que un reembolso
fallido se reintenta, el mock fallaba una vez. El SDK reintenta por su cuenta un `503`, así que
el segundo intento salía bien antes de llegar a la cola, y la prueba pasaba sin probar lo que
decía. Ahora el mock falla dos veces.

**El mock separaba los recursos por token, y Mercado Pago los separa por cuenta.** Después de
renovar un token, un pago creado con el anterior se volvía invisible en el mock. Era más
estricto que Mercado Pago de una forma que habría escondido un flujo real, y apareció recién al
escribir el caso de un pago que llega después de una reconexión.

**El razonamiento se me volvió a escapar al OpenAPI, y esta vez lo atrapó una prueba.** El
resumen del `PUT` de suscripción salió de tres líneas, el mismo error del MVP. Esta vez no hizo
falta leer la documentación para verlo: falló un caso de la verificación que agregué entonces,
"ningún resumen es un párrafo". La lección del MVP ya era una prueba.

**`npm audit` marcaba cuatro vulnerabilidades altas que no eran mías.** Venían de dependencias
del CLI de Prisma (mysql2 y deepmerge-ts), y la única salida que ofrecía npm era bajar a Prisma
6. Las resolví con `overrides` a las versiones corregidas y verifiqué que `validate`,
`generate`, las migraciones y el seed siguieran andando. `npm run audit` quedó en cero.

**Prisma no genera migraciones sin una terminal interactiva.** `prisma migrate dev` se niega a
correr sin TTY cuando hay advertencias. Las migraciones las siguió generando Prisma, con
`migrate diff` contra el esquema y `migrate deploy`: ninguna tiene SQL escrito a mano.

