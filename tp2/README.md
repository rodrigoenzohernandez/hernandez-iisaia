# TP 2 — API de gestión de usuarios internos

Un `openapi.yaml` que describe el backoffice de usuarios de un sistema interno de gestión de empleados: login con refresh token, CRUD de usuarios con dos roles, y el historial de cambios de cada usuario. Ocho endpoints en cinco paths, sin nada implementado: el entregable es el contrato.

## Cómo se ejecuta

No hay nada que correr: el entregable es el contrato. Para leerlo renderizado, pegar [openapi.yaml](openapi.yaml) en [editor.swagger.io](https://editor.swagger.io), que además lo valida.

## Qué me propuse construir

El backoffice que tiene cualquier sistema interno. Elegí este dominio porque me tocó desarrollarlo varias veces. Un usuario no se registra solo, lo da de alta un administrador. Un empleado que se va no se borra de forma física, sino de forma lógica.

## Decisiones que tomé yo

**El histórico es un recurso.** El audit log es un recurso en sí mismo.

**Los roles son un campo, no un sub-recurso.** Con dos roles excluyentes —`admin` y `hr_analyst`— un usuario tiene exactamente uno.

**Los roles parten escritura, no lectura.** Cualquier usuario autenticado lista usuarios y ve el detalle de cualquiera: el padrón es información de trabajo del área, y esconderlo entre compañeros no protege nada. Lo que solo puede hacer un admin es escribir —alta, edición, baja— y leer el `audit-log`. El historial sí es distinto del dato: dice quién tocó qué, y eso es control sobre el que administra, no sobre el empleado.

**Paginación por cursor en `GET /users`.** El listado devuelve `{ data, next_cursor }` con `limit` y `cursor`, en vez de un array pelado. Elegí cursor y no `offset`/`page` porque la lista se ordena por alta y crece por el final: con offset, dar de alta a alguien mientras alguien más pagina corre todo y repite o saltea filas. El `next_cursor` es opaco a propósito —el cliente lo devuelve tal cual— así que el día que cambie el criterio de orden, cambia el servidor y ningún cliente se entera. El costo es que no hay "ir a la página 7", y para un padrón de empleados no lo necesito.

**No se puede dar de baja ni degradar al último admin.** `DELETE /users/{id}` y `PATCH /users/{id}` devuelven `409` con code `last_admin` si la operación dejaría al sistema sin ningún admin activo. Sin esto el contrato se puede suicidar: como no hay auto-registro ni reactivación, el momento en que se va el último admin nadie puede volver a dar de alta a nadie, y la API queda de solo lectura para siempre. Es la única regla que puse mirando no lo que el endpoint hace sino el estado en el que deja al sistema.

**El primer admin no sale de la API.** `POST /users` exige estar autenticado como admin, así que el primero es imposible de crear por ahí. Se siembra al instalar, y por eso `AuditEntry.performed_by` es nullable: esa única entrada la escribió el sistema, no una persona.

**`DELETE` que no borra.** La baja es lógica pero el method sigue siendo `DELETE`, con `204` y sin cuerpo.

**La baja es idempotente.** Dar de baja a alguien que ya está dado de baja devuelve `204` igual y no pisa la fecha original. No devolver `404`: el usuario existe, es el punto de la baja lógica. No actualizar la fecha: la fecha que importa es la de la primera vez. Y no escribir una entrada nueva en el `audit-log`: el historial cuenta lo que pasó, y la baja pasó una sola vez por más veces que se la pida.

**El email queda ocupado para siempre.** `POST /users` devuelve `409` si el email ya está reservado, y la reserva no se levanta nunca. Cubre dos casos que al principio se me habían escapado: los usuarios dados de baja, y los emails que alguien tuvo antes de un cambio de email. Los dos por el mismo motivo: si el registro y su historial se conservan, reusar el email dejaría dos filas históricas con el mismo, y el historial dejaría de poder leerse. Reservar solo el email actual hubiera dejado la regla a medias, porque un `PATCH` de email liberaba por la ventana lo que el `409` cuidaba por la puerta.

**El `409` dice cuál de los dos choques fue.** Chocar contra un usuario activo y chocar contra uno dado de baja son la misma regla pero no el mismo problema: del primero se sale eligiendo otro email, del segundo no se sale por API porque no hay reactivación. El status es el mismo —la petición entra en conflicto con el estado del recurso, eso es un `409`— y lo que cambia es el `code` del cuerpo: `email_taken` o `email_taken_by_deactivated_user`. Consideré devolver `404` en el segundo caso y lo descarté: `POST /users` no busca nada, así que un `404` diría que la colección no existe. Y el mensaje tampoco puede ser "hablá con un administrador", porque el único que puede llegar a ese error ya es el administrador.

**Lo que dejé afuera a propósito.** No hay cambio de contraseña, ni reactivación, ni logout. Los tres son alcance, pero vale decir qué implican mientras no estén: sin cambio de contraseña, el admin que da el alta conoce la contraseña de esa persona mientras la cuenta viva; sin logout, el único modo de invalidar un refresh token robado es dar de baja al usuario entero. No son consecuencias neutras, son la deuda que deja el recorte.

## Qué salió mal y cómo lo corregí

Mi prompt inicial podría haber sido más detallado, y me di cuenta después de enviarlo. No describí la jerarquía de recursos por lo que tuve que iterar con el modelo para definirlo, en vez de haberlo definido mejor de entrada.

Lo segundo pasó en la revisión: llegué con un cambio ya decidido —devolver `404` al intentar crear un usuario con el email de uno dado de baja, con un mensaje de "hablá con un administrador"— y estaba mal por partida doble. `POST /users` no busca nada, así que el `404` habría dicho que la colección no existe; y el mensaje se lo estaría dando al administrador, que es el único que puede llegar a ese error. El problema que yo había olido era real, pero iba en el cuerpo del error, no en el status. Me sirve como recordatorio de que traer la solución escrita en el prompt es cómodo pero sesga: el modelo tenía que rechazármela y podría no haberlo hecho.

Lo tercero lo encontró la revisión automática, y es lo que peor me cae: mi regla de que el email queda ocupado para siempre estaba escrita en este README y el contrato no la cumplía, porque el `PATCH` de email liberaba el viejo por la ventana. Había revisado el contrato endpoint por endpoint y no lo vi, porque miré cada operación por separado y el agujero solo aparece cruzando dos.

## Prompts

El registro completo está en [prompts.md](prompts.md). Son tres, en dos sesiones: los dos primeros generan el contrato —el inicial fija el dominio y las reglas, el segundo resuelve las decisiones que el primero había dejado abiertas sin que yo lo notara— y el tercero lo revisa con la skill `code-review`.
