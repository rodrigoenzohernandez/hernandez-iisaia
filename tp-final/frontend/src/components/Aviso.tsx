import type { ReactNode } from 'react';

/**
 * El bloque de aviso del sistema: campo verde humo, borde duro.
 *
 * El tono decide el rol de accesibilidad, que es lo que cambia de verdad: un `alert`
 * interrumpe al lector de pantalla y un `status` espera a que termine la frase en curso. Un
 * error que no interrumpe se lee tarde; un dato de apoyo que interrumpe, molesta.
 */
export function Aviso({
  tono = 'info',
  children,
  className = '',
}: {
  tono?: 'info' | 'error';
  children: ReactNode;
  className?: string;
}) {
  const esError = tono === 'error';
  return (
    <p
      role={esError ? 'alert' : 'status'}
      // El error se marca con la barra de tinta además del texto: el color por sí solo no
      // alcanza, y acá los dos tonos comparten fondo.
      className={`bg-verde-humo px-6 py-5 text-[0.95rem] leading-relaxed text-tinta ${
        esError ? 'border-l-2 border-tinta' : ''
      } ${className}`}
    >
      {children}
    </p>
  );
}
