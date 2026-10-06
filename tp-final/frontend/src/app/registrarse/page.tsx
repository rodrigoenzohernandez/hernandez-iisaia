import type { Metadata } from 'next';
import { Espina } from '@/components/Espina';
import { EncabezadoPlataforma } from '@/components/plataforma/EncabezadoPlataforma';
import { RegistroCentro } from '@/components/plataforma/RegistroCentro';

export const metadata: Metadata = {
  title: 'Registrá tu centro',
  description: 'Creá tu centro y tu cuenta de administradora en un paso, y entrá directo al panel.',
};

export default function Registrarse() {
  return (
    <>
      <EncabezadoPlataforma />

      <main className="relative min-h-[70svh] bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <RegistroCentro />
        </div>
      </main>
    </>
  );
}
