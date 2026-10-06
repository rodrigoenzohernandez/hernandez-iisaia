import type { ComponentProps, ReactNode } from "react";

/** Flecha dibujada, un solo trazo, para la acción. */
export function Flecha({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * La acción primaria: el único bloque ámbar macizo. Tinta oscura sobre ámbar (el ámbar no
 * llega a contraste con texto claro). `:active` baja a scale(0.97) para que se sienta apretado,
 * como pide emil; la transición es solo de transform.
 */
export function Accion({
  children,
  grande = false,
  className = "",
  ...resto
}: { children: ReactNode; grande?: boolean } & ComponentProps<"a">) {
  return (
    <a
      className={`accion ancha group inline-flex items-center gap-3 bg-senal uppercase tracking-[0.04em] text-tablero transition-[transform,background-color] duration-150 ease-[var(--ease-salida)] hover:bg-senal-viva active:scale-[0.97] ${
        grande ? "px-9 py-5 text-[1.12rem] font-bold" : "px-7 py-4 text-[0.92rem] font-bold"
      } ${className}`}
      {...resto}
    >
      {children}
      <Flecha className="h-[1.1em] w-[1.1em] transition-transform duration-200 ease-[var(--ease-salida)] group-hover:translate-x-1" />
    </a>
  );
}

/** El punto ámbar "en vivo" del masthead: late suave, se apaga con reduced-motion. */
export function PuntoVivo() {
  return <span className="punto-vivo" aria-hidden="true" />;
}
