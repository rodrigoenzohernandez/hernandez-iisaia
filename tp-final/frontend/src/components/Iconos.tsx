type Props = { className?: string };

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function Flecha({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" {...trazo} />
    </svg>
  );
}

export function FlechaIzquierda({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M20 12H5M11 6l-6 6 6 6" {...trazo} />
    </svg>
  );
}

export function Tilde({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M4 12.5l5.5 5.5L20 6.5" {...trazo} />
    </svg>
  );
}

export function Reloj({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="8.25" {...trazo} />
      <path d="M12 7.5V12l3 2" {...trazo} />
    </svg>
  );
}

/** El sello: tres barras dentro de un círculo, los tres pasos del régimen. */
export function Sello({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9.25" {...trazo} />
      <path d="M7.5 9h9M7.5 12h6M7.5 15h3" {...trazo} />
    </svg>
  );
}
