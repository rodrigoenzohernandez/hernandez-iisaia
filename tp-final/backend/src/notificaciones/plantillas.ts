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

/** El codigo de ingreso de una clienta. */
export const codigoAcceso = (d: {
  centro: string;
  codigo: string;
  minutos: number;
}): Plantilla =>
  armar(d.centro, `Tu código para entrar a ${d.centro}: ${d.codigo}`, [
    `Tu código es ${d.codigo}. Vence en ${d.minutos} minutos y sirve una sola vez.`,
    'Si no lo pediste, ignorá este mail: sin el código nadie puede entrar a tu cuenta.',
  ]);

export const turnoReprogramado = (
  d: DatosTurno & { fechaAnterior: string; horaAnterior: string },
): Plantilla =>
  armar(d.centro, `Tu turno en ${d.centro} cambió de horario`, [
    `Hola ${d.clienteNombre}:`,
    `Tu turno de ${d.servicio} pasó del ${fechaLarga(d.fechaAnterior)} a las ${d.horaAnterior} al ${fechaLarga(d.fecha)} a las ${d.hora}.`,
  ]);

/** A la clienta, cuando su reserva vence sin que se complete el pago. */
export const turnoVencido = (d: DatosTurno): Plantilla =>
  armar(d.centro, `Tu reserva en ${d.centro} venció`, [
    `Hola ${d.clienteNombre}:`,
    `No se completó el pago de tu reserva: ${cuando(d)}`,
    'Liberamos el horario. Si todavía lo querés, podés reservarlo de nuevo.',
  ]);

/** A la clienta, cuando un pago llega y no hay turno al que asignarlo. */
export const pagoDevuelto = (
  d: DatosTurno & { montoCentavos: number },
): Plantilla =>
  armar(d.centro, `Te devolvemos un pago de ${d.centro}`, [
    `Hola ${d.clienteNombre}:`,
    `Recibimos un pago de ${pesos(d.montoCentavos)} para ${cuando(d)}`,
    'La reserva ya no estaba vigente o ya estaba paga, así que te lo devolvemos al mismo medio con el que pagaste.',
  ]);

/** Al centro, cuando una clienta cancela. */
export const avisoCancelacion = (
  d: DatosTurno & { reembolsoCentavos: number },
): Plantilla =>
  armar(
    d.centro,
    `Cancelación: ${d.servicio}, ${fechaLarga(d.fecha)} ${d.hora}`,
    [
      `${d.clienteNombre} canceló su turno: ${cuando(d)}`,
      d.reembolsoCentavos > 0
        ? `Se le reembolsan ${pesos(d.reembolsoCentavos)}.`
        : 'Canceló fuera de plazo o sin pago online: no hay reembolso.',
    ],
  );

/** Al centro, cuando un reembolso no se pudo hacer y hay que hacerlo a mano. */
export const reembolsoManual = (
  d: DatosTurno & { montoCentavos: number; motivo: string },
): Plantilla =>
  armar(d.centro, 'Un reembolso necesita que lo hagas a mano', [
    `No pudimos reembolsar ${pesos(d.montoCentavos)} a ${d.clienteNombre} por ${cuando(d)}`,
    `Mercado Pago respondió: ${d.motivo}`,
    'Hacelo desde tu cuenta de Mercado Pago, en la actividad de ese pago.',
  ]);

/** Al centro, cuando Mercado Pago revoca el acceso o rechaza la renovación. */
export const reconectarMercadoPago = (d: { centro: string }): Plantilla =>
  armar(d.centro, 'Volvé a conectar tu cuenta de Mercado Pago', [
    'Mercado Pago dejó de aceptar la conexión con tu cuenta, así que por ahora no se pueden cobrar señas ni turnos online.',
    'Entrá al panel y volvé a conectar Mercado Pago. Mientras tanto, los turnos en efectivo siguen entrando sin seña.',
  ]);
