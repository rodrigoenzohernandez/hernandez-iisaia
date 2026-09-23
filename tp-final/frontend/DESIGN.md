---
name: Natura Estética Integral
description: Un régimen empaquetado — verde oliva a escala de página, dato impreso y una espina que cose la página entera.
colors:
  verde: "#a8c63c"
  verde-vivo: "#c3e24d"
  verde-hondo: "#46591a"
  verde-humo: "#dfe7c4"
  tinta: "#16190f"
  tinta-suave: "#3a4030"
  tinta-tenue: "#6b7259"
  papel: "#f6f7f2"
  papel-hueso: "#e9ece0"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.05rem, 4.6vw, 3.9rem)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 2.9vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.22rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
    fontVariation: "'wdth' 82"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.18em"
    fontVariation: "'wdth' 82"
  ordinal:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 4vw, 3.6rem)"
    fontWeight: 800
    lineHeight: 0.85
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 125"
    fontFeature: "'tnum' 1"
  cifra:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
rounded:
  duro: "0px"
  foco: "1px"
  pildora: "9999px"
spacing:
  fino: "0.5rem"
  fila: "1.75rem"
  bloque: "3rem"
  seccion: "6rem"
  seccion-amplia: "8rem"
  canal: "1.5rem"
  canal-amplio: "3rem"
  espina: "1.75rem"
  espina-amplia: "2.5rem"
components:
  button-verde:
    backgroundColor: "{colors.verde}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.duro}"
    padding: "0.875rem 1.75rem"
  button-verde-hover:
    backgroundColor: "{colors.verde-vivo}"
    textColor: "{colors.tinta}"
  button-tinta:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    typography: "{typography.label}"
    rounded: "{rounded.duro}"
    padding: "0.875rem 1.75rem"
  button-tinta-hover:
    backgroundColor: "{colors.tinta-suave}"
    textColor: "{colors.papel}"
  button-borde:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.duro}"
    padding: "0.875rem 1.75rem"
  button-borde-hover:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
  campo:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.duro}"
    padding: "0.75rem 1rem"
    width: "100%"
  horario-libre:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.cifra}"
    rounded: "{rounded.duro}"
    padding: "0.75rem 0"
  horario-libre-hover:
    backgroundColor: "{colors.verde-humo}"
    textColor: "{colors.tinta}"
  horario-elegido:
    backgroundColor: "{colors.verde-vivo}"
    textColor: "{colors.tinta}"
    typography: "{typography.cifra}"
    rounded: "{rounded.duro}"
  horario-lleno:
    backgroundColor: "rgba(22,25,15,0.04)"
    textColor: "rgba(22,25,15,0.35)"
    typography: "{typography.cifra}"
    rounded: "{rounded.duro}"
  dia-elegido:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    typography: "{typography.cifra}"
    rounded: "{rounded.duro}"
    height: "2.75rem"
  fila-catalogo:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.duro}"
    padding: "1.5rem 0"
  fila-catalogo-hover:
    backgroundColor: "rgba(223,231,196,0.45)"
  resumen-turno:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.duro}"
    padding: "2rem 1.75rem"
  aviso:
    backgroundColor: "{colors.verde-humo}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.duro}"
    padding: "1.25rem 1.5rem"
---

# Design System: Natura Estética Integral

## Overview

**Creative North Star: "El régimen empaquetado"**

La superficie se comporta como la caja de una línea de activos seria: paso numerado, minutos, porcentaje, precio, impresos y legibles. No como el template de spa que promete calma en foco suave y esconde el dato. Acá el dato se imprime y el turno se toma: el precio, la duración, la seña y la hora libre están a la vista antes de que la clienta se comprometa con nada.

La densidad es alta pero ordenada por un solo eje vertical. Verde oliva vivo comprometido a escala de página —campos enteros, nunca acentos salpicados— contra un carbón verdoso casi negro y un blanco levemente verdeado para los pasajes de lectura larga. Fotografía a sangre como suelo, siempre manos trabajando sobre piel: el mecanismo es el tacto, no el clima. Todo borde es duro: no hay radio, no hay degradé sobre los campos de color, no hay sombra.

Un solo sistema tipográfico variable llevado a los dos extremos de su eje de ancho hace el trabajo que en otro sistema pediría una segunda familia: caps anchas y pesadas para las declaraciones, angosta para las fichas. Se rechaza explícitamente el arreglo de categoría: foto difuminada, serif fina, crema, y un formulario de contacto que promete que alguien va a responder.

