import type { Metadata } from 'next';
import { Encabezado } from '@/components/Encabezado';
import { Espina } from '@/components/Espina';
import { Pie } from '@/components/Pie';
import { Flujo } from '@/components/reserva/Flujo';
import { listarServicios, type Servicio } from '@/lib/cliente';

export const metadata: Metadata = {
  title: 'Reservar turno — Natura Estética Integral',
  description:
    'Elegí el tratamiento, mirá los horarios libres de la agenda real y reservá tu turno en tres pasos.',
};

export default async function Reservar(props: PageProps<'/reservar'>) {
  const { servicio: buscado } = await props.searchParams;
  const servicios = await listarServicios().catch(() => [] as Servicio[]);

  const id = Array.isArray(buscado) ? buscado[0] : buscado;
  const inicial = servicios.find((s) => s.id === id) ?? null;

  return (
    <>
      <Encabezado />

      <main className="relative bg-papel px-6 py-16 lg:px-12 lg:py-24">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <h1 className="ancha max-w-[16ch] text-[clamp(1.9rem,4vw,3.2rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-balance">
            Reservá tu turno
          </h1>

          {servicios.length === 0 ? (
            <p className="angosta mt-10 max-w-[54ch] text-[1.02rem] leading-relaxed text-tinta-suave">
              No pudimos traer los tratamientos del centro. Puede ser algo momentáneo: actualizá
              la página en unos segundos y probá de nuevo.
            </p>
          ) : (
            <div className="mt-14">
              <Flujo servicios={servicios} inicial={inicial} />
            </div>
          )}
        </div>
      </main>

      <Pie />
    </>
  );
}
