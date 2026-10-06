'use client';

import { useEffect, useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton, BotonEnlace } from '@/components/Boton';
import { Flecha } from '@/components/Iconos';
import { SelectorFecha } from '@/components/reserva/SelectorFecha';
import { ErrorApi, listarServicios, type Reserva, type Servicio } from '@/lib/cliente';
import { cancelarMiReserva, misReservas, reprogramarMiReserva } from '@/lib/cuenta';
import { formatearFechaLarga, formatearPrecio } from '@/lib/formato';
import { cerrarSesion, leerToken, sesionVencida } from '@/lib/sesion';
import { useSlug } from '@/hooks/useSlug';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo' }
  | { tipo: 'error'; mensaje: string }
  | {
      tipo: 'listo';
      token: string;
      reservas: Reserva[];
      servicios: Map<string, Servicio>;
    };

export function MisTurnos() {
  const slug = useSlug();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [recargar, setRecargar] = useState(0);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      const token = leerToken('clienta', slug);
      if (!token) {
        if (vigente) setEstado({ tipo: 'anonimo' });
        return;
      }
      try {
        // El catálogo va aparte porque la reserva trae `servicioId` y no el tratamiento:
        // hace falta para el nombre y para la grilla de reprogramación.
        const [pagina, servicios] = await Promise.all([misReservas(slug, token), listarServicios(slug)]);
        if (!vigente) return;
        setEstado({
          tipo: 'listo',
          token,
          reservas: pagina.data,
          servicios: new Map(servicios.map((s) => [s.id, s])),
        });
      } catch (e) {
        if (!vigente) return;
        if (!(e instanceof ErrorApi)) throw e;
        // El token venció, es de otro centro o la cuenta ya no existe: insistir con él no
        // lleva a ningún lado, así que se tira y se vuelve a pedir el ingreso.
        if (sesionVencida(e.codigo) || e.codigo === 'cliente_not_found') {
          cerrarSesion('clienta', slug);
          setEstado({ tipo: 'anonimo' });
          return;
        }
        setEstado({ tipo: 'error', mensaje: e.message });
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [recargar, slug]);

  if (estado.tipo === 'cargando') {
    // La carga se cuenta, no gira: el sistema no tiene spinners.
    return (
      <p aria-live="polite" className="angosta text-[1.02rem] text-tinta-suave">
        Buscando tus turnos…
      </p>
    );
  }

  if (estado.tipo === 'anonimo') {
    return (
      <section className="max-w-[52ch]">
        <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          Entrá para ver tus turnos
        </h1>
        <p className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
          Te mandamos un código al mail con el que reservaste. No hace falta contraseña.
        </p>
        <div className="mt-11">
          <BotonEnlace href={`/${slug}/ingresar`}>
            Ingresar
            <Flecha className="h-4 w-4" />
          </BotonEnlace>
        </div>
      </section>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <section className="max-w-[52ch]">
        <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          No pudimos traer tus turnos
        </h1>
        <Aviso tono="error" className="mt-8">
          {estado.mensaje}
        </Aviso>
        <div className="mt-10">
          <Boton tono="borde" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </Boton>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4">
        <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          Mis turnos
        </h1>
        <button
          type="button"
          onClick={() => {
            cerrarSesion('clienta', slug);
            setEstado({ tipo: 'anonimo' });
          }}
          className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] transition-colors hover:text-tinta"
        >
          Cerrar sesión
        </button>
      </div>

      {estado.reservas.length === 0 ? (
        <div className="mt-10 max-w-[52ch]">
          <p className="angosta text-[1.02rem] leading-relaxed text-tinta-suave">
            Todavía no tenés turnos con este mail. Si reservaste con otro, entrá con ese.
          </p>
          <div className="mt-10">
            <BotonEnlace href={`/${slug}/reservar`}>
              Reservar un turno
              <Flecha className="h-4 w-4" />
            </BotonEnlace>
          </div>
        </div>
      ) : (
        <ul className="mt-12 border-t border-tinta/15">
          {estado.reservas.map((reserva) => (
            <FilaTurno
              key={reserva.id}
              reserva={reserva}
              servicio={estado.servicios.get(reserva.servicioId) ?? null}
              token={estado.token}
              onCambio={() => setRecargar((n) => n + 1)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ la fila */

type Accion = null | 'cancelar' | 'reprogramar';

function FilaTurno({
  reserva,
  servicio,
  token,
  onCambio,
}: {
  reserva: Reserva;
  servicio: Servicio | null;
  token: string;
  onCambio: () => void;
}) {
  const slug = useSlug();
  const [accion, setAccion] = useState<Accion>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abierta = reserva.estado === 'confirmada' || reserva.estado === 'pendiente';
  const pagado = reserva.cobro ? reserva.cobro.pagadoCentavos - reserva.cobro.reembolsadoCentavos : 0;

  async function correr(tarea: () => Promise<unknown>) {
    setTrabajando(true);
    setError(null);
    try {
      await tarea();
      setAccion(null);
      onCambio();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `reschedule_not_allowed` incluido: el mensaje del backend ya manda a escribirle al
      // centro, y es más preciso que cualquier cosa que redacte el front.
      setError(e.message);
      setTrabajando(false);
    }
  }

  return (
    <li className="border-b border-tinta/15 py-8">
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <div>
          <p className="ancha text-[1.22rem] font-bold uppercase leading-tight tracking-[-0.015em]">
            {servicio?.nombre ?? 'Tratamiento'}
          </p>
          <p className="cifra angosta mt-2.5 text-[0.95rem] text-tinta-suave">
            {/* Primera en mayúscula: Intl devuelve "lunes 5 de octubre". */}
            {mayuscula(formatearFechaLarga(reserva.fecha))} · {reserva.horaInicio} a{' '}
            {reserva.horaFin}
          </p>
          <p className="cifra angosta mt-1.5 text-[0.88rem] text-tinta-tenue">
            {formatearPrecio(reserva.precioCentavos)}
            {reserva.senaCentavos > 0 && <> · seña {formatearPrecio(reserva.senaCentavos)}</>}
            {pagado > 0 && <> · pagaste {formatearPrecio(pagado)}</>}
          </p>
        </div>
        <Sello reserva={reserva} />
      </div>

      {error && (
        <Aviso tono="error" className="mt-6">
          {error}
        </Aviso>
      )}

      {/* ---- los botones los decide el servidor, no la aritmética del front ---- */}
      {abierta && accion === null && (
        <div className="mt-6 flex flex-wrap items-center gap-5">
          {reserva.puedeReprogramar && (
            <Boton tono="borde" onClick={() => setAccion('reprogramar')} className="py-2.5 text-[0.72rem]">
              Reprogramar
            </Boton>
          )}
          <Boton tono="borde" onClick={() => setAccion('cancelar')} className="py-2.5 text-[0.72rem]">
            Cancelar
          </Boton>
        </div>
      )}

      {accion === 'cancelar' && (
        <div className="mt-6 max-w-[56ch]">
          <Aviso>{textoDeCancelacion(reserva, pagado)}</Aviso>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <Boton
              onClick={() => correr(() => cancelarMiReserva(slug, token, reserva.id))}
              disabled={trabajando}
              className="py-2.5 text-[0.72rem]"
            >
              {trabajando ? 'Cancelando…' : 'Sí, cancelar el turno'}
            </Boton>
            <button
              type="button"
              onClick={() => {
                setAccion(null);
                setError(null);
              }}
              disabled={trabajando}
              className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45"
            >
              No, dejarlo así
            </button>
          </div>
        </div>
      )}

      {accion === 'reprogramar' && (
        <div className="mt-8">
          {servicio ? (
            <>
              <p className="angosta max-w-[52ch] text-[0.95rem] leading-relaxed text-tinta-suave">
                Elegí el día y la hora nuevos. El turno mantiene el tratamiento, el precio y lo
                que hayas pagado.
              </p>
              <div className="mt-7">
                <SelectorFecha
                  servicio={servicio}
                  fecha={null}
                  hora={null}
                  recargar={0}
                  onElegir={(fecha, hora) =>
                    correr(() => reprogramarMiReserva(slug, token, reserva.id, fecha, hora))
                  }
                />
              </div>
            </>
          ) : (
            <Aviso tono="error">
              No encontramos este tratamiento en el catálogo: puede que lo hayan dado de baja.
              Para cambiar el turno, escribile al centro.
            </Aviso>
          )}
          <button
            type="button"
            onClick={() => {
              setAccion(null);
              setError(null);
            }}
            disabled={trabajando}
            className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45"
          >
            Dejar el turno como está
          </button>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ detalle */

/**
 * El estado se lee por la palabra primero y por el campo después, nunca solo por tinte.
 */
function Sello({ reserva }: { reserva: Reserva }) {
  const base =
    'angosta shrink-0 px-3.5 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em]';

  switch (reserva.estado) {
    case 'confirmada':
      return <span className={`${base} bg-verde text-tinta`}>Confirmado</span>;
    case 'pendiente':
      return <span className={`${base} border border-tinta/35 text-tinta`}>Esperando el pago</span>;
    case 'ausente':
      return <span className={`${base} border border-tinta bg-tinta text-papel`}>No viniste</span>;
    case 'cancelada':
      return (
        <span className={`${base} bg-tinta/[0.06] text-tinta-tenue line-through`}>
          {quienCancelo(reserva.canceladaPor)}
        </span>
      );
    default:
      return null;
  }
}

function quienCancelo(por: string | null): string {
  switch (por) {
    case 'clienta':
      return 'Lo cancelaste';
    case 'centro':
      return 'Lo canceló el centro';
    case 'sistema':
      return 'Venció sin pagarse';
    default:
      return 'Cancelado';
  }
}

/**
 * Perder lo pagado se avisa **antes** de cancelar, no después. Es la única consecuencia
 * irreversible de esta pantalla.
 */
function textoDeCancelacion(reserva: Reserva, pagado: number): string {
  if (pagado > 0 && !reserva.puedeCancelarConReembolso) {
    return `Estás fuera del plazo para cancelar con devolución: si cancelás ahora perdés los ${formatearPrecio(
      pagado,
    )} que pagaste. Si necesitás cambiar el día, probá reprogramar o escribile al centro.`;
  }
  if (pagado > 0) {
    return `Estás en plazo: te devolvemos los ${formatearPrecio(
      pagado,
    )} que pagaste. La devolución sale sola y puede tardar unos minutos en aparecer.`;
  }
  return 'El horario se libera para otra persona. Si después querés volver, hay que sacar un turno nuevo.';
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
