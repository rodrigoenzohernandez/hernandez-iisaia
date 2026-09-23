'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Boton } from '@/components/Boton';
import { Flecha, FlechaIzquierda, Tilde } from '@/components/Iconos';
import {
  crearReserva,
  ErrorApi,
  type MetodoPago,
  type Reserva,
  type Servicio,
} from '@/lib/cliente';
import { formatearDuracion, formatearFechaLarga, formatearPrecio } from '@/lib/formato';
import { SelectorFecha } from './SelectorFecha';

const PASOS = ['Tratamiento', 'Día y hora', 'Tus datos'] as const;

const campo =
  'mt-2 w-full border border-tinta/20 bg-papel px-4 py-3 text-[0.98rem] text-tinta transition-colors placeholder:text-tinta-tenue focus:border-verde-hondo focus:outline-none';
const etiqueta = 'angosta block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-tinta-suave';

export function Flujo({ servicios, inicial }: { servicios: Servicio[]; inicial: Servicio | null }) {
  const [paso, setPaso] = useState<0 | 1 | 2>(inicial ? 1 : 0);
  const [servicio, setServicio] = useState<Servicio | null>(inicial);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [recargar, setRecargar] = useState(0);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');

  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);

  function elegirServicio(elegido: Servicio) {
    setServicio(elegido);
    setFecha(null);
    setHora(null);
    setAviso(null);
    setPaso(1);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!servicio || !fecha || !hora) return;
    setEnviando(true);
    setAviso(null);
    try {
      const creada = await crearReserva({
        servicioId: servicio.id,
        fecha,
        hora,
        metodoPago,
        clienteNombre: nombre,
        clienteEmail: email,
        clienteTelefono: telefono,
        notas: notas.trim() || undefined,
      });
      setReserva(creada);
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      setAviso(e.message);
      switch (e.codigo) {
        // El horario se ocupó, quedó fuera de agenda o ya pasó: la grilla que tiene la
        // clienta en pantalla está vencida. Volvemos al paso 2 y la pedimos de nuevo.
        case 'slot_full':
        case 'outside_business_hours':
        case 'past_date':
        case 'too_far_ahead':
          setHora(null);
          setRecargar((n) => n + 1);
          setPaso(1);
          break;
        // El tratamiento se dio de baja mientras la pantalla estaba abierta.
        case 'servicio_not_found':
          setServicio(null);
          setFecha(null);
          setHora(null);
          setPaso(0);
          break;
        default:
          break;
      }
    } finally {
      setEnviando(false);
    }
  }

  if (reserva && servicio) {
    return <Confirmacion reserva={reserva} servicio={servicio} />;
  }

  return (
    <div>
      {/* La dirección del paso queda siempre a la vista. */}
      <ol className="flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-tinta/15 pb-6">
        {PASOS.map((nombrePaso, i) => {
          const activo = i === paso;
          const alcanzable = i < paso;
          return (
            <li key={nombrePaso}>
              <button
                type="button"
                disabled={!alcanzable && !activo}
                onClick={() => alcanzable && setPaso(i as 0 | 1 | 2)}
                aria-current={activo ? 'step' : undefined}
                className={[
                  '-my-2 flex items-baseline gap-2.5 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                  // El paso no alcanzado se distingue por peso, no por peso Y opacidad juntos:
                  // encimar las dos lo dejaba casi invisible, y el encabezado tiene que poder
                  // decir siempre dónde estás y qué falta.
                  activo
                    ? 'text-tinta'
                    : alcanzable
                      ? 'text-tinta-tenue hover:text-tinta'
                      : 'cursor-not-allowed text-tinta-tenue/75',
                ].join(' ')}
              >
                {/* El peso del numeral codifica el estado: el paso en curso pesa, el ya
                    recorrido menos, el que no se alcanzó todavía es el más liviano. */}
                <span
                  className={[
                    'cifra ancha text-[1.2rem] leading-none',
                    activo ? 'font-extrabold text-verde-hondo' : alcanzable ? 'font-semibold' : 'font-light',
                  ].join(' ')}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {nombrePaso}
              </button>
            </li>
          );
        })}
      </ol>

      {aviso && (
        <p
          role="status"
          className="mt-8 bg-verde-humo px-6 py-5 text-[0.95rem] leading-relaxed text-tinta"
        >
          {aviso}
        </p>
      )}

      {/* ---------- 01 ---------- */}
      {paso === 0 && (
        <section className="mt-12">
          <h2 className="ancha text-[clamp(1.4rem,2.4vw,2rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
            ¿Qué te querés hacer?
          </h2>
          <ul className="mt-10 border-t border-tinta/15">
            {servicios.map((s) => (
              <li key={s.id} className="border-b border-tinta/15">
                <button
                  type="button"
                  onClick={() => elegirServicio(s)}
                  className="group grid w-full grid-cols-2 items-baseline gap-x-8 gap-y-2 py-6 text-left transition-colors duration-200 hover:bg-verde-humo/45 md:grid-cols-[minmax(0,1.5fr)_7rem_8rem_2rem]"
                >
                  <h3 className="ancha col-span-2 text-[1.05rem] font-bold uppercase leading-tight tracking-[-0.015em] md:col-span-1">
                    {s.nombre}
                    {s.requiereValoracion && (
                      <span className="angosta mt-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-verde-hondo sm:mt-0 sm:ml-3 sm:inline sm:whitespace-nowrap sm:align-middle">
                        Con valoración previa
                      </span>
                    )}
                  </h3>
                  <p className="cifra angosta text-[0.84rem] text-tinta-tenue">
                    {formatearDuracion(s.duracionMinutos)}
                  </p>
                  <p className="cifra ancha text-right text-[1rem] font-bold md:text-left">
                    {formatearPrecio(s.precioCentavos)}
                  </p>
                  <Flecha className="hidden h-4 w-4 text-tinta-tenue transition-transform duration-300 ease-[var(--ease-salida)] group-hover:translate-x-1 group-hover:text-tinta md:block" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- 02 ---------- */}
      {paso === 1 && servicio && (
        <section className="mt-12">
          <h2 className="ancha text-[clamp(1.4rem,2.4vw,2rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
            ¿Cuándo te viene bien?
          </h2>
          <p className="angosta mt-3 text-[0.95rem] text-tinta-suave">
            {servicio.nombre} · {formatearDuracion(servicio.duracionMinutos)} ·{' '}
            <span className="cifra">{formatearPrecio(servicio.precioCentavos)}</span>
          </p>

          <div className="mt-12">
            <SelectorFecha
              servicio={servicio}
              fecha={fecha}
              hora={hora}
              recargar={recargar}
              onElegir={(f, h) => {
                setFecha(f);
                setHora(h);
                setAviso(null);
              }}
            />
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-5">
            <Boton type="button" tono="borde" onClick={() => setPaso(0)}>
              <FlechaIzquierda className="h-4 w-4" />
              Cambiar tratamiento
            </Boton>
            <Boton type="button" disabled={!fecha || !hora} onClick={() => setPaso(2)}>
              Continuar
              <Flecha className="h-4 w-4" />
            </Boton>
            {fecha && hora && (
              <p className="cifra angosta text-[0.88rem] text-tinta-suave">
                {formatearFechaLarga(fecha)}, {hora} h
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---------- 03 ---------- */}
      {paso === 2 && servicio && fecha && hora && (
        <section className="mt-12">
          <h2 className="ancha text-[clamp(1.4rem,2.4vw,2rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
            Tus datos
          </h2>

          <div className="mt-10 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <form onSubmit={enviar} className="order-2 lg:order-1">
              <div className="grid gap-7 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="nombre" className={etiqueta}>
                    Nombre y apellido
                  </label>
                  <input
                    id="nombre"
                    className={campo}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className={etiqueta}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={campo}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    aria-describedby="email-nota"
                  />
                  <p id="email-nota" className="angosta mt-2 text-[0.78rem] leading-relaxed text-tinta-tenue">
                    No mandamos mails: nos sirve para encontrar tu turno si nos escribís.
                  </p>
                </div>
                <div>
                  <label htmlFor="telefono" className={etiqueta}>
                    Teléfono
                  </label>
                  <input
                    id="telefono"
                    type="tel"
                    className={campo}
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    required
                    minLength={6}
                    maxLength={30}
                    autoComplete="tel"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="notas" className={etiqueta}>
                    Algo que quieras aclarar <span className="normal-case">(opcional)</span>
                  </label>
                  <textarea
                    id="notas"
                    rows={3}
                    maxLength={500}
                    className={`${campo} resize-y`}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>
              </div>

              <fieldset className="mt-10">
                <legend className={etiqueta}>Cómo pagás la seña</legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        valor: 'efectivo',
                        titulo: 'En efectivo, en el local',
                        nota: 'El turno queda confirmado ahora mismo.',
                      },
                      {
                        valor: 'mercadopago',
                        titulo: 'Mercado Pago',
                        nota: 'Todavía no se cobra online. El turno queda pendiente hasta que el centro lo confirme a mano.',
                      },
                    ] as const
                  ).map((opcion) => (
                    <label
                      key={opcion.valor}
                      className={[
                        'cursor-pointer border px-5 py-4 transition-colors',
                        metodoPago === opcion.valor
                          ? 'border-verde-hondo bg-verde-humo/55'
                          : 'border-tinta/20 hover:border-tinta/45',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="metodoPago"
                        value={opcion.valor}
                        checked={metodoPago === opcion.valor}
                        onChange={() => setMetodoPago(opcion.valor)}
                        className="sr-only"
                      />
                      <span className="block text-[0.95rem] font-semibold">{opcion.titulo}</span>
                      <span className="angosta mt-1.5 block text-[0.85rem] leading-relaxed text-tinta-suave">
                        {opcion.nota}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-12 flex flex-wrap items-center gap-5">
                <Boton type="button" tono="borde" onClick={() => setPaso(1)}>
                  <FlechaIzquierda className="h-4 w-4" />
                  Cambiar horario
                </Boton>
                <Boton type="submit" disabled={enviando}>
                  {enviando ? 'Reservando…' : 'Confirmar turno'}
                  {!enviando && <Flecha className="h-4 w-4" />}
                </Boton>
              </div>
            </form>

            <aside className="order-1 h-fit bg-tinta px-7 py-8 text-papel lg:order-2">
              <h3 className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-verde">
                Tu turno
              </h3>
              <dl className="mt-6 space-y-5 text-[0.92rem]">
                <Dato titulo="Tratamiento" valor={servicio.nombre} />
                <Dato titulo="Cuándo" valor={`${formatearFechaLarga(fecha)}, ${hora} h`} />
                <Dato titulo="Dura" valor={formatearDuracion(servicio.duracionMinutos)} />
                <Dato titulo="Sale" valor={formatearPrecio(servicio.precioCentavos)} />
                <Dato
                  titulo="Seña a abonar"
                  valor={formatearPrecio(servicio.senaCentavos)}
                  destacado
                />
              </dl>
              <p className="angosta mt-7 border-t border-papel/15 pt-5 text-[0.82rem] leading-relaxed text-papel/60">
                La seña se descuenta del total el día del turno.
              </p>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div>
      <dt className="angosta text-[0.68rem] uppercase tracking-[0.16em] text-papel/65">{titulo}</dt>
      <dd
        className={`mt-1 ${destacado ? 'cifra ancha text-[1.3rem] font-bold text-verde' : 'cifra'}`}
      >
        {valor}
      </dd>
    </div>
  );
}

function Confirmacion({ reserva, servicio }: { reserva: Reserva; servicio: Servicio }) {
  const confirmada = reserva.estado === 'confirmada';
  return (
    <section className="mt-10">
      <div className="flex items-center gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            confirmada ? 'bg-verde text-tinta' : 'border border-tinta/25 text-tinta'
          }`}
        >
          <Tilde className="h-5 w-5" />
        </span>
        <h2 className="ancha text-[clamp(1.4rem,2.6vw,2.2rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          {confirmada ? 'Turno confirmado' : 'Turno reservado, falta confirmarlo'}
        </h2>
      </div>

      <p className="angosta mt-7 max-w-[56ch] text-[1.02rem] leading-relaxed text-tinta-suave">
        {confirmada
          ? 'Te esperamos. La seña la abonás en el local el día del turno y se descuenta del total.'
          : 'Elegiste Mercado Pago, pero todavía no cobramos online. El centro ve tu pedido y confirma el turno a mano; hasta entonces el horario te queda reservado.'}
      </p>

      <dl className="mt-12 grid max-w-[46rem] gap-x-12 gap-y-7 border-t border-tinta/15 pt-9 sm:grid-cols-2">
        <DatoClaro titulo="Tratamiento" valor={servicio.nombre} />
        <DatoClaro
          titulo="Cuándo"
          valor={`${formatearFechaLarga(reserva.fecha)}, de ${reserva.horaInicio} a ${reserva.horaFin} h`}
        />
        <DatoClaro titulo="A nombre de" valor={reserva.clienteNombre} />
        <DatoClaro titulo="Seña" valor={formatearPrecio(reserva.senaCentavos)} />
      </dl>

      <p className="angosta mt-12 max-w-[56ch] bg-verde-humo px-6 py-5 text-[0.92rem] leading-relaxed">
        Anotá el día y la hora: todavía no mandamos mails de confirmación, y el turno no se puede
        cancelar ni reprogramar desde acá. Para cambiarlo hay que hablar con el centro.
      </p>

      <div className="mt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-tinta underline decoration-verde decoration-2 underline-offset-[0.35em]"
        >
          <FlechaIzquierda className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}

function DatoClaro({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="angosta text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-tinta-tenue">
        {titulo}
      </dt>
      <dd className="cifra mt-1.5 text-[1.05rem]">{valor}</dd>
    </div>
  );
}
