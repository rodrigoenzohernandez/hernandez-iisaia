// La API habla en hora de pared del centro: "09:00" del "2026-09-28" son las nueve de la mañana
// ahí, sin zona ni offset. Todo lo que sigue evita `new Date(iso)`, que interpretaría ese string
// en la zona del navegador y correría el turno un día.

const ZONA_CENTRO = 'America/Argentina/Buenos_Aires';

const precioARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatearPrecio(centavos: number): string {
  return precioARS.format(centavos / 100);
}

export function formatearDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function aUTC(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aISO(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${dosDigitos(fecha.getUTCMonth() + 1)}-${dosDigitos(fecha.getUTCDate())}`;
}

/** Hoy en el centro, no hoy en el navegador. `en-CA` formatea como YYYY-MM-DD. */
export function hoyEnCentro(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CENTRO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  const fecha = aUTC(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aISO(fecha);
}

/** 0 domingo .. 6 sábado, para ubicar la fecha en la grilla del calendario. */
export function diaDeLaSemana(iso: string): number {
  return aUTC(iso).getUTCDay();
}

export function diaDelMes(iso: string): number {
  return aUTC(iso).getUTCDate();
}

export function mismoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function primerDiaDelMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function sumarMeses(iso: string, meses: number): string {
  const [anio, mes] = iso.split('-').map(Number);
  const total = anio * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${dosDigitos((total % 12) + 1)}-01`;
}

export function formatearMes(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(aUTC(iso));
}

export function formatearFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(aUTC(iso));
}

export function formatearFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(aUTC(iso));
}