**Key Characteristics:**
- Verde a escala de campo, nunca salpicado como acento decorativo.
- Cero radio y cero sombra: la profundidad es campo de color y foto a sangre.
- Una sola familia variable en dos anchos extremos (125% / 82%).
- Numerales tabulares en todo dato: precio, hora, fecha, duración, ordinal.
- Una espina de 1px que cose las dos rutas y de la que cuelga todo el contenido.
- El estado se lee por estructura antes que por tinte.

## Colors

Una paleta de tres familias —verde de campo, tinta carbón verdoso, papel verdeado— sin crema, sin gris neutro y sin un segundo acento.

### Primary
- **Verde oliva vivo** (`{colors.verde}`): el color de compromiso. Se usa en campos enteros —el campo del hero sobre la foto, el botón primario, el sello de confirmación, el subrayado del enlace de reserva en el encabezado— y como micro-etiqueta sobre tinta. Nunca como salpicadura decorativa.
- **Verde luz** (`{colors.verde-vivo}`): exclusivo de lo elegido y del hover del botón primario. Es lo más luminoso de la página; el horario seleccionado en la grilla es el único bloque que lo lleva de relleno.
- **Verde hondo** (`{colors.verde-hondo}`): la voz del verde sobre papel, donde el verde de campo no llega a contraste. Lleva los ordinales 01/02/03, las micro-etiquetas ("Con valoración previa", duración · precio de los destacados), el anillo de foco, el caret de los campos y el borde de la opción de pago elegida.
- **Verde humo** (`{colors.verde-humo}`): el lavado de hover de las filas del catálogo y de la grilla de días, el fondo de los avisos y el de la nota de cierre de la confirmación.

### Neutral
- **Tinta** (`{colors.tinta}`): texto por defecto sobre papel, y fondo de las superficies oscuras (encabezado interior, pie, panel de resumen del turno, día elegido del calendario, botón secundario). Es el par obligatorio del verde.
- **Tinta suave** (`{colors.tinta-suave}`): párrafos de apoyo y texto secundario sobre papel; hover del botón tinta.
- **Tinta tenue** (`{colors.tinta-tenue}`): metadatos de baja jerarquía (duración, seña en la ficha), placeholders, letras de los días de la semana y el pulgar del scrollbar. Es el piso de contraste sobre papel (≈4.7:1); por debajo de este tono no hay texto de lectura.
- **Papel** (`{colors.papel}`): el fondo del documento y el texto sobre superficies tinta.
- **Papel hueso** (`{colors.papel-hueso}`): el segundo plano de papel, usado para separar la sección de destacados del resto sin dibujar una línea; también la pista del scrollbar.

### Named Rules

**La regla de la tinta sobre verde.** Nunca texto claro sobre `{colors.verde}` ni sobre `{colors.verde-vivo}`: el verde no llega a 4.5:1 contra blanco. La tinta sí, y con holgura (≈9:1 a opacidad plena, ≈5.2:1 hasta 70% de alfa). Esa regla gobierna todo botón, campo y chip verde del sistema.

**La regla del campo entero.** El verde se compromete a escala de página: ocupa un campo completo de borde duro, sin degradé. Si un verde aparece en un elemento del tamaño de un ícono o una línea suelta y decorativa, está mal usado; sobre papel ese lugar es de `{colors.verde-hondo}`.

**La regla de la luz.** Lo elegido es lo más luminoso de la pantalla. `{colors.verde-vivo}` de relleno pertenece al horario seleccionado y al hover del botón primario, y a nada más.

## Typography

**Familia única:** Archivo variable (eje `wdth`), con `ui-sans-serif, system-ui, sans-serif` de reserva. Se carga por `next/font` y se expone como `--fuente`; `font-synthesis-weight` está apagado para que ningún peso se falsifique.

**Character:** una grotesca de cara limpia forzada a sus dos extremos de ancho. Las declaraciones van en caps anchas, pesadas y de tracking negativo, y se leen como impresas sobre un envase; las fichas y los párrafos van angostos y se leen como una etiqueta de datos.

