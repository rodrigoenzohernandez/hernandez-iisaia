# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) con TypeScript y Tailwind 4. Lo eligió el usuario. El cliente HTTP se
genera del contrato OpenAPI del backend con `openapi-typescript`, no se escribe a mano. Un solo
build sirve a todos los centros: el slug del centro no se hornea, viaja en la URL.

## Users

Tres usuarios, servidos todos por este frontend, con un orden claro de prioridad.

La **clienta del centro** es la usuaria primaria. Llega casi siempre desde el teléfono, muchas
veces fuera del horario de atención, sabiendo más o menos qué tratamiento quiere pero no cuánto
sale ni cuándo hay lugar. Reservar no le pide cuenta: entra al centro por su dirección
(`/[slug]/...`), elige, deja sus datos y se va. Puede además entrar a "mis turnos" con un código
que le llega por mail —sin contraseña ni registro—, y ahí ver todos sus turnos, reprogramar y
cancelar según la política de cada tratamiento.

La **dueña / administradora del centro** ahora está dentro del alcance: registra su centro sola
desde la web (self-service) y lo gestiona desde el panel —tratamientos, horarios, cobros, conexión
con Mercado Pago y plan—. Es quien pone el centro a tomar turnos.

El **superadmin de la plataforma** es un usuario interno: monitorea todos los centros desde un
panel y los da de alta o de baja.

## Product Purpose

Reemplazar la toma de turnos por WhatsApp, ahora en varios centros a la vez. Antes los turnos se
anotaban a mano, lo que producía turnos pisados, señas que se cobraban según la memoria y una
agenda que vivía en una sola cabeza.

El éxito sigue siendo el de siempre, medido por centro: que una clienta que nunca habló con el
centro pueda reservar sola, sin preguntar nada por mensaje, y salir sabiendo qué reservó, cuándo,
cuánto es la seña y si quedó confirmada o pendiente. Lo nuevo es la infraestructura que lo hace
multicentro: que una dueña pueda poner su centro a tomar turnos sin intervención manual, y que la
plataforma pueda ver y administrar el conjunto.

## Positioning

La disponibilidad es real, no una solicitud. Un formulario de contacto promete que alguien va a
responder; acá la grilla que se ve es la grilla que existe, el cupo se controla contra la base en
el momento de reservar, y el turno queda tomado al apretar el botón. Cuando el centro cobra
online, la seña se cobra en el acto: no es una promesa de cobro a coordinar después.

## Operating Context

Multi-tenant de verdad. El backend expone cada centro bajo `/tenants/{slug}`; en el frontend el
slug es un segmento de la URL (`/[slug]/...`) y un solo build sirve a todos. Las superficies
cross-tenant —la landing de la plataforma, el registro de un centro, el panel de superadmin y la
vuelta de Mercado Pago— viven en la raíz, fuera del slug. No hay endpoint público que devuelva el
nombre del centro, así que el frontend lo deriva del slug (title-case).

La marca del producto es **Turnos**, la plataforma; cada centro es un tenant con su propio nombre.
`lo-de-lili` (Lo de Lili, plan Profesional, Mercado Pago conectado) y `bella-piel` (Bella Piel,
plan Básico) son centros de ejemplo del seed, no la marca.

Reservar siguen siendo tres llamadas sin token: catálogo, disponibilidad del día para ese
tratamiento, y alta. La cuenta de la clienta y el panel sí llevan token, y **un token es de un
solo centro**: por eso la sesión se guarda por centro, con el slug en la clave. Hay tres tipos de
token —administradora (8 h), clienta (30 días) y plataforma (8 h)—; uno de otro centro o del rol
equivocado cae a re-login.

Los horarios son hora de pared del centro, sin zona horaria. La plata viaja en centavos enteros.
La grilla del centro de ejemplo es de 45 minutos con pausa de mediodía: 09:00 a 12:45 y 15:00 a
18:45, de lunes a viernes, y sábado solo a la mañana. Mercado Pago vuelve siempre a una URL fija
para todos los centros (`/mercadopago/vuelta`), que recupera el slug de `sessionStorage`.

## Capabilities and Constraints

Lo que puede hacer la **clienta**: ver los tratamientos activos con duración, precio y seña; ver
los horarios de un día; reservar dejando nombre, email, teléfono y una nota, en efectivo o por
Mercado Pago. En un centro que cobra online, la reserva por Mercado Pago manda a un checkout real
(sandbox) y la seña se cobra en el acto; el efectivo nace `pendiente`. Con su cuenta (código por
mail) ve todos sus turnos —incluidos los que reservó sin cuenta con ese email—, y reprograma o
cancela según la política de cada tratamiento, con el aviso de la seña a perder antes de confirmar.

