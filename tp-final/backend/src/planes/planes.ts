import type { Plan } from '@prisma/client';

export type Limites = {
  nombre: string;
  /** Por mes, en centavos. */
  precioCentavos: number;
  /** Turnos que el centro toma por mes, contados por la fecha del turno. null: sin tope. */
  turnosPorMes: number | null;
  /** Turnos simultaneos por franja, aunque la franja diga mas. */
  capacidadMaxima: number;
  /** Recordatorio por mail 24 horas antes. */
  recordatorios: boolean;
  /** Cobro online de senas y turnos con Mercado Pago, con reembolsos. */
  cobroOnline: boolean;
};

/**
 * Los planes. Una constante y no una tabla: cambiar un precio es un deploy, y hoy nadie los
 * edita. Los precios son placeholder.
 */
export const PLANES: Record<Plan, Limites> = {
  basico: {
    nombre: 'Básico',
    precioCentavos: 0,
    turnosPorMes: 60,
    capacidadMaxima: 1,
    recordatorios: false,
    cobroOnline: false,
  },
  profesional: {
    nombre: 'Profesional',
    precioCentavos: 1_990_000,
    turnosPorMes: null,
    capacidadMaxima: 20,
    recordatorios: true,
    cobroOnline: true,
  },
};

/**
 * Cuanto sigue vigente un plan pago despues de vencer lo pagado. Cubre la ventana en la que
 * Mercado Pago reintenta un cobro fallido: hasta 4 veces en 10 dias.
 */
const GRACIA_MS = 10 * 86_400_000;

/** Lo que hace falta leer del centro para calcular su plan. */
export const camposDelPlan = {
  suscripcionPlan: true,
  suscripcionEstado: true,
  planPagoHasta: true,
} as const;

/**
 * El plan que rige ahora. Se calcula y no se guarda: sin tarea de vencimiento, y un plan no
 * puede quedar activo porque un aviso de Mercado Pago no llego.
 */
export function planVigente(
  t: {
    suscripcionPlan: Plan | null;
    suscripcionEstado: string | null;
    planPagoHasta: Date | null;
  },
  ahora = new Date(),
): Plan {
  if (!t.suscripcionPlan || !t.planPagoHasta) return 'basico';
  // La gracia es para los reintentos de un cobro fallido: una suscripcion cancelada no tiene.
  const gracia = t.suscripcionEstado === 'cancelled' ? 0 : GRACIA_MS;
  return ahora.getTime() < t.planPagoHasta.getTime() + gracia
    ? t.suscripcionPlan
    : 'basico';
}
