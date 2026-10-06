import type { Metadata } from 'next';
import { Encabezado } from '@/components/Encabezado';
import { Espina } from '@/components/Espina';
import { Pie } from '@/components/Pie';
import { MisTurnos } from '@/components/cuenta/MisTurnos';

export const metadata: Metadata = {
  title: 'Mis turnos — Natura Estética Integral',
  robots: { index: false },
};

export default async function Turnos(props: PageProps<'/[slug]/mis-turnos'>) {
  const { slug } = await props.params;
  return (
    <>
      <Encabezado slug={slug} />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <MisTurnos />
        </div>
      </main>

      <Pie slug={slug} />
    </>
  );
}
