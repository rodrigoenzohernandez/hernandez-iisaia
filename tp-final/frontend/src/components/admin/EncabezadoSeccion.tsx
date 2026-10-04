import type { ReactNode } from 'react';

/**
 * El encabezado de cada pantalla del panel: eyebrow verde, título ancho y "Cerrar sesión" a
 * la derecha. Un `acciones` opcional cuelga a la derecha del título, para botones como
 * "Nuevo tratamiento".
 */
export function EncabezadoSeccion({
  titulo,
  onSalir,
  acciones,
}: {
  titulo: string;
  onSalir: () => void;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4">
      <div>
        <p className="angosta text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-verde-hondo">
          Panel del centro
        </p>
        <h1 className="ancha mt-3 text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          {titulo}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        {acciones}
        <button
          type="button"
          onClick={onSalir}
          className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] transition-colors hover:text-tinta"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
