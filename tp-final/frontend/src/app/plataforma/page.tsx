import type { Metadata } from 'next';
import { Espina } from '@/components/Espina';
import { EncabezadoPlataforma } from '@/components/plataforma/EncabezadoPlataforma';
import { Plataforma } from '@/components/plataforma/Plataforma';

export const metadata: Metadata = {
  title: 'Plataforma',
  robots: { index: false },
};

export default function PlataformaPanel() {
  return (
    <>
      <EncabezadoPlataforma conRegistro={false} />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <Plataforma />
        </div>
      </main>
    </>
  );
}
