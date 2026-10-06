/**
 * Contenido real del centro, del seed del backend. Los nombres se muestran acentuados (en la
 * base vienen sin tilde por una limitación de carga); la duración, el precio y la seña son los
 * valores reales. Los precios están marcados como placeholder en el plan del backend.
 *
 * La landing es estática: no consume la API en vivo. Si el catálogo cambia, se actualiza acá.
 */
export type Tratamiento = {
  nombre: string;
  duracionMin: number;
  precioCentavos: number;
  senaCentavos: number;
  valoracion: boolean;
};

export const TRATAMIENTOS: Tratamiento[] = [
  { nombre: "Botas de compresión", duracionMin: 30, precioCentavos: 1500000, senaCentavos: 450000, valoracion: false },
  { nombre: "Depilación", duracionMin: 30, precioCentavos: 1800000, senaCentavos: 540000, valoracion: true },
  { nombre: "Electroestimulación", duracionMin: 30, precioCentavos: 2000000, senaCentavos: 600000, valoracion: true },
  { nombre: "Mio Up", duracionMin: 30, precioCentavos: 2200000, senaCentavos: 660000, valoracion: true },
  { nombre: "Presoterapia", duracionMin: 45, precioCentavos: 2000000, senaCentavos: 600000, valoracion: true },
  { nombre: "Venus", duracionMin: 45, precioCentavos: 3500000, senaCentavos: 1050000, valoracion: true },
  { nombre: "Dermo Health", duracionMin: 60, precioCentavos: 4000000, senaCentavos: 1200000, valoracion: true },
  { nombre: "HIFU", duracionMin: 60, precioCentavos: 6000000, senaCentavos: 1800000, valoracion: true },
];

export type Franja = { dia: string; horas: string | null };

export const HORARIOS: Franja[] = [
  { dia: "Lunes", horas: "09:00 – 13:30 · 15:00 – 19:30" },
  { dia: "Martes", horas: "09:00 – 13:30 · 15:00 – 19:30" },
  { dia: "Miércoles", horas: "09:00 – 13:30 · 15:00 – 19:30" },
  { dia: "Jueves", horas: "09:00 – 13:30 · 15:00 – 19:30" },
  { dia: "Viernes", horas: "09:00 – 13:30 · 15:00 – 19:30" },
  { dia: "Sábado", horas: "09:00 – 13:30" },
  { dia: "Domingo", horas: null },
];

/** A dónde manda la acción primaria: la app de reserva (el otro frontend). */
export const URL_RESERVAR = "http://localhost:3101/reservar";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function precio(centavos: number): string {
  return pesos.format(centavos / 100);
}

export function duracion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h} h` : `${h} h ${r}′`;
}
