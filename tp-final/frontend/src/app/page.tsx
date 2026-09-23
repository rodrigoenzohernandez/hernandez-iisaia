import Image from 'next/image';
import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import { Espina } from '@/components/Espina';
import { Pie } from '@/components/Pie';
import { BotonEnlace } from '@/components/Boton';
import { Flecha, Reloj } from '@/components/Iconos';
import { listarServicios, obtenerDisponibilidad, type Servicio } from '@/lib/cliente';
import { formatearDuracion, formatearFechaLarga, formatearPrecio, hoyEnCentro, sumarDias } from '@/lib/formato';

const PASOS = [
  {
    titulo: 'Elegís el tratamiento',
    texto:
      'Con su duración, su precio y cuánto es la seña a la vista, antes de comprometerte con nada.',
  },
  {
    titulo: 'Elegís el día y la hora',
    texto:
      'La grilla que ves es la agenda real del centro. Lo que ya está tomado se muestra tomado, no se esconde.',
  },
  {
    titulo: 'Dejás tus datos',
    texto:
      'Nombre, teléfono y mail. Sin crear una cuenta, sin contraseña y sin esperar que alguien conteste.',
  },
];

const DESTACADOS = [
  {
    busca: 'depilacion',
    foto: '/img/tratamiento-1.jpg',
    alt: 'Sesión de depilación definitiva con equipo de luz pulsada',
  },
  {
    busca: 'presoterapia',
    foto: '/img/tratamiento-2.jpg',
    alt: 'Profesional aplicando aparatología corporal en la sala del centro',
  },
  {
    busca: 'dermo health',
    foto: '/img/tratamiento-3.jpg',
    alt: 'Tratamiento facial con aparatología sobre la frente de una clienta',
  },
];

// La página muestra qué horarios quedan libres ahora mismo. Si Next la prerenderizara —cosa
// que haría si la API está caída al compilar, porque el catch se come la lectura dinámica—
// serviría una agenda horneada en el build.
export const dynamic = 'force-dynamic';

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * La prueba del primer viewport: un horario que de verdad está libre. Se busca sobre un
 * tratamiento concreto y se lo nombra al mostrarlo, porque la grilla depende de la duración:
 * otro tratamiento puede tener un hueco antes o después que este.
 */
async function proximoLibre(servicio: Servicio | undefined) {
  if (!servicio) return null;
  const fechas = Array.from({ length: 5 }, (_, i) => sumarDias(hoyEnCentro(), i));
  const dias = await Promise.all(
    fechas.map((fecha) => obtenerDisponibilidad(servicio.id, fecha).catch(() => null)),
  );
  for (const dia of dias) {
    const libre = dia?.data.find((slot) => slot.cuposDisponibles > 0);
    if (dia && libre) return { fecha: dia.fecha, hora: libre.hora, tratamiento: servicio.nombre };
  }
  return null;
}

