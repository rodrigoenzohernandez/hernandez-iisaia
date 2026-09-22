# Trabajo Práctico Final — Plataforma de turnos multi-tenant

Una plataforma fullstack que gestiona turnos de centros de estética: catálogo de tratamientos, franjas de atención configurables con cupo, y reserva pública sin cuenta. Es multi-tenant desde el
esquema: "Lo de Lili" es el primer cliente y no el único. NestJS sobre Node 24, Prisma 7 y
Postgres 17 en Docker. El frontend en Next.js lo hace un compañero consumiendo esta API.

## Cómo se ejecuta

Hace falta Node 24, Docker y `jq` (solo para el script de verificación).

```bash
cd tp-final/backend
nvm use                 # lee .nvmrc
cp .env.example .env    # completar JWT_SECRET y SEED_ADMIN_PASSWORD
npm install
npm run setup           # levanta Postgres, aplica la migración y siembra
npm run start:dev
```

La API queda en `http://localhost:3100/api/v1` y la documentación interactiva en
`http://localhost:3100/api/v1/docs`.

El contrato también está versionado en [backend/openapi.json](backend/openapi.json), que
`npm run spec` regenera sin levantar el servidor ni tocar la base. Ver qué endpoints hay no
debería exigir Docker, Postgres y el seed. Con la API corriendo, el mismo documento se sirve
en `/api/v1/docs-json`.

Las dos variables sin default hay que generarlas, porque el proceso no arranca sin ellas:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 18   # SEED_ADMIN_PASSWORD
```

El seed crea tres centros: `lo-de-lili` con los 8 tratamientos del prototipo, `bella-piel`
con otros dos, y `centro-cerrado` desactivado. Los tres comparten la contraseña de
`SEED_ADMIN_PASSWORD`, con los usuarios `lili@lodelili.test`, `admin@bellapiel.test` y
`admin@cerrado.test`.

Si algo no arranca:

| Síntoma | Qué es | Salida |
| --- | --- | --- |
| `address already in use :::3100` | Otro proceso tiene el puerto | Cambiar `PORT` en el `.env` |
| `bind: 0.0.0.0:5442 failed` | Otro Postgres tiene el puerto | Cambiar el puerto del `docker-compose.yml` **y** el del `DATABASE_URL`: van de a dos |
| `Can't reach database server` | La base no terminó de arrancar | `npm run db:up`, que espera el healthcheck |
| `Falta la variable de entorno X` | El `.env` está incompleto | Es a propósito: no hay defaults para los secretos |
| `EBADENGINE` | Node distinto de 24 | `nvm use` |

Para dejar la base como recién instalada: `npm run db:reset`.

Para correr la verificación hacen falta dos cosas, en dos corridas distintas:

```bash
THROTTLE_LIMIT=1000 npm run start:dev   # en otra terminal
npm run verify                          # 173 casos de dominio

npm run start:dev                       # ahora con el límite de default
npm run verify:limite                   # que el límite de peticiones exista
```

El `THROTTLE_LIMIT` alto no es un atajo: el script hace unas veinticinco altas seguidas y con
el default de cinco por minuto se limitaría a sí mismo, así que las fallas que reportara
serían del limitador y no del dominio. El límite real se prueba en la segunda corrida, que es
la que necesita el valor de default.

La corrida imprime el resultado por sección y deja el detalle —el request y el response de
cada caso— en `docs/verificacion.md`. Ese archivo **no se commitea**: son 140 KB que cambian
enteros en cada corrida, porque los identificadores y las fechas se recalculan. La tabla de
resultados de la última corrida está en el pull request.

## Arquitectura

Un solo proceso sirve la API bajo `/api/v1`. La base corre en Docker; la aplicación, afuera.

```
tp-final/
├── docs/
│   ├── 1.backend-mvp-plan.md      el plan con el que arranqué, sin editar
│   └── verificacion.md            lo genera verificar.sh; no se commitea, ver abajo
└── backend/
    ├── docker-compose.yml         solo Postgres 17, con healthcheck, en el puerto 5442
    ├── prisma/
    │   ├── schema.prisma          las 5 tablas
    │   ├── migrations/            la migración inicial, generada por Prisma
    │   └── seed.ts                3 centros, idempotente, con PrismaClient crudo
    ├── openapi.json               el contrato, regenerado con `npm run spec`
    ├── verificacion/
    │   ├── verificar.sh        los 173 casos de dominio
    │   └── verificar-limite.sh que el límite de peticiones exista
    └── src/
        ├── main.ts                prefijo, CORS, el middleware del contexto, Swagger
        ├── app.module.ts          el guard global y los módulos de feature
        ├── env.ts                 carga y valida el entorno al importarse
        ├── common/
        │   ├── horario.ts         la aritmética de la grilla, en funciones puras
        │   ├── password.ts        scrypt de node:crypto
        │   ├── decorators.ts      @Publico, @CurrentTenant, @CurrentUsuario
        │   └── pagination/        el cursor keyset reutilizable
        ├── prisma/
        │   ├── prisma.module.ts   el cliente extendido; no expone el crudo
        │   └── run-serializable.ts la transacción con reintento
        ├── tenancy/
        │   ├── tenant-context.ts  el AsyncLocalStorage del tenant
        │   ├── tenant-scope.ts    la extensión que sella tenantId, y el chequeo de arranque
        │   └── tenant-auth.guard.ts resuelve el centro, verifica el token y cruza los dos
        ├── auth/                  POST /sesiones
        ├── servicios/             ABM de tratamientos
        ├── ventanas-atencion/     GET y PUT de las franjas
        ├── disponibilidad/        los horarios de un día
        └── reservas/              el alta pública y la gestión del administrador
```