### Hierarchy
- **Display** (800, `clamp(2.05rem, 4.6vw, 3.9rem)`, lh 0.94, tracking -0.03em, caps, ancha): el titular del hero y el cierre. Máximo 17–18ch con `text-balance`.
- **Headline** (700, `clamp(1.6rem, 2.9vw, 2.5rem)`, lh 1.02, tracking -0.025em, caps, ancha): títulos de sección en ambas rutas. Dentro del flujo de reserva baja a `clamp(1.4rem, 2.4vw, 2rem)`.
- **Title** (700, 1.02–1.35rem, lh 1.1, tracking -0.015em, caps, ancha): nombre de tratamiento en tarjeta, en fila de catálogo y en título de paso.
- **Body** (400, 1.02rem, `leading-relaxed`, angosta): párrafos de lectura. Medida entre 42ch y 62ch; nunca al ancho del contenedor.
- **Label** (600, 0.58–0.8rem, tracking 0.12em–0.3em, caps, angosta): etiquetas de formulario, rótulos de dato, nav, botones y las etiquetas del pie y del panel de resumen. El tracking sube con el tamaño chico: 0.3em a 0.62rem, 0.12em a 0.8rem.
- **Ordinal** (800, `clamp(2.4rem, 4vw, 3.6rem)`, lh 0.85, tracking -0.035em, ancha, tabular): los 01/02/03 de la landing, en verde hondo. En el riel de pasos del flujo baja a 1.2rem y el peso codifica el estado (800 en curso / 600 recorrido / 300 no alcanzado).

### Named Rules

**La regla de los dos extremos.** Un solo sistema tipográfico: `.ancha` (`font-stretch: 125%`) para todo lo que declara y `.angosta` (`font-stretch: 82%`) para todo lo que informa. El eje de ancho hace el trabajo expresivo que en otro sistema haría una segunda familia. No se agrega una segunda familia ni una serif de contraste.

**La regla del numeral como dato.** Todo numeral que se pueda comparar en columna —precio, seña, hora, fecha, duración, día del mes, ordinal— lleva `.cifra` (`tabular-nums` + `"tnum" 1`). Una cifra sin `.cifra` es un bug de composición.

**La regla de la caja alta corta.** Las mayúsculas son para títulos, etiquetas y botones. Ningún párrafo de lectura va en caps.

## Layout

Un canal único gobierna las dos rutas: contenedor `max-w-[1380px]` centrado, con gutter de 1.5rem que pasa a 3rem desde 1024px. La landing apila secciones de ritmo largo (6rem de padding vertical, 8rem desde 1024px) alternando fondo papel y papel hueso, con dos secciones de fondo tinta —el bloque del centro y el pie— como anclas oscuras. El flujo de reserva usa el mismo canal con ritmo más corto (4rem / 6rem).

**La espina** es el riel: un `div` absoluto de 1px en `verde/45` que replica exactamente el gutter y el ancho máximo del canal, de modo que cae sobre el borde izquierdo del contenido. Todo contenedor que vive bajo la espina se despega con `pl-7` (`lg:pl-10`). Corre en todos los anchos salvo sobre el hero, donde es solo de escritorio (`hidden lg:block`): a ancho de teléfono el campo verde va a sangre y la línea le cruzaría el titular, así que ahí arranca al terminar el hero y baja sin cortes hasta el cierre.

Composición del primer viewport: foto a sangre con velo de tinta (25% en móvil; degradé de 45% a transparente desde 1024px) y encima un campo verde de borde duro anclado abajo a la izquierda, que ocupa ~62% del ancho y ~70% del alto en escritorio y va a sangre completo en móvil. Asimétrico y fuera de eje, nunca centrado.

Rejillas observadas: pasos en `5.5rem / 19rem / 1fr` desde 768px, alineados a baseline; destacados en 1 → 2 → 3 columnas; filas del catálogo en `1.6fr / 7rem / 8rem / 8rem / 2rem` desde 768px y en dos columnas apiladas por debajo; grilla de horarios en 3 → 4 columnas; calendario en 7 columnas fijas con `max-w-[22rem]`; paso 3 en `1fr / 20rem` con el resumen reordenado al tope en móvil.

**La regla de la espina.** Ninguna sección se apila como banda suelta: cuelga del riel. Un bloque nuevo respeta `pl-7 / lg:pl-10` o rompe la única continuidad vertical que tiene la página.

## Elevation & Depth

Este sistema **no usa sombras**. No hay una sola `box-shadow` en el build. La profundidad se construye por campo de color y por foto a sangre: el campo verde se apoya sobre la fotografía con un velo de tinta, las superficies tinta cortan el flujo de papel como bloques macizos, y el escalonado papel → papel hueso separa secciones sin dibujar una línea. Las separaciones internas son hairlines de `tinta/15` (o `papel/12–15` sobre oscuro), nunca bordes gruesos.

