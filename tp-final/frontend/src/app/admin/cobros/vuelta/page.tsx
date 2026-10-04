import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Espina } from '@/components/Espina';
import { Pie } from '@/components/Pie';
import { EncabezadoAdmin } from '@/components/admin/EncabezadoAdmin';
import { VueltaMp } from '@/components/admin/VueltaMp';

export const metadata: Metadata = {
  title: 'Conectando — Natura Estética Integral',
  robots: { index: false },
};

export default function AdminCobrosVuelta() {
  return (
    <>
      <EncabezadoAdmin />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          {/* useSearchParams exige un límite de Suspense: sin esto, el build falla. */}
          <Suspense fallback={null}>
            <VueltaMp />
          </Suspense>
        </div>
      </main>

      <Pie />
    </>
  );
}
