# Prompts — TP 2

Dos sesiones: una para generar el contrato y otra, días después, para revisarlo. El registro va tal como pasó.

## 1 - Prompt inicial

Vamos a hacer el TP2, lo que quiero modelar es un login + CRUD de usuarios para un sistema interno de gestión de empleados.

- Login
- Refresh token
- Todos los endpoints de CRUD
- Los usuarios tienen que tener roles, admin o común (analista de rh)
- El alta de usuarios tiene que ser posible a traves de un admin, es decir, no se dan de alta solos
- Quiero que la baja de usuarios sea logica, no un delete de la base, porque me sirve el historico

Alguna duda, sino procede

**Qué intentaba lograr:** Fijar el dominio y las cuatro reglas que no quería que el modelo eligiera por mí: que haya refresh token, que el rol sea parte del usuario, que el alta la haga un admin y que la baja sea lógica. Cerré con "alguna duda, sino procede" para dejarle la puerta abierta a preguntar, que en el TP1 es lo que no había pasado.

**Qué devolvió:** No procedió. Me frenó con algo que yo no había visto: lo que describí no tiene jerarquía de recursos. Login, refresh y CRUD de usuarios son un solo recurso más dos endpoints de auth, y no hay ningún `/algo/{id}/otra-cosa` por ningún lado. Ese es el requisito 2 de la consigna. Me ofreció tres formas de resolverlo —sesiones anidadas al usuario, un historial de cambios, o los roles como sub-recurso— y por separado tres formas de escribir la baja lógica en el contrato.

**Qué hice con eso:** Contesté las dos preguntas en vez de mandarlo a generar igual. Prompt 2.

## 2 - Las dos decisiones que faltaban

De las tres opciones de jerarquía elegí el **historial de cambios**, `/users/{userId}/audit-log`.

De las tres formas de escribir la baja elegí el **DELETE que marca inactivo**: `DELETE /users/{userId}` devuelve 204, el servidor pone la fecha y la fila no se borra.

**Qué intentaba lograr:** Resolver la jerarquía con algo que ya necesitaba en serio en vez de inventar un recurso para cumplir el requisito. Si el motivo de la baja lógica es quedarme con el histórico, el histórico tiene que poder leerse desde algún lado, y ese lado es un sub-recurso del usuario. Descarté las sesiones porque exponer las sesiones activas de cada empleado es otro sistema, no éste. Descarté los roles como sub-recurso porque con dos roles excluyentes un usuario tiene exactamente uno, así que es un campo y anidarlo sería disfrazar de colección algo que no lo es.

**Qué devolvió:** El `openapi.yaml` completo. 8 endpoints en 5 paths: los dos de auth, el listado y alta en `/users`, el detalle, edición y baja en `/users/{userId}`, y el historial en `/users/{userId}/audit-log`.

**Qué hice con eso:** Lo revisé utilizando el Swagger editor.

## 3 - La revisión con la skill `code-review`

Sobre el contrato ya generado corrí la skill `code-review` de Claude Code, sin pedirle nada puntual.

**Qué intentaba lograr:** Aplicar una revisión en base a las buenas prácticas definidas por Anthropic en la skill de code-review.

**Qué devolvió:** Varios hallazgos:

- Último admin: DELETE y PATCH ahora dan 409 + code last_admin. Sin eso, el día que se va el último admin la API queda de solo lectura para siempre — no hay auto-registro ni reactivación.
- PATCH de email: La regla "el email queda ocupado para siempre" la rompía tu propio PATCH: cambiar el email de alguien liberaba el viejo, y después un POST lo reusaba. La reserva ahora cubre los emails históricos.
- Primer admin: No se puede crear por API (POST /users exige admin). Documentado como semilla, y performed_by pasó a nullable para poder auditar esa entrada.
- audit-log: vacío La descripción prometía array vacío "si nunca se lo editó", pero created siempre existe. Era inalcanzable.
- Error.message: Decía "quien está cargando el alta" y lo usa también el PATCH. Ese lo metí yo el turno pasado.
/auth/refresh Le faltaba el 400 que /auth/login sí tenía: mismo error, dos criterios.
- GET /users 400: Ahora lleva cuerpo con invalid_cursor / invalid_limit — el cliente necesita distinguir "reintentá sin cursor" de "tu código está mal".
- Validación maxLength en email, full_name y password. En 3.1 format es anotación, no valida: sin esto un password de 1 MB entra derecho al KDF.
- Tooling servers, operationId y tags en las 8 ops, userId a components/parameters. Sin servers, "Try it out" en Swagger Editor pega contra el host del editor.
- Entre otros hallazgos que decidí descartar.

**Qué hice con eso:** No apliqué los quince. Descarté algunos que no consideré importantes en base al aclance del TP y le pedí que solucione los más importantes.
