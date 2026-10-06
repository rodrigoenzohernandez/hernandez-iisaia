import Link from 'next/link';
import { Espina } from '@/components/Espina';
import { BotonEnlace } from '@/components/Boton';
import { Flecha } from '@/components/Iconos';
import { EncabezadoPlataforma } from '@/components/plataforma/EncabezadoPlataforma';
import { EntrarACentro } from '@/components/plataforma/EntrarACentro';
import { listarPlanes, type Plan } from '@/lib/cliente';
import { formatearPrecio } from '@/lib/formato';
import { PLATAFORMA } from '@/lib/centro';

export const dynamic = 'force-dynamic';

const PASOS = [
  {
    titulo: 'Cargás tu agenda',
    texto:
      'Tus tratamientos con duración, precio y seña, y los horarios en que atendés. En minutos, sin instalar nada.',
  },
  {
    titulo: 'Tus clientas reservan solas',
    texto:
      'Ven la grilla real y toman el turno contra la agenda, al instante. Sin WhatsApp y sin esperar que contestes.',
  },
  {
    titulo: 'Cobrás la seña online',
    texto:
      'Con Mercado Pago conectado, la seña se cobra al reservar y las devoluciones salen solas. El resto, en el centro.',
  },
];

export default async function Plataforma() {
  const planes = await listarPlanes().catch(() => [] as Plan[]);

  return (
    <>
      <EncabezadoPlataforma />

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative bg-tinta text-papel">
          <div className="relative mx-auto max-w-[1380px] py-16 lg:px-12 lg:py-32">
            {/* El campo verde va a sangre completo en móvil (como la landing de centro) y se
                acota recién en escritorio: la regla del campo entero. */}
            <div className="w-full bg-verde px-6 py-12 text-tinta sm:px-10 lg:w-[min(46rem,70%)] lg:px-14 lg:py-14">
              <h1 className="ancha text-[clamp(2.05rem,4.6vw,3.9rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em] text-balance">
                La agenda de turnos de tu centro, online
              </h1>
              <p className="angosta mt-7 max-w-[46ch] text-[1.05rem] leading-relaxed text-tinta/75">
                Tus clientas reservan solas contra la grilla real de tu centro —sin mensajes, sin
                turnos pisados, sin una agenda que vive en una sola cabeza—. Vos cargás los
                tratamientos y los horarios; el sistema toma los turnos.
              </p>
              <div className="mt-9">
                <BotonEnlace href="/registrarse" tono="tinta">
                  Registrá tu centro
                  <Flecha className="h-4 w-4" />
                </BotonEnlace>
              </div>
            </div>

            <div className="mt-12 px-6 lg:mt-16 lg:px-0">
              <p className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-papel/60">
                ¿Ya tenés tu centro? Entrá al panel
              </p>
              <div className="mt-4">
                <EntrarACentro />
              </div>
            </div>
          </div>
        </section>

        <div className="relative">
          <Espina />

          {/* ---------- Cómo funciona ---------- */}
          <section className="bg-papel px-6 py-24 lg:px-12 lg:py-32">
            <div className="mx-auto max-w-[1380px] pl-7 lg:pl-10">
              <h2 className="ancha max-w-[18ch] text-[clamp(1.6rem,2.9vw,2.5rem)] font-bold uppercase leading-[1.02] tracking-[-0.025em] text-balance">
                Reemplazá los turnos por WhatsApp
              </h2>
              <ol className="mt-16 space-y-16 text-tinta lg:mt-20 lg:space-y-20">
                {PASOS.map((paso, i) => (
                  <li
                    key={paso.titulo}
                    className="grid gap-x-12 gap-y-4 md:grid-cols-[5.5rem_minmax(0,19rem)_minmax(0,1fr)] md:items-baseline"
                  >
                    <span
                      aria-hidden
                      className="cifra ancha text-[clamp(2.4rem,4vw,3.6rem)] font-extrabold leading-[0.85] tracking-[-0.035em] text-verde-hondo"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="ancha text-balance text-[1.35rem] font-bold uppercase leading-[1.1] tracking-[-0.015em]">
                      {paso.titulo}
                    </h3>
                    <p className="angosta max-w-[52ch] text-[1.05rem] leading-relaxed text-tinta-suave">
                      {paso.texto}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ---------- Planes ---------- */}
          {planes.length > 0 && (
            <section className="bg-papel-hueso px-6 py-24 lg:px-12 lg:py-32">
              <div className="mx-auto max-w-[1380px] pl-7 lg:pl-10">
                <h2 className="ancha max-w-[16ch] text-[clamp(1.6rem,2.9vw,2.5rem)] font-bold uppercase leading-[1.02] tracking-[-0.025em] text-balance">
                  Empezá gratis, crecé cuando quieras
                </h2>
                <div className="mt-14 grid max-w-[52rem] gap-8 sm:grid-cols-2">
                  {planes.map((plan) => (
                    <TarjetaPlan key={plan.id} plan={plan} />
                  ))}
                </div>
                <p className="angosta mt-10 max-w-[56ch] text-[0.92rem] leading-relaxed text-tinta-tenue">
                  El cobro online, las señas y los recordatorios son del Profesional. Cambiás de
                  plan desde el panel cuando quieras.
                </p>
              </div>
            </section>
          )}

          {/* ---------- Cierre ---------- */}
          <section className="bg-tinta px-6 py-24 text-papel lg:px-12 lg:py-28">
            <div className="mx-auto max-w-[1380px] pl-7 lg:pl-10">
              <h2 className="ancha max-w-[20ch] text-[clamp(1.7rem,3.4vw,3rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-balance">
                Tu agenda, tomando turnos sola
              </h2>
              <div className="mt-10">
                <BotonEnlace href="/registrarse" tono="verde">
                  Registrá tu centro
                  <Flecha className="h-4 w-4" />
                </BotonEnlace>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-tinta text-papel">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-4 border-t border-papel/12 px-6 py-10 lg:px-12">
          <span className="ancha text-[0.7rem] uppercase tracking-[0.18em] text-papel/55">
            {PLATAFORMA.nombre}
          </span>
          <Link
            href="/plataforma"
            className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-papel/55 transition-colors hover:text-papel"
          >
            Plataforma
          </Link>
        </div>
      </footer>
    </>
  );
}

function TarjetaPlan({ plan }: { plan: Plan }) {
  const profesional = plan.id === 'profesional';
  return (
    <div className={`p-7 ${profesional ? 'bg-tinta text-papel' : 'border border-tinta/15'}`}>
      <h3 className="ancha text-[1.22rem] font-bold uppercase tracking-[-0.01em]">{plan.nombre}</h3>
      <p className="cifra mt-3 text-[1.6rem] font-bold">
        {plan.precioCentavos === 0 ? (
          'Gratis'
        ) : (
          <>
            {formatearPrecio(plan.precioCentavos)}
            <span className="angosta text-[0.82rem] font-normal opacity-70"> / mes</span>
          </>
        )}
      </p>
      <ul className={`angosta mt-6 space-y-2.5 text-[0.92rem] ${profesional ? 'text-papel/80' : 'text-tinta-suave'}`}>
        <li>{plan.turnosPorMes === null ? 'Turnos sin tope' : `${plan.turnosPorMes} turnos por mes`}</li>
        <li>Hasta {plan.capacidadMaxima} {plan.capacidadMaxima === 1 ? 'turno' : 'turnos'} a la vez por franja</li>
        <li>{plan.recordatorios ? 'Recordatorio 24 h antes' : 'Sin recordatorios automáticos'}</li>
        <li>{plan.cobroOnline ? 'Cobro online, señas y reembolsos' : 'Sin cobro online'}</li>
      </ul>
    </div>
  );
}
