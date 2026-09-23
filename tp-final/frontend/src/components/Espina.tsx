/**
 * La espina del régimen: una línea de 1px que cose la página y de la que cuelgan las
 * secciones. Replica el canal del contenido (`px-6 lg:px-12` + `max-w-[1380px] mx-auto`)
 * para caer exactamente sobre su borde izquierdo, así que los contenedores que la usan
 * llevan `pl-7 lg:pl-10` para despegarse de ella.
 *
 * Va en un contenedor `relative` que abarque las secciones que tiene que atravesar.
 */
export function Espina({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-30 px-6 lg:px-12 ${className}`}
    >
      <div className="mx-auto h-full max-w-[1380px]">
        <div className="h-full w-px bg-verde/45" />
      </div>
    </div>
  );
}