### Endpoints

Todos bajo `/api/v1`. El cuerpo de error es siempre `{ code, message }`: el `code` es un
identificador en inglés para el front, el `message` está en español porque lo lee una persona.

| Método | Ruta | Quién | Respuestas |
| --- | --- | --- | --- |
| `POST` | `/tenants/{slug}/sesiones` | público | `201` token · `400` · `401` `invalid_credentials` · `404` `tenant_not_found` |
| `GET` | `/tenants/{slug}/servicios` | público | `200` página · `400` `invalid_cursor` · `404` |
| `GET` | `/tenants/{slug}/servicios/{id}` | público | `200` · `404` `servicio_not_found` |
| `POST` | `/tenants/{slug}/servicios` | admin | `201` · `400` · `401` · `403` · `409` `servicio_name_taken` |
| `PATCH` | `/tenants/{slug}/servicios/{id}` | admin | `200` · `400` · `401` · `403` · `404` · `409` |
| `GET` | `/tenants/{slug}/servicios/{id}/disponibilidad?fecha=` | público | `200` · `400` · `404` |
| `GET` | `/tenants/{slug}/ventanas-atencion` | admin | `200` · `401` · `403` · `404` |
| `PUT` | `/tenants/{slug}/ventanas-atencion` | admin | `200` · `400` · `401` · `403` · `409` `ventanas_superpuestas` |
| `POST` | `/tenants/{slug}/reservas` | público | `201` · `400` `too_far_ahead` · `404` · `409` `slot_full` / `outside_business_hours` / `past_date` / `high_contention` |
| `GET` | `/tenants/{slug}/reservas` | admin | `200` página · `400` · `401` · `403` |
| `PATCH` | `/tenants/{slug}/reservas/{id}` | admin | `200` · `400` · `401` · `403` · `404` · `409` `invalid_transition` |

Once endpoints, ningún `DELETE` y ningún verbo en la URI. Los dos públicos que escriben
—crear sesión y crear reserva— tienen un límite de 5 por minuto.

### Datos

Cinco tablas. `Tenant` es la raíz y la única sin `tenantId`. `Usuario` guarda el
`passwordHash` y es único por `(tenantId, email)`. `Servicio` lleva duración, precio y seña en
centavos, y es único por `(tenantId, nombre)`. `VentanaAtencion` es una franja recurrente con
`diaSemana`, `horaInicio`, `horaFin`, `intervaloMinutos` y `capacidad`. `Reserva` guarda
`fecha` como `DATE`, `horaInicio` y `horaFin` como `"HH:mm"`, los datos de contacto de la
clienta como texto, y una copia de la seña.

La única regla que cruza filas y que vive en la base es la clave foránea compuesta
`Reserva(tenantId, servicioId) → Servicio(tenantId, id)`, que la genera Prisma sola: impide
que una reserva de un centro apunte a un tratamiento de otro incluso si la aplicación se
equivoca. Todo el resto de la integridad está en los DTO y en los services, porque esta
entrega no escribe una línea de SQL a mano.

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

## Qué decidí yo

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
abajo.

**La paginación es keyset y el `where` del cursor va adentro del `where` del llamador.**
Prisma tiene su propio `cursor`, y no lo uso: ese parámetro no pasa por la extensión de
tenant, así que un cursor falsificado con un id ajeno entraría crudo a la consulta. Con
keyset la fuga se cierra por construcción, no por un chequeo que alguien tiene que recordar.
Elegí cursor y no `offset` por el dominio: las reservas se ordenan por fecha y hora y las
altas entran *en el medio* de ese orden, así que con `offset` la página siguiente saltea
filas, y una reserva salteada es una clienta que llega y no está anotada.

**El catálogo público solo muestra lo que se puede reservar.** `?activo=` es un filtro común
y significa lo mismo para todos, pero el *default* depende de quién pregunta: sin token se
devuelven solo los activos, con token se devuelve todo, porque el ABM necesita administrar los
dados de baja. Mi primera versión no distinguía, y el catálogo público ofrecía tratamientos que
al reservarse daban `404`. Lo que sigue sin pasar es que un parámetro cambie el nivel de
acceso: cambia el valor por omisión, no el significado.

**El conflicto de un turno devuelve siempre el mismo código, incluso cuando sé más.** El alta
detecta el doble submit del formulario comparando el email con las reservas del horario, y al
principio le devolvía un código propio, `reserva_duplicada`, con el mensaje "ya tenés un turno
reservado". Era más amable y era un oráculo: cualquiera, sin token, podía averiguar si un email
dado tiene turno a una hora dada. Ahora los dos casos devuelven `slot_full`. Perdí un mensaje
útil para no publicar la agenda de una persona.

**No hay `DELETE` en ninguna parte.** La baja de un tratamiento es lógica, porque el
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
una llamada después del insert y un endpoint de webhook.

**Lo que dejé afuera a propósito, y qué implica.** Sin cuentas de cliente, la clienta no puede
cancelar ni reprogramar su turno: no hay con qué autenticarla, y la versión barata no es una
cuenta sino un token firmado en el mail de confirmación, que todavía no existe. Sin
expiración de las reservas pendientes, una abandonada retiene el cupo hasta que la
administradora la cancele. Sin notificaciones, nadie avisa nada. Y como el alta es pública y
anónima, cualquiera con `curl` puede llenar la agenda; el límite de 5 por minuto lo hace
molesto pero no imposible, y es lo único que hay.

## Cómo gestioné el contexto

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

## Qué salió mal

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