export default async function Inicio() {
  const servicios = await listarServicios().catch(() => [] as Servicio[]);
  const proximo = await proximoLibre(servicios[0]);

  const destacados = DESTACADOS.map((destacado, i) => ({
    ...destacado,
    servicio:
      servicios.find((s) => normalizar(s.nombre).includes(destacado.busca)) ?? servicios[i],
  })).filter((d) => d.servicio);

  return (
    <>
      <Encabezado sobreFoto />

      <main>
        {/* Sobre el hero la espina es solo de escritorio: a ancho de teléfono el campo verde
            va a sangre y la línea le cruzaría el titular. */}
        <div className="relative">
          <Espina className="hidden lg:block" />

        {/* ---------- Primer viewport ---------- */}
        <section className="relative bg-tinta lg:min-h-[90svh]">
          <div className="relative h-[46svh] min-h-[280px] lg:absolute lg:inset-0 lg:h-full">
            <Image
              src="/img/hero.jpg"
              alt="Sesión de radiofrecuencia corporal en el centro"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[60%_center]"
            />
            <div className="absolute inset-0 bg-tinta/25 lg:bg-gradient-to-r lg:from-tinta/45 lg:to-transparent" />
          </div>

          {proximo && (
            <p className="absolute right-6 top-28 z-10 hidden max-w-[15rem] text-right text-papel lg:block lg:right-12">
              <span className="angosta block text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-verde">
                Próximo turno libre en {proximo.tratamiento}
              </span>
              <span className="cifra mt-2 block text-[0.98rem] leading-snug">
                {formatearFechaLarga(proximo.fecha)}, {proximo.hora} h
              </span>
            </p>
          )}

          <div className="relative z-10 mx-auto flex max-w-[1380px] px-0 lg:min-h-[90svh] lg:items-end lg:px-12 lg:pb-20">
            <div className="w-full bg-verde px-6 py-12 sm:px-10 lg:w-[min(48rem,62%)] lg:px-14 lg:py-14">
              <h1 className="ancha max-w-[17ch] text-[clamp(2.05rem,4.6vw,3.9rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em] text-tinta text-balance">
                El turno queda tomado ahora, no cuando alguien conteste
              </h1>
              <p className="angosta mt-7 max-w-[46ch] text-[1.02rem] leading-relaxed text-tinta/75">
                Tratamientos faciales y corporales con aparatología. Mirás la agenda real, elegís
                el horario que te sirve y listo.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <BotonEnlace href="/reservar" tono="tinta">
                  Reservar turno
                  <Flecha className="h-4 w-4" />
                </BotonEnlace>
                <Link
                  href="#tratamientos"
                  className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-tinta underline decoration-tinta/30 decoration-2 underline-offset-[0.3em] transition-colors hover:decoration-tinta"
                >
                  Ver los tratamientos
                </Link>
              </div>

              {proximo && (
                <p className="cifra angosta mt-9 flex items-center gap-2.5 text-[0.84rem] text-tinta/70 lg:hidden">
                  <Reloj className="h-4 w-4 shrink-0" />
                  {proximo.tratamiento}, próximo turno libre: {formatearFechaLarga(proximo.fecha)},{' '}
                  {proximo.hora} h
                </p>
              )}
            </div>
          </div>
        </section>

        </div>

        {/* De acá abajo la espina corre en todos los anchos, que es donde está la clienta. */}
        <div className="relative">
          <Espina />

        {/* ---------- Los tres pasos, colgando de la espina ---------- */}
        <section className="bg-papel px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1380px] pl-7 lg:pl-10">
            <h2 className="ancha max-w-[20ch] text-[clamp(1.6rem,2.9vw,2.5rem)] font-bold uppercase leading-[1.02] tracking-[-0.025em] text-balance">
              Reservar lleva tres pasos
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

        {/* ---------- Tres tratamientos con foto ---------- */}
        {destacados.length > 0 && (
          <section className="bg-papel-hueso px-6 pb-24 pt-20 lg:px-12 lg:pb-32 lg:pt-24">
            <div className="mx-auto max-w-[1380px] pl-7 lg:pl-10">
              <h2 className="ancha max-w-[18ch] text-[clamp(1.6rem,2.9vw,2.5rem)] font-bold uppercase leading-[1.02] tracking-[-0.025em] text-balance">
                Cara, cuerpo y depilación
              </h2>
              <p className="angosta mt-5 max-w-[58ch] text-[1.02rem] leading-relaxed text-tinta-suave">
                Tres de los {servicios.length} tratamientos, uno por cada cosa que hacemos. El
                listado completo, con duración y precio, está más abajo.
              </p>
              <div className="mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {destacados.map(({ servicio, foto, alt }) => (
                  <Link
                    key={servicio!.id}
                    href={`/reservar?servicio=${servicio!.id}`}
                    className="group flex flex-col"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <Image
                        src={foto}
                        alt={alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-[700ms] ease-[var(--ease-salida)] group-hover:scale-[1.04]"
                      />
                    </div>
                    <h3 className="ancha mt-6 text-[1.22rem] font-bold uppercase leading-tight tracking-[-0.015em]">
                      {servicio!.nombre}
                    </h3>
                    <p className="cifra angosta mt-2.5 text-[0.82rem] uppercase tracking-[0.1em] text-verde-hondo">
                      {formatearDuracion(servicio!.duracionMinutos)} ·{' '}
                      {formatearPrecio(servicio!.precioCentavos)}
                    </p>
                    {servicio!.descripcion && (
                      <p className="angosta mt-4 max-w-[42ch] text-[0.95rem] leading-relaxed text-tinta-suave">
                        {servicio!.descripcion}
                      </p>
                    )}
                    <span className="mt-5 inline-flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta">
                      Reservar
                      <Flecha className="h-3.5 w-3.5 transition-transform duration-300 ease-[var(--ease-salida)] group-hover:translate-x-1" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------- El catálogo entero, como una ficha ---------- */}
        <section id="tratamientos" className="scroll-mt-4 bg-papel px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1380px] pl-7 lg:pl-10">
            <h2 className="ancha max-w-[16ch] text-[clamp(1.6rem,2.9vw,2.5rem)] font-bold uppercase leading-[1.02] tracking-[-0.025em] text-balance">
              Todo lo que se puede reservar
            </h2>

            {servicios.length === 0 ? (
              <p className="angosta mt-10 max-w-[52ch] text-[1.02rem] leading-relaxed text-tinta-suave">
                No pudimos traer el listado de tratamientos. Actualizá la página en un momento.
              </p>
            ) : (
              <ul className="mt-14 border-t border-tinta/15">
                {servicios.map((servicio) => (
                  <li key={servicio.id} className="border-b border-tinta/15">
                    <Link
                      href={`/reservar?servicio=${servicio.id}`}
                      className="group grid grid-cols-2 items-baseline gap-x-8 gap-y-2 py-7 transition-colors duration-200 hover:bg-verde-humo/45 md:grid-cols-[minmax(0,1.6fr)_7rem_8rem_8rem_2rem] md:py-6"
                    >
                      <h3 className="ancha col-span-2 text-[1.12rem] font-bold uppercase leading-tight tracking-[-0.015em] md:col-span-1 md:text-[1.02rem]">
                        {servicio.nombre}
                        {servicio.requiereValoracion && (
                          <span className="angosta mt-1.5 block text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-verde-hondo sm:mt-0 sm:ml-3 sm:inline sm:whitespace-nowrap sm:align-middle">
                            Con valoración previa
                          </span>
                        )}
                      </h3>
                      <p className="cifra angosta text-[0.86rem] text-tinta-tenue">
                        {formatearDuracion(servicio.duracionMinutos)}
                      </p>
                      <p className="cifra angosta text-[0.86rem] text-right text-tinta-tenue md:text-left">
                        Seña {formatearPrecio(servicio.senaCentavos)}
                      </p>
                      <p className="cifra ancha text-[1.05rem] font-bold">
                        {formatearPrecio(servicio.precioCentavos)}
                      </p>
                      <Flecha
                        className="hidden h-4 w-4 text-tinta-tenue transition-transform duration-300 ease-[var(--ease-salida)] group-hover:translate-x-1 group-hover:text-tinta md:block"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <p className="angosta mt-10 max-w-[62ch] text-[0.92rem] leading-relaxed text-tinta-tenue">
              La seña se abona al reservar y se descuenta del total. Si elegís pagarla en
              efectivo en el local, el turno queda confirmado en el momento.
            </p>
          </div>
        </section>

        {/* ---------- El centro ---------- */}
        <section className="relative isolate overflow-hidden bg-tinta text-papel">
          <div className="grid lg:grid-cols-2">
            <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[34rem]">
              <Image
                src="/img/centro.jpg"
                alt="Profesional del centro realizando un tratamiento facial"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="flex items-center px-6 py-20 sm:px-10 lg:px-16 lg:py-24">
              <div>
                <h2 className="ancha max-w-[18ch] text-[clamp(1.6rem,2.7vw,2.4rem)] font-bold uppercase leading-[1.03] tracking-[-0.025em] text-balance">
                  Aparatología, criterio y una agenda que se respeta
                </h2>
                <p className="angosta mt-8 max-w-[52ch] text-[1.02rem] leading-relaxed text-papel/70">
                  Trabajamos tratamientos faciales y corporales con equipamiento profesional. La
                  mayoría arranca con una valoración previa, porque la técnica y la zona se
                  deciden mirando tu piel y no un catálogo.
                </p>
                <p className="angosta mt-5 max-w-[52ch] text-[1.02rem] leading-relaxed text-papel/70">
                  Cada turno tiene su duración reservada de punta a punta. Por eso la agenda que
                  ves online es la que existe: si un horario aparece libre, es tuyo.
                </p>
                <div className="mt-11">
                  <BotonEnlace href="/reservar" tono="verde">
                    Ver horarios disponibles
                    <Flecha className="h-4 w-4" />
                  </BotonEnlace>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Cierre ---------- */}
        <section className="relative isolate flex min-h-[26rem] items-center overflow-hidden px-6 py-24 lg:px-12">
          <Image
            src="/img/cierre.jpg"
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="-z-10 object-cover object-center"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-tinta/55" />
          <div className="mx-auto w-full max-w-[1380px] pl-7 lg:pl-10">
            <h2 className="ancha max-w-[18ch] text-[clamp(1.7rem,3.4vw,3rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-papel text-balance">
              Fijate qué horarios quedan esta semana
            </h2>
            <div className="mt-10">
              <BotonEnlace href="/reservar" tono="verde">
                Reservar turno
                <Flecha className="h-4 w-4" />
              </BotonEnlace>
            </div>
          </div>
        </section>
        </div>
      </main>

      <Pie />
    </>
  );
}
