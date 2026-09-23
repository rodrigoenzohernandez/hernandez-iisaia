/**
 * Aritmetica de fecha y hora de pared. Funciones puras: sin Nest, sin Prisma y sin base.
 *
 * El dominio es hora de pared del centro. "El martes a las 15:00" no cambia porque cambie
 * una zona horaria, asi que la fecha es un @db.Date y la hora un "HH:mm". Eso borra toda la
 * aritmetica de offsets, y el unico lugar donde hace falta una zona es para saber que hora
 * es AHORA en el centro, para rechazar turnos pasados.
 */

/** No se aceptan turnos con menos de esta anticipacion. */
export const ANTICIPACION_MINUTOS = 120;

/** Tope de agenda a futuro: mas alla de esto no se reserva. */
export const DIAS_MAX_A_FUTURO = 90;

/** "2026-10-05" -> Date de medianoche UTC, que es como Prisma guarda un @db.Date. */
export const aDate = (fecha: string): Date =>
  new Date(`${fecha}T00:00:00.000Z`);

/** Date de un @db.Date -> "2026-10-05". */
export const aFecha = (valor: Date): string => valor.toISOString().slice(0, 10);

/** El mes de una fecha, como rango de @db.Date: del dia 1 al dia 1 siguiente, sin incluirlo. */
export const mesDe = (fecha: string): { gte: Date; lt: Date } => {
  const [anio, mes] = fecha.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(anio, mes - 1, 1)),
    lt: new Date(Date.UTC(anio, mes, 1)),
  };
};

/**
 * true si la fecha existe de verdad en el calendario.
 *
 * El regex de los DTO acepta 2026-02-30 y 2026-10-00, que a Date le dan un rollover
 * silencioso o un Invalid Date. Sin este chequeo esos valores llegan al where de Prisma y
 * salen como un 500 en un endpoint publico en vez de un 400.
 */
export const esFechaReal = (fecha: string): boolean => {
  const d = aDate(fecha);
  return !Number.isNaN(d.getTime()) && aFecha(d) === fecha;
};

/** 1 lunes .. 7 domingo (ISO-8601). No depende de ninguna zona horaria. */
export const diaSemanaISO = (fecha: string): number =>
  aDate(fecha).getUTCDay() || 7;

export const aMinutos = (hora: string): number =>
  Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

export const aHora = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

/** "2026-10-05" + 90 -> "2027-01-03". */
export const sumarDias = (fecha: string, dias: number): string =>
  aFecha(new Date(aDate(fecha).getTime() + dias * 86_400_000));

/**
 * Fecha y hora de pared ahora mismo en la zona del centro. Es el UNICO uso de zonaHoraria
 * en todo el backend.
 *
 * hourCycle h23 y no hour12:false: con hour12 algunas versiones de ICU devuelven "24" a la
 * medianoche, y "24:00" rompe la comparacion lexicografica.
 */
export const ahoraEn = (
  zonaHoraria: string,
): { fecha: string; hora: string } => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const p = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((x) => x.type === tipo)?.value ?? '00';
  return {
    fecha: `${p('year')}-${p('month')}-${p('day')}`,
    hora: `${p('hour')}:${p('minute')}`,
  };
};

export type Ventana = {
  horaInicio: string;
  horaFin: string;
  intervaloMinutos: number;
  capacidad: number;
};

/**
 * Los unicos horarios de inicio que existen para un servicio dentro de una ventana.
 *
 * horaFin es el minuto mas tardio en el que el turno puede TERMINAR: por eso un servicio de
 * 60 minutos tiene menos inicios que uno de 30 en la misma ventana. Con las franjas del
 * prototipo (09:00-13:30 y 15:00-19:30, intervalo 45) uno de 30 o 45 da los 12 horarios que
 * muestra el prototipo, y uno de 60 pierde 12:45 y 18:45.
 *
 * Es la UNICA definicion de "que inicios existen": ventanaDe() la reusa, asi que el alta y
 * la consulta de disponibilidad no pueden contradecirse.
 */
export const iniciosDeGrilla = (
  ventana: Ventana,
  duracionMinutos: number,
): string[] => {
  // Guarda de loop infinito. El DTO ya valida el minimo, pero esto es lo unico del sistema
  // donde un valor invalido no da error sino un proceso colgado, y desde un GET publico.
  if (ventana.intervaloMinutos <= 0 || duracionMinutos <= 0) return [];
  const fin = aMinutos(ventana.horaFin);
  const inicios: string[] = [];
  for (
    let m = aMinutos(ventana.horaInicio);
    m + duracionMinutos <= fin;
    m += ventana.intervaloMinutos
  ) {
    inicios.push(aHora(m));
  }
  return inicios;
};

/**
 * La ventana cuya grilla contiene exactamente esa hora de inicio, o null si esta fuera de
 * agenda. Reusar iniciosDeGrilla en vez de reimplementar "entra y esta alineado" rechaza
 * gratis un 12:10.
 */
export const ventanaDe = <T extends Ventana>(
  ventanas: T[],
  horaInicio: string,
  duracionMinutos: number,
): T | null =>
  ventanas.find((v) =>
    iniciosDeGrilla(v, duracionMinutos).includes(horaInicio),
  ) ?? null;

/**
 * Minutos que faltan desde `ahora` hasta ese instante de pared; negativo si ya paso.
 *
 * Cuenta minutos absolutos y no rama por dia: ramificar dejaba la anticipacion aplicandose
 * solo dentro del dia de hoy, asi que a las 23:40 un turno de maniana a las 00:30 pasaba
 * aunque faltaran 50 minutos.
 */
export const minutosHasta = (
  fecha: string,
  hora: string,
  ahora: { fecha: string; hora: string },
): number => {
  const dias = Math.round(
    (aDate(fecha).getTime() - aDate(ahora.fecha).getTime()) / 86_400_000,
  );
  return dias * 24 * 60 + aMinutos(hora) - aMinutos(ahora.hora);
};

/** true si ese instante de pared ya paso o esta demasiado cerca para reservarlo. */
export const demasiadoTarde = (
  fecha: string,
  hora: string,
  ahora: { fecha: string; hora: string },
): boolean => minutosHasta(fecha, hora, ahora) < ANTICIPACION_MINUTOS;

/**
 * Ocupacion simultanea maxima en el rango [inicio, fin) si se suma un turno mas.
 *
 * No alcanza con contar las reservas que se pisan con el turno nuevo: dos que lo pisan en
 * momentos distintos suman 2 aunque nunca haya 2 a la vez. Se barren los bordes —cada
 * arranque de una reserva viva y el del turno nuevo— y se toma el maximo de reservas que
 * cubren cada borde. Es la unica definicion de "cuantos hay a la vez", y la usan tanto el
 * alta como la consulta de disponibilidad para que no puedan contradecirse.
 */
export const ocupacionMaxima = (
  ocupados: { horaInicio: string; horaFin: string }[],
  inicio: string,
  fin: string,
): number => {
  const pisan = ocupados.filter(
    (o) => o.horaInicio < fin && o.horaFin > inicio,
  );
  const bordes = [inicio, ...pisan.map((o) => o.horaInicio)];
  return Math.max(
    ...bordes.map(
      (b) =>
        (b >= inicio && b < fin ? 1 : 0) +
        pisan.filter((o) => o.horaInicio <= b && o.horaFin > b).length,
    ),
  );
};
