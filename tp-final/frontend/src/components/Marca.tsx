import { Sello } from './Iconos';

export function Marca({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Sello className="h-7 w-7 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="ancha text-[0.95rem] font-bold uppercase tracking-[0.2em]">Natura</span>
        <span className="angosta mt-1 text-[0.58rem] uppercase tracking-[0.22em] opacity-70 sm:tracking-[0.34em]">
          Estética integral
        </span>
      </span>
    </span>
  );
}
