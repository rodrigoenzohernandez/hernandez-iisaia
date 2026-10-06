import type { Metadata } from 'next';
import { Espina } from '@/components/Espina';
import { Pie } from '@/components/Pie';
import { EncabezadoAdmin } from '@/components/admin/EncabezadoAdmin';
import { Cobros } from '@/components/admin/Cobros';

export const metadata: Metadata = {
  title: 'Cobros — Natura Estética Integral',
  robots: { index: false },
};

export default async function AdminCobros(props: PageProps<'/[slug]/admin/cobros'>) {
  const { slug } = await props.params;
  return (
    <>
      <EncabezadoAdmin slug={slug} />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <Cobros />
        </div>
      </main>

      <Pie slug={slug} />
    </>
  );
}
