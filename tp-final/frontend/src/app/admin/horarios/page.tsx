import type { Metadata } from 'next';
import { Espina } from '@/components/Espina';
import { Pie } from '@/components/Pie';
import { EncabezadoAdmin } from '@/components/admin/EncabezadoAdmin';
import { Horarios } from '@/components/admin/Horarios';

export const metadata: Metadata = {
  title: 'Horarios — Natura Estética Integral',
  robots: { index: false },
};

export default function AdminHorarios() {
  return (
    <>
      <EncabezadoAdmin />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <Horarios />
        </div>
      </main>

      <Pie />
    </>
  );
}
