import type { Metadata } from 'next';
import { Encabezado } from '@/components/Encabezado';
import { Espina } from '@/components/Espina';
import { Pie } from '@/components/Pie';
import { Ingreso } from '@/components/cuenta/Ingreso';

export const metadata: Metadata = {
  title: 'Ingresar — Natura Estética Integral',
  description: 'Entrá con un código al mail para ver, reprogramar o cancelar tus turnos.',
  robots: { index: false },
};

export default function Ingresar() {
  return (
    <>
      <Encabezado />

      <main className="relative bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <Ingreso />
        </div>
      </main>

      <Pie />
    </>
  );
}
