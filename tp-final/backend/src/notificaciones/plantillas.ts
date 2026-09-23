import { aDate } from '../common/horario.js';

/** Un mail listo para encolar. */
export type Plantilla = { asunto: string; html: string; texto: string };

/** Lo que casi todos los mails de un turno necesitan saber. */
export type DatosTurno = {
  centro: string;
  clienteNombre: string;
  servicio: string;
  fecha: string;
  hora: string;
};

const escapar = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const FECHA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

/** "2026-10-05" -> "lunes, 5 de octubre". UTC porque la fecha ya es de pared. */
export const fechaLarga = (fecha: string): string => FECHA.format(aDate(fecha));
export const pesos = (centavos: number): string => PESOS.format(centavos / 100);

/**
 * Arma el mail a partir de parrafos de TEXTO PLANO. Todo lo que entra se escapa aca, en un
 * solo lugar: el nombre y las notas los escribe la clienta, y un mail que depende de que
 * cada plantilla se acuerde de escapar es un mail con HTML inyectado esperando a pasar.
 */
function armar(centro: string, asunto: string, parrafos: string[]): Plantilla {
  const cuerpo = parrafos
    .map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapar(p)}</p>`)
    .join('');
  return {
    asunto,
    texto: [...parrafos, centro].join('\n\n'),
    html:
      '<!doctype html><html lang="es"><head><meta charset="utf-8"></head>' +
      '<body style="font-family:system-ui,sans-serif;color:#222;max-width:560px;margin:0 auto;padding:24px">' +
      `<p style="margin:0 0 16px;color:#666">${escapar(centro)}</p>${cuerpo}</body></html>`,
  };
}

const cuando = (d: DatosTurno) =>
  `${d.servicio}, el ${fechaLarga(d.fecha)} a las ${d.hora}.`;

export const turnoConfirmado = (
  d: DatosTurno & { pagadoCentavos?: number },
): Plantilla =>
  armar(d.centro, `Tu turno en ${d.centro} está confirmado`, [
    `Hola ${d.clienteNombre}:`,
    `Tu turno está confirmado: ${cuando(d)}`,
    ...(d.pagadoCentavos
      ? [`Registramos tu pago de ${pesos(d.pagadoCentavos)}.`]
      : []),
    'Si necesitás cambiarlo o cancelarlo, entrá a "Mis turnos" con este mismo email.',
  ]);

export const turnoCancelado = (
  d: DatosTurno & { pagadoCentavos?: number; reembolsoCentavos?: number },
): Plantilla => {
  const plata =
    d.reembolsoCentavos && d.reembolsoCentavos > 0
      ? [
          `Te devolvemos ${pesos(d.reembolsoCentavos)} al mismo medio con el que pagaste.`,
        ]
      : d.pagadoCentavos
        ? [
            'Según la política de cancelación del centro, lo pagado no se reembolsa.',
          ]
        : [];
  return armar(d.centro, `Se canceló tu turno en ${d.centro}`, [
    `Hola ${d.clienteNombre}:`,
    `Se canceló tu turno: ${cuando(d)}`,
    ...plata,
  ]);
};

export const recordatorio = (d: DatosTurno): Plantilla =>
  armar(d.centro, `Recordatorio de tu turno en ${d.centro}`, [
    `Hola ${d.clienteNombre}:`,
    `Te recordamos tu turno: ${cuando(d)}`,
    'Si no vas a poder venir, avisá desde "Mis turnos".',
  ]);

/** Al centro, cada vez que entra un turno. */
export const avisoTurnoNuevo = (
  d: DatosTurno & {
    clienteEmail: string;
    clienteTelefono: string;
    notas?: string | null;
  },
): Plantilla =>
  armar(
    d.centro,
    `Turno nuevo: ${d.servicio}, ${fechaLarga(d.fecha)} ${d.hora}`,
    [
      `Entró un turno: ${cuando(d)}`,
      `${d.clienteNombre}, ${d.clienteTelefono}, ${d.clienteEmail}.`,
      ...(d.notas ? [`Notas: ${d.notas}`] : []),
    ],
  );