Lo que puede hacer la **dueña**: registrar su centro sola (nombre, slug y su propia cuenta de
administradora, con contraseña de 12 a 128), y desde el panel cargar tratamientos y horarios,
conectar Mercado Pago por OAuth, ver los cobros y subir o bajar de plan (la suscripción mensual se
autoriza por Mercado Pago).

Lo que puede hacer el **superadmin**: ver un resumen de la plataforma y la lista de todos los
centros, y darlos de alta o de baja (un centro de baja responde 404 en todas sus rutas de centro).

Planes: hay dos, **Básico** (gratis) y **Profesional**. El cobro online, las señas, los reembolsos
y los recordatorios son del Profesional; un centro cobra online solo si está en Profesional y
tiene Mercado Pago conectado. **Los precios son placeholder** ($0 y $19.900 por mes en el seed),
no un precio comercial fijado.

Lo que **no** existe y no hay que diseñar como si existiera:

- No se puede reservar con menos de 2 horas de anticipación ni a más de 90 días.
- Sin credenciales de Mercado Pago, ningún centro cobra online y el efectivo entra confirmado,
  como en el MVP.
- La confirmación del alta se arma con lo que devuelve el alta; para releer un turno más tarde hace
  falta la cuenta de la clienta.
- En desarrollo los mails salen por la consola de la API (incluido el código de ingreso de la
  clienta); no hay envío real configurado.

## Brand Commitments

La marca del producto es **Turnos**: una plataforma donde cada centro de estética tiene su agenda
de turnos online. En las superficies de plataforma la marca es "Turnos"; en las de un centro, el
nombre del centro, derivado de su slug. El sistema visual está documentado en DESIGN.md como un
mundo único —verde oliva a escala de campo, una sola familia variable, dato impreso y una espina
de 1px que cose la página— que se aplica igual a la plataforma y a todos los centros. Ese mundo es
el piso a respetar; la ejecución lo eleva en tipografía, ritmo y detalle en vez de reproducir un
template de stock.

## Evidence on Hand

Real y verificable:

- El contrato completo de la API en `../backend/openapi.json` (30 operaciones, 38 códigos de error)
  y la guía de integración post-MVP en `../docs/4.frontend-post-mvp-integracion.md`.
- Tres centros del seed con sus catálogos reales, dos usables de punta a punta: `lo-de-lili`
  (Profesional, Mercado Pago conectado) y `bella-piel` (Básico).
- Usuarios del seed: una administradora por centro, una clienta por centro (entra con código) y el
  superadmin `superadmin@turnos.test`.

**Ausente, y prohibido inventar:** para los centros de ejemplo, dirección, teléfono, redes,
trayectoria, nombres del equipo, testimonios y fotos del local real. Los precios de los planes y de
los tratamientos están marcados como placeholder. Todo texto descriptivo de un centro se autora
como contenido de demostración y se entrega marcado como tal.

## Product Principles

1. **La grilla no miente.** Un horario ocupado se muestra ocupado, no se esconde. Un día lleno
   tiene que verse lleno, no vacío.
2. **Reservar es el trabajo; todo lo demás lo sirve.** La reserva de la clienta es la razón de ser;
   el registro del dueño y el panel de superadmin son la infraestructura que la hace multicentro, no
   el centro de la escena.
3. **Decir qué pasó.** Confirmada, pendiente, ausente y cancelada significan cosas distintas para
   quien reservó, y la pantalla lo dice con esas palabras.
4. **El error se explica en el idioma de la clienta.** El backend devuelve mensajes en castellano
   listos para mostrar; la UI los usa en vez de inventar los suyos.
5. **No prometer lo que el sistema no hace,** y cumplir lo que sí: si el centro cobra online, la
   seña se cobra de verdad; si no, no se ofrece.

## Accessibility & Inclusion

Superficie mayormente móvil. El selector de horarios es el punto crítico: los estados disponible /
sin cupo / elegido tienen que distinguirse sin depender solo del color, y los objetivos táctiles
tienen que ser cómodos en un teléfono. Los mensajes de error van asociados a su campo, no solo
pintados de rojo. En el panel, los estados (plan, conexión de Mercado Pago, alta/baja) se codifican
también por estructura, nunca solo por tinte.
