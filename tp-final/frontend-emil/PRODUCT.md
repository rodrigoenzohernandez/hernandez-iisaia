# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) con TypeScript y Tailwind 4. Es un proyecto aparte de `../frontend`,
que es la aplicación completa; este es **solo la landing**, una segunda mano visual sobre el
mismo producto y el mismo contenido real. Motion (Framer Motion) para el movimiento, porque la
dirección se juega en gran parte en la interacción.

## Users

La **clienta del centro**: llega casi siempre desde el teléfono, muchas veces fuera del horario
de atención, sabiendo más o menos qué tratamiento quiere pero no cuánto sale ni cuándo hay lugar.
No conoce el centro todavía o lo conoce de nombre. Esta superficie es lo primero que ve.

## Product Purpose

Que una clienta que nunca habló con el centro **quiera reservar** y entienda, en segundos, que
puede hacerlo sola, sin mandar un mensaje y esperar respuesta. La landing no toma el turno: lleva
a la aplicación que sí lo hace (`../frontend`). Su trabajo es persuadir, no operar.

El éxito es que alguien que cae en la página sepa qué es el centro, por qué sacar turno acá y no
por WhatsApp, y apriete "Reservar" con ganas.

## Positioning

La disponibilidad es real, no una solicitud. En otros lados un formulario de contacto promete que
alguien va a responder; acá el turno se toma solo, la grilla que se ve es la que existe y el cupo
se controla contra la base al reservar. La landing tiene que **transmitir esa certeza** antes de
que la clienta llegue a la grilla.

## Operating Context

La plataforma es multi-tenant: "Natura Estética Integral" es el primer centro. El nombre lo pone
el frontend (no hay endpoint que lo devuelva). La landing es estática en contenido: no consume la
API en vivo salvo, a lo sumo, el catálogo público de tratamientos para no repetir datos a mano.
El botón primario lleva a la ruta de reserva de la aplicación.

## Capabilities and Constraints

Lo que la landing muestra y promete:

- Qué es el centro y por qué reservar acá (la certeza de la disponibilidad real).
- Los tratamientos reales, con su duración, precio y seña.
- Cuándo atiende el centro.
- Un único camino a la acción: reservar.

Lo que **no** hace y no hay que diseñar como si lo hiciera:

- No toma el turno ni muestra la grilla de horarios: eso vive en la aplicación.
- No pide datos ni tiene formulario de contacto.
- No inventa prueba social, trayectoria ni datos de contacto que no existen.

## Brand Commitments

El centro se llama **Natura Estética Integral**. **Restricción deliberada de esta entrega: el
mundo visual tiene que ser distinto al de `../frontend`.** Ese primer frontend es "el régimen
empaquetado" —verde oliva a escala de página, borde duro cero radio, una sola grotesca variable
(Archivo) en dos anchos, foto a sangre, una espina de 1px—. Este segundo frontend parte de otra
semilla y llega a otro mundo: la comparación de las dos manos sobre el mismo contenido es el
punto del ejercicio, así que repetir la paleta, la tipografía o la estructura del primero sería
fallar la consigna. El rubro (estética/belleza) tiene su propio default gastado —foto difuminada,
serif fina, crema, calma en foco suave— y tampoco es el destino.

## Evidence on Hand

Real y verificable:

- Los ocho tratamientos del centro, con duración, precio y seña reales del seed: Depilación,
  Botas de compresión, Mio Up, Electroestimulación, Presoterapia, Venus, Dermo Health y HIFU.
- La grilla de atención real: lunes a viernes 9:00–13:30 y 15:00–19:30, sábado 9:00–13:30,
  domingo cerrado.
- El contrato de la API en `../backend/openapi.json`, por si la landing lee el catálogo público.

**Ausente, y prohibido inventar:** dirección, teléfono, redes, años de trayectoria, nombres del
equipo, testimonios y fotos del local real. El texto descriptivo se autora como contenido de
demostración y se entrega marcado como tal, con la lista de huecos a completar. Los precios del
seed están marcados como placeholder.

## Product Principles

1. **La certeza antes que la calma.** El rubro vende relajación; el diferencial de este producto
   es que el turno se toma de verdad, solo, al instante. Eso es lo que la landing tiene que hacer
   sentir.
2. **Una sola acción.** Reservar está siempre a un toque y nunca compite con otra cosa.
3. **El dato es la prueba.** Precio, seña, duración y horario reales, a la vista: son lo que
   diferencia de un formulario de contacto que promete una respuesta.
4. **No prometer lo que no hay.** Sin testimonios inventados, sin trayectoria falsa, sin datos de
   contacto que no existen.

## Accessibility & Inclusion

Superficie mayormente móvil: se diseña y se prueba primero a 390px. El movimiento respeta
`prefers-reduced-motion`. El contraste de texto cumple AA. La acción primaria es alcanzable con
teclado y lectores de pantalla, y no depende de un gesto o un hover para existir.
