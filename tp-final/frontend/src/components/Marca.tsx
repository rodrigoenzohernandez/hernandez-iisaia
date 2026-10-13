import { Sello } from './Iconos';

/** La marca del centro, con el nombre que cargó al registrarse. */
export function Marca({ nombre, className = '' }: { nombre: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Sello className="h-7 w-7 shrink-0" />
      <span className="ancha text-[0.95rem] font-bold uppercase leading-none tracking-[0.2em]">
        {nombre}
      </span>
    </span>
  );
}
