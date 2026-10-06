/**
 * Los estilos de formulario, en un solo lugar. El flujo de reserva y las pantallas de cuenta
 * tienen que verse como el mismo campo: duplicar la clase es cómo dos formularios del mismo
 * sitio terminan con padding distinto.
 */
export const campo =
  'mt-2 w-full border border-tinta/20 bg-papel px-4 py-3 text-[0.98rem] text-tinta transition-colors placeholder:text-tinta-tenue focus:border-verde-hondo focus:outline-none';

export const etiqueta =
  'angosta block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-tinta-suave';

/** La nota de ayuda bajo un campo, enlazada por `aria-describedby`. */
export const nota = 'angosta mt-2 text-[0.78rem] leading-relaxed text-tinta-tenue';
