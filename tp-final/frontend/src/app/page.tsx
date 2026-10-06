import Link from 'next/link';

// Placeholder de la landing de plataforma (Workstream B la reemplaza). Por ahora, un punto de
// entrada mínimo para que la raíz no sea un 404 mientras se migra a multi-tenant.
export default function Inicio() {
  return (
    <main className="mx-auto max-w-[1380px] px-6 py-24 lg:px-12">
      <h1 className="ancha max-w-[20ch] text-[clamp(1.9rem,4vw,3.2rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.03em]">
        Turnos para tu centro de estética
      </h1>
      <p className="angosta mt-6 max-w-[48ch] text-[1.05rem] leading-relaxed text-tinta-suave">
        La agenda online de tu centro: tus clientas reservan solas contra la grilla real.
      </p>
      <p className="mt-10">
        <Link
          href="/registrarse"
          className="ancha inline-flex items-center bg-verde px-7 py-4 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-tinta"
        >
          Registrá tu centro
        </Link>
      </p>
    </main>
  );
}
