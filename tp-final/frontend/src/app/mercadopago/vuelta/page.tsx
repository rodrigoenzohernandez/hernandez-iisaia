import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Espina } from '@/components/Espina';
import { Sello } from '@/components/Iconos';
import { VueltaMp } from '@/components/admin/VueltaMp';

export const metadata: Metadata = {
  title: 'Conectando Mercado Pago',
  robots: { index: false },
};

/**
 * La vuelta de OAuth de Mercado Pago. Es una URL fija para todos los centros (no lleva slug):
 * a qué centro volver lo sabe por el slug que `ConexionMp` guardó en `sessionStorage` antes de
 * redirigir. Por eso el encabezado es mínimo: acá todavía no se sabe de qué centro es.
 */
export default function MercadoPagoVuelta() {
  return (
    <>
      <header className="relative z-20 bg-tinta text-papel">
        <div className="mx-auto flex max-w-[1380px] items-center gap-3 px-6 py-6 lg:px-12">
          <Sello className="h-7 w-7 shrink-0" />
          <span className="ancha text-[0.82rem] font-semibold uppercase tracking-[0.24em]">
            Conexión con Mercado Pago
          </span>
        </div>
      </header>

      <main className="relative min-h-[60svh] bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          {/* useSearchParams exige un límite de Suspense: sin esto, el build falla. */}
          <Suspense fallback={null}>
            <VueltaMp />
          </Suspense>
        </div>
      </main>
    </>
  );
}
