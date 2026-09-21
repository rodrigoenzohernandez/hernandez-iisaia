# Prompts — TP 2

Dos sesiones: una para generar el contrato y otra, días después, para revisarlo. El registro va tal como pasó, incluida la idea mía que el modelo me rechazó con razón.

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

## 3 - La revisión, y un `404` que estaba mal

Revisa mi tp2, cambiarias algo? quizas agregaría como decisión y modificaría el swagger para que cuando se esta intentando crear un usuario que esta dado de baja, tire 404 y diga que tiene que hablar con un administrador o algo asi.

**Qué intentaba lograr:** Dos cosas a la vez, y esa fue la parte que salió bien: pedí una revisión abierta, pero además puse sobre la mesa un cambio concreto que ya tenía decidido. Quería ver si me lo discutía o si me lo implementaba sin chistar, que es lo que me había pasado en el TP1.

**Qué devolvió:** Me lo discutió. El `404` estaba mal por dos motivos que no había visto: `POST /users` no busca nada, así que un `404` ahí diría que la colección no existe, no que el email está tomado; y el mensaje "hablá con un administrador" no tiene sentido porque el único que puede llegar a ese error ya es el administrador. Lo que sí rescató fue el problema de fondo: el `409` no distinguía chocar contra un usuario activo de chocar contra uno dado de baja, y como no hay reactivación, el segundo caso deja al admin sin salida y sin enterarse. Lo resolvió donde iba, en el cuerpo del error, con un `code`. Además me marcó cuatro cosas más: que `hr_analyst` podía leer todo sin que el contrato lo dijera, que la idempotencia del `DELETE` no aclaraba si escribía en el audit-log, que `GET /users` no paginaba, y que el `400` del alta no mencionaba el largo mínimo del password.

**Qué hice con eso:** Acepté el rechazo del `404` y pedí que arreglara los cuatro puntos. La paginación la pedí explícitamente por cursor.

## 4 - Los arreglos, y una segunda revisión automática

Le pedí que resolviera los cuatro puntos —dejando claro que RH puede leer a todos pero solo los admin escriben, y que el audit-log es solo de admin— y después le pedí que pasara `/code-review` sobre el resultado.

**Qué intentaba lograr:** No quedarme con la primera revisión. La primera la había pedido yo en lenguaje suelto; quería ver qué encontraba una pasada sistemática sobre el contrato ya corregido.

**Qué devolvió:** Quince hallazgos. El que más me importó: mi regla de "el email queda ocupado para siempre" la rompía mi propio `PATCH`, porque cambiar el email de alguien liberaba el viejo y después un `POST` lo podía reusar. La regla estaba escrita en el README y el contrato no la cumplía. También encontró que el contrato se podía suicidar —dar de baja o degradar al último admin dejaba la API de solo lectura para siempre, sin auto-registro ni reactivación—, que el primer admin era imposible de crear por API, y que la descripción del audit-log prometía un array vacío que nunca podía pasar porque el alta siempre deja una entrada.

**Qué hice con eso:** No apliqué los quince. Separé los que eran contradicciones internas del contrato (esos van sí o sí: el email, el último admin, el array vacío) de los que eran alcance ya declarado. El `429` en login lo descarté: es política de deployment, y meterla a medias en el contrato es decorado. Lo que dejé afuera lo escribí como deuda en el README, con su costo: sin cambio de contraseña, el admin conoce la contraseña de cada uno; sin logout, un refresh token robado solo se invalida dando de baja al usuario entero. Queda abierto si el audit-log también se pagina.
