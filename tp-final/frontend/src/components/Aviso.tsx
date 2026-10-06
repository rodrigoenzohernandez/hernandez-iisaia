import type { ReactNode } from 'react';

/**
 * El bloque de aviso del sistema, de borde duro. El estado se codifica por campo, como todo
 * el mundo: el dato de apoyo va en campo verde humo; el error invierte a campo tinta macizo
 * con texto papel, así se distingue por estructura y no por una franja de color.
 *
 * El tono decide además el rol de accesibilidad: un `alert` interrumpe al lector de pantalla
 * y un `status` espera a que termine la frase en curso.
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
      className={`px-6 py-5 text-[0.95rem] leading-relaxed ${
        esError ? 'bg-tinta text-papel' : 'bg-verde-humo text-tinta'
      } ${className}`}
    >
      {children}
    </p>
  );
}
