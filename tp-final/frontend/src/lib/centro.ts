// El backend no expone el nombre del centro: la tabla Tenant no tiene endpoint de lectura.
// Por eso la marca vive acá y el slug `lo-de-lili` viaja solo en las URLs de la API.
export const CENTRO = {
  nombre: 'Natura Estética Integral',
  nombreCorto: 'Natura',
} as const;

// Espeja las ventanas de atención que siembra el backend. Si allá se editan las franjas,
// esto hay que actualizarlo: el GET de ventanas-atencion es privado y el frontend público
// no puede leerlo.
export const HORARIOS = [
  { dias: 'Lunes a viernes', franjas: '9:00 – 13:30 · 15:00 – 19:30' },
  { dias: 'Sábados', franjas: '9:00 – 13:30' },
  { dias: 'Domingos', franjas: 'Cerrado' },
] as const;
