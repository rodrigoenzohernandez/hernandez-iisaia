import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import { Pie } from '@/components/Pie';
import { Espina } from '@/components/Espina';
import { EstadoPago } from '@/components/reserva/EstadoPago';
import { SLUG } from '@/lib/cliente';

export const metadata: Metadata = {
  title: 'Tu pago — Natura Estética Integral',
  robots: { index: false },
};

/**
 * La vuelta de Mercado Pago. La URL la arma el backend como
 * `{FRONTEND_URL}/{slug}/reservas/{id}/pago`, por eso la ruta lleva el slug aunque este
 * frontend sirva a un solo centro.
 *
 * Los parámetros que Mercado Pago agrega a la query no se usan para nada: los escribe
 * cualquiera. El estado real lo contesta el backend, y de eso se ocupa <EstadoPago>.
 */
export default async function Pago(props: PageProps<'/[slug]/reservas/[reservaId]/pago'>) {
  const { slug, reservaId } = await props.params;

  return (
    <>
      <Encabezado />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          {slug === SLUG ? (
            <EstadoPago reservaId={reservaId} />
          ) : (
            <section className="max-w-[54ch]">
              <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
                Este turno es de otro centro
              </h1>
              <p className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
                El link que abriste corresponde a <span className="font-semibold">{slug}</span>, y
                esta página atiende a otro centro. Buscá el link en el mail que te llegó.
              </p>
              <p className="mt-10">
                <Link
                  href="/"
                  className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-tinta underline decoration-verde decoration-2 underline-offset-[0.35em]"
                >
                  Volver al inicio
                </Link>
              </p>
            </section>
          )}
        </div>
      </main>

      <Pie />
    </>
  );
}