El único movimiento en Z es la foto de los destacados, que escala a 1.04 en hover durante 700ms con `--ease-salida`; la tarjeta no se levanta.

**La regla del plano.** Superficies planas siempre. Si un elemento necesita destacarse, cambia de campo de color o de peso tipográfico, no de altura.

## Shapes

Borde duro por defecto: radio 0 en botones, campos, tarjetas, filas, avisos, horarios y días del calendario. Tres excepciones documentadas y acotadas: el anillo de foco lleva 1px de radio para que la esquina no se vea astillada, el pulgar del scrollbar es una píldora, y el sello de confirmación es un círculo de 2.75rem porque es una insignia y no una superficie.

Los bordes son de 1px y siempre translúcidos sobre el fondo (`tinta/12`, `tinta/20`, `tinta/15`, `papel/12`) salvo cuando marcan estado, donde toman color pleno (`verde-hondo` en la opción de pago elegida, `verde-vivo` en el horario elegido, `tinta` en el hover del botón de borde).

Los íconos son un set dibujado a mano en SVG de 24 de viewBox, trazo `currentColor` de 1.5, cap y join redondos, sin relleno: flecha, flecha izquierda, tilde, reloj y el sello (tres barras dentro de un círculo, los tres pasos del régimen).

**La regla del borde duro.** Radio 0. Un radio nuevo en una superficie rectangular es una salida del mundo.

## Components

### Buttons
- **Shape:** rectángulo puro (radio 0), `inline-flex` con 0.625rem de separación entre texto e ícono, padding 0.875rem / 1.75rem.
- **Tipografía:** label en caps, 0.8rem, peso 600, tracking 0.12em.
- **Verde (primario):** fondo verde, texto tinta; hover a verde luz. Es la acción de reservar.
- **Tinta:** fondo tinta, texto papel; hover a tinta suave. Se usa cuando el botón vive dentro del campo verde del hero.
- **Borde (secundario):** `border-current` de 1px, texto tinta, fondo transparente; hover invierte a fondo tinta y texto papel. Es "volver" o "cambiar".
- **Transición:** solo `background-color, color, border-color` a 200ms con `--ease-salida`. Los botones no se mueven ni se escalan.
- **Disabled:** `opacity: 0.45` y cursor bloqueado, sin cambio de color.
- **Foco:** heredado del global — `outline: 2px solid verde-hondo` con offset 3px.

### Inputs / Fields
- **Style:** fondo papel, borde de 1px `tinta/20`, radio 0, padding 0.75rem / 1rem, texto 0.98rem, ancho completo. Etiqueta arriba en label angosta caps con tracking 0.18em y color tinta suave.
- **Focus:** el borde pasa a verde hondo y el outline por defecto se suprime en favor de ese cambio de borde; el caret es verde hondo en todo input y textarea.
- **Placeholder:** tinta tenue.
- **Nota de ayuda:** angosta 0.78rem en tinta tenue, enlazada por `aria-describedby`.

### Chips (opción de pago)
- **Style:** `label` clicable con borde de 1px y padding 1.25rem / 1rem; el radio real está oculto (`sr-only`).
- **Estado:** no elegido con borde `tinta/20` (hover `tinta/45`); elegido con borde verde hondo y fondo `verde-humo/55`. El estado vive en borde **y** fondo a la vez.

### Cards / Containers
- **Tarjeta de tratamiento:** sin caja. Foto en relación 4/5 recortada, título, línea de duración · precio en verde hondo, descripción y un "Reservar" con flecha que se desplaza 1 en hover. No hay borde ni fondo: el agrupamiento lo hace el espacio.
- **Panel de resumen del turno:** fondo tinta, texto papel, padding 2rem / 1.75rem, etiquetas en caps `papel/65` y valores en `.cifra`; la seña se destaca en `.cifra .ancha` 1.3rem, peso 700, en verde.
- **Aviso:** bloque de fondo verde humo, padding 1.25rem / 1.5rem, `role="status"`.

### Navigation
- **Encabezado:** marca a la izquierda, un único enlace "Reservar turno" a la derecha en caps 0.72rem con tracking 0.18em y subrayado verde de 2px; hover tiñe el texto de verde. Sobre el hero el encabezado es transparente y absoluto con texto papel; en el resto de las rutas es una barra tinta.
- **Marca:** sello dibujado de 1.75rem más "NATURA" en ancha caps tracking 0.2em sobre "Estética integral" en angosta 0.58rem con tracking 0.22em (0.34em desde 640px) y 70% de opacidad.
- **Pie:** fondo tinta, tres columnas, encabezados de columna en label verde 0.62rem tracking 0.3em, horarios en `.cifra`.

