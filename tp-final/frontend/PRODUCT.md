# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) con TypeScript y Tailwind 4. Lo eligió el usuario. El cliente HTTP se
genera del contrato OpenAPI del backend con `openapi-typescript`, no se escribe a mano.

## Users

La **clienta del centro** es la usuaria primaria y la única de este frontend. Llega casi siempre
desde el teléfono, muchas veces fuera del horario de atención, sabiendo más o menos qué
tratamiento quiere pero no cuánto sale ni cuándo hay lugar. No tiene cuenta y no va a crearse
una: entra, elige, deja sus datos y se va.

La administradora del centro existe como usuaria del producto pero **queda fuera del alcance de
esta entrega**: su panel es otra superficie y otro modo.

## Product Purpose

Reemplazar la toma de turnos por WhatsApp. Hoy los turnos se anotan a mano, lo que produce
turnos pisados, señas que se cobran según la memoria y una agenda que existe en una sola cabeza.

El éxito de esta superficie es que una clienta que nunca habló con el centro pueda reservar un
turno sola, sin preguntar nada por mensaje, y salir sabiendo qué reservó, cuándo, cuánto es la
seña y si le quedó confirmada o pendiente.

## Positioning

La disponibilidad es real, no una solicitud. Un formulario de contacto promete que alguien va a
responder; acá la grilla que se ve es la grilla que existe, el cupo se controla contra la base en
el momento de reservar, y el turno queda tomado al apretar el botón.

## Operating Context

La plataforma es multi-tenant: "Natura Estética Integral" es el primer centro, no el único.
El backend expone todo bajo `/tenants/{slug}`; el slug de este centro es `lo-de-lili`, heredado
del seed, y no hay endpoint que devuelva el nombre del centro, así que la marca la pone el
frontend.

Reservar son tres llamadas y ninguna lleva token: catálogo, disponibilidad del día para ese
tratamiento, y alta. Los horarios son hora de pared del centro, sin zona horaria. La plata viaja
en centavos enteros. La grilla real es de 45 minutos con pausa de mediodía: 09:00 a 12:45 y
15:00 a 18:45, de lunes a viernes, y sábado solo a la mañana. Domingo cerrado.

## Capabilities and Constraints

Lo que se puede hacer: ver los tratamientos activos con duración, precio y seña; ver los horarios
de un día para un tratamiento; y reservar dejando nombre, email, teléfono y una nota opcional,
eligiendo entre pagar la seña en efectivo o por Mercado Pago.

Lo que **no** existe y no hay que diseñar como si existiera:

- La clienta no puede cancelar ni reprogramar. No hay con qué autenticarla.
- No hay integración real de Mercado Pago: no hay checkout al que mandarla. Con ese método la
  reserva nace `pendiente` y la administradora la confirma a mano; con efectivo nace `confirmada`.
- No se manda ningún mail. Ni confirmación ni recordatorio.
- No hay membresías ni planes, aunque el prototipo original tuviera un selector.
- No hay endpoint público para leer una reserva ya creada: la confirmación solo puede mostrarse
  con lo que devolvió el alta.
- No se puede reservar con menos de 2 horas de anticipación ni a más de 90 días.

## Brand Commitments

El centro se llama **Natura Estética Integral**. El usuario fijó una referencia visual como piso:
acento verde lima, fotografía a sangre, tres tratamientos destacados numerados, bandas alternadas
con foto y footer oscuro. Esa referencia es el piso a respetar, no un techo: la ejecución la
eleva en tipografía, ritmo y detalle en vez de reproducir un template de stock.

## Evidence on Hand

Real y verificable:

- El contrato completo de la API en `../backend/openapi.json`, con sus 11 endpoints y sus 17
  códigos de error.
- Los ocho tratamientos del centro, con duración, precio y seña reales del seed: Depilación,
  Botas de compresión, Mio Up, Electroestimulación, Presoterapia, Venus, Dermo Health y HIFU.
- La grilla de atención real, confirmada contra el bundle del prototipo original.

**Ausente, y prohibido inventar:** dirección, teléfono, redes sociales, años de trayectoria,
nombres del equipo, testimonios de clientas y fotos del local real. Los precios del seed están
marcados como placeholder en el plan del backend. El texto descriptivo del centro se autora como
contenido de demostración y se entrega marcado como tal, con la lista de huecos a completar.

## Product Principles

1. **La grilla no miente.** Un horario ocupado se muestra ocupado, no se esconde. Un día lleno
   tiene que verse lleno, no vacío.
2. **Reservar es el trabajo; todo lo demás lo sirve.** La acción de reservar está siempre a un
   toque de distancia y nunca compite con otra.
3. **Decir qué pasó.** Confirmada y pendiente significan cosas distintas para quien reservó, y la
   pantalla lo dice con esas palabras.
4. **El error se explica en el idioma de la clienta.** El backend ya devuelve mensajes en
   castellano listos para mostrar; la UI los usa en vez de inventar los suyos.
5. **No prometer lo que el sistema no hace.** Sin mails, sin cancelación online, sin checkout.

## Accessibility & Inclusion

Superficie mayormente móvil. El selector de horarios es el punto crítico: los estados
disponible / sin cupo / elegido tienen que distinguirse sin depender solo del color, y los
objetivos táctiles tienen que ser cómodos en un teléfono. Los mensajes de error van asociados a
su campo, no solo pintados de rojo.
