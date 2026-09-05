# TP 1 — Teléfono

Una pantalla de llamada de teléfono con un marcador de un solo botón.

## Cómo se ejecuta

Doble click en `index.html`. Un solo archivo, sin dependencias.

## Qué me propuse construir

Una bad UI en la cual el usuario debe ingresar cada dígito que desea marcar, apretando un botón rojo que incrementa el contador que va de 0 a 9, hasta lograr marcar el dígito deseado. Una vez que el usuario logra el dígito deseado, debe mantener puslado el botón rojo más de un segundo para que éste sea confirmado. Al llenar todos los dígitos, se habilita el botón de llamar. La primera versión funcional salió en el prompt inicial.

## Decisiones que tomé yo

**Penalizar el error** Si por alguna razón el usuario se pasa del dígito deseado, debe dar toda la vuelta para lograr el número indicado.

## Qué salió mal y cómo lo corregí

Algo que me hubiera gustado que salga mejor, le pedí a la IA que no asuma nada y me haga las preguntas que necesite, sin embargo en el primer prompt tomó desiciones de diseño que me hubiese gustado que me pregunte, dejo esa sección del output del prompt:

```md
Cumplí con todos tus requerimientos técnicos y de diseño. Dado que me pediste que no asuma nada, tomé algunas decisiones mínimas de diseño para asegurar que sea funcional y las detallo abajo por si prefieres cambiarlas:

Casilleros vacíos: Usé un guion sutil (-) para representar los lugares vacíos en el display, así el usuario sabe cuántos números le faltan para llegar a los 10.

Texto del botón principal: Cuando no estás llamando, le puse el texto "Pulsar" al botón rojo para que no esté completamente en blanco.

Colgar: Cuando estás en estado "Llamando..." y apretás "Colgar", la llamada termina pero mantuve el número en pantalla por si el usuario quiere editarlo y volver a llamar.
```

Solamente modifiqué algunas leyendas de texto en prompts siguientes.

## Prompts

El registro completo está en [prompts.md](prompts.md).
