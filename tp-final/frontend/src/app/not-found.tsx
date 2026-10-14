import { BotonEnlace } from '@/components/Boton';
import { Espina } from '@/components/Espina';
import { Flecha } from '@/components/Iconos';
import { EncabezadoPlataforma } from '@/components/plataforma/EncabezadoPlataforma';

/**
 * La 404 de todo el sitio, también la del centro que no existe: el `notFound()` del layout de
 * `[slug]` lo atrapa este archivo, porque un layout no lo atrapa en su propio segmento. Lleva
 * el encabezado de la plataforma porque no hay un centro del que mostrar la marca.
 */
export default function NoEncontrada() {
  return (
    <>
      <EncabezadoPlataforma conRegistro={false} />

      <main className="relative min-h-[60svh] bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <h1 className="ancha max-w-[18ch] text-[clamp(1.6rem,2.9vw,2.5rem)] font-bold uppercase leading-[1.02] tracking-[-0.025em] text-balance">
            No encontramos esta página
          </h1>
          <p className="angosta mt-6 max-w-[52ch] text-[1.02rem] leading-relaxed text-tinta-suave">
            Si buscabas un centro, revisá la dirección: puede estar mal escrita, o el centro ya
            no toma turnos por acá.
          </p>
          <div className="mt-10">
            <BotonEnlace href="/" tono="tinta">
              Ir al inicio
              <Flecha className="h-4 w-4" />
            </BotonEnlace>
          </div>
        </div>
      </main>
    </>
  );
}