### Riel de pasos (flujo de reserva)
Lista horizontal sobre una hairline `tinta/15`. Cada paso es un botón con su ordinal tabular y su nombre; el paso en curso lleva `aria-current="step"`, texto tinta y ordinal extrabold en verde hondo; el recorrido es clicable en tinta tenue con hover a tinta; el no alcanzado va deshabilitado. El estado se codifica por **peso del numeral**, no por peso y opacidad encimados a la vez.

### Grilla de horarios (componente de firma)
La interacción de firma del producto. Tres estados, distinguidos por estructura antes que por color:
- **Libre:** borde `tinta/20`, texto tinta, fondo transparente; hover lleva el borde a tinta y el fondo a verde humo.
- **Elegido:** relleno y borde verde luz, texto tinta en peso 700. Es el bloque más luminoso de la pantalla.
- **Sin cupo:** deshabilitado, borde `tinta/12`, fondo `tinta/[0.04]`, más **un tachado diagonal de 1px** dibujado con un `linear-gradient` a 45° al 45% de opacidad, y un `" — sin cupo"` en `sr-only`. El tachado sobrevive a cualquier daltonismo y a una captura en blanco y negro.

El calendario que la acompaña usa celdas cuadradas de 2.75rem en `.cifra`: día elegido en fondo tinta con texto papel y peso 700, día disponible con hover verde humo, día fuera de rango en `tinta/20` y deshabilitado. La cuenta de disponibilidad se enuncia en texto ("N de M horarios libres") dentro de un `aria-live="polite"`, y la carga **se cuenta, no gira**: "Consultando la agenda…", sin spinner.

**La regla del estado como estructura.** Libre / sin cupo / elegido se distinguen por relleno, forma y texto para lector de pantalla, nunca solo por tinte. Un estado nuevo que solo cambie de color no está terminado.

## Do's and Don'ts

### Do:
- **Do** poner texto tinta sobre cualquier superficie verde, a opacidad plena o hasta 70% de alfa.
- **Do** usar `{colors.verde-hondo}` cuando el verde tenga que ser texto o borde sobre papel.
- **Do** comprometer el verde a escala de campo entero, de borde duro y sin degradé.
- **Do** aplicar `.cifra` a todo precio, seña, hora, fecha, duración, día del mes y ordinal.
- **Do** elegir entre `.ancha` y `.angosta` en cada bloque de texto: declara o informa, no hay tercer registro.
- **Do** colgar las secciones nuevas de la espina con `pl-7 / lg:pl-10`, y mantenerla en todos los anchos salvo cuando cruzaría un titular a sangre.
- **Do** codificar todo estado con al menos dos señales: relleno más forma, o borde más fondo, o peso más color.
- **Do** dibujar los íconos nuevos en el set existente: viewBox 24, trazo `currentColor` 1.5, sin relleno, cap y join redondos.
- **Do** contar la carga en palabras dentro de un `aria-live` en vez de girar un spinner.
- **Do** respetar `prefers-reduced-motion`: la reducción global ya anula transiciones y animaciones.

### Don't:
- **Don't** poner blanco, papel ni ningún claro sobre `{colors.verde}` o `{colors.verde-vivo}`.
- **Don't** usar el verde como acento salpicado: puntitos, viñetas, iconitos sueltos, o una línea decorativa suelta.
- **Don't** agregar radio a una superficie rectangular ni sombra a ningún elemento: el sistema es plano y de borde duro.
- **Don't** introducir una segunda familia tipográfica ni una serif de contraste; el eje `wdth` de Archivo cubre el contraste.
- **Don't** usar la micro-etiqueta en caps (0.58–0.72rem, tracking ≥0.18em) como copete decorativo encima de un titular: en este build sólo rotula un dato real —el próximo turno libre, el nombre de una columna del pie, el rótulo de un `dt`— y ese es su único permiso.
- **Don't** distinguir un estado únicamente por color ni encimar peso y opacidad para marcar "no disponible": deja el elemento casi invisible.
- **Don't** usar caja alta en párrafos de lectura ni superar las ~62ch de medida.
- **Don't** bajar el texto de lectura sobre papel por debajo de `{colors.tinta-tenue}`, ni el texto sobre tinta por debajo de `papel/55`.
- **Don't** ablandar el primer viewport: nada de foto difuminada, degradé sobre el campo de color, hero centrado ni promesa de "tu momento de relax".
