import type { Metadata } from 'next';
import { Encabezado } from '@/components/Encabezado';
import { Pie } from '@/components/Pie';
import { Espina } from '@/components/Espina';
import { EstadoPago } from '@/components/reserva/EstadoPago';

export const metadata: Metadata = {
  title: 'Tu pago',
  robots: { index: false },
};

/**
 * La vuelta de Mercado Pago. La URL la arma el backend como
 * `{FRONTEND_URL}/{slug}/reservas/{id}/pago`: el slug del segmento es el centro.
 *
 * Los parámetros que Mercado Pago agrega a la query no se usan para nada: los escribe
 * cualquiera. El estado real lo contesta el backend, y de eso se ocupa <EstadoPago>.
 */
export default async function Pago(props: PageProps<'/[slug]/reservas/[reservaId]/pago'>) {
  const { slug, reservaId } = await props.params;

  return (
    <>
      <Encabezado slug={slug} />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <EstadoPago slug={slug} reservaId={reservaId} />
        </div>
      </main>

      <Pie slug={slug} />
    </>
  );
}
