import { nombreDeSlug } from '@/lib/centro';
import { Sello } from './Iconos';

/**
 * La marca del centro. El nombre se deriva del slug (no hay endpoint público que lo devuelva);
 * es un fallback hasta que el backend exponga el nombre real.
 */
export function Marca({ slug, className = '' }: { slug: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Sello className="h-7 w-7 shrink-0" />
      <span className="ancha text-[0.95rem] font-bold uppercase leading-none tracking-[0.2em]">
        {nombreDeSlug(slug)}
      </span>
    </span>
  );
}
