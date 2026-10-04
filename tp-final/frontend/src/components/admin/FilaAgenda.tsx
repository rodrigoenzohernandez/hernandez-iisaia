'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { SelectorFecha } from '@/components/reserva/SelectorFecha';
import { ErrorApi, type Reserva, type Servicio } from '@/lib/cliente';
import {
  cancelarReserva,
  confirmarReserva,
  marcarAusente,
  reprogramarReserva,
} from '@/lib/admin';
import { formatearFechaLarga, formatearPrecio } from '@/lib/formato';

type Accion = null | 'cancelar' | 'reprogramar';

export function FilaAgenda({
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
  const [accion, setAccion] = useState<Accion>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendiente = reserva.estado === 'pendiente';
  const confirmada = reserva.estado === 'confirmada';
  const abierta = pendiente || confirmada;
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
      // `too_early_for_no_show` incluido: marcar ausente antes de la hora del turno. El
      // mensaje del backend ya explica que todavía no es la hora.
      setError(e.message);
      setTrabajando(false);
    }
  }

  return (
    <li className="border-b border-tinta/15 py-8">
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <div className="min-w-0">
          <p className="cifra angosta text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-verde-hondo">
            {mayuscula(formatearFechaLarga(reserva.fecha))} · {reserva.horaInicio}–{reserva.horaFin}
          </p>
          <p className="ancha mt-2 text-[1.22rem] font-bold uppercase leading-tight tracking-[-0.015em]">
            {servicio?.nombre ?? 'Tratamiento'}
          </p>
          <p className="angosta mt-2 text-[0.95rem] text-tinta-suave">
            {reserva.clienteNombre}
          </p>
          <p className="cifra angosta mt-1 text-[0.88rem] text-tinta-tenue">
            {reserva.clienteTelefono} · {reserva.clienteEmail}
          </p>
          <p className="cifra angosta mt-1.5 text-[0.88rem] text-tinta-tenue">
            {reserva.metodoPago === 'mercadopago' ? 'Mercado Pago' : 'Efectivo'} ·{' '}
            {formatearPrecio(reserva.precioCentavos)}
            {pagado > 0 && <> · pagó {formatearPrecio(pagado)}</>}
          </p>
          {reserva.notas && (
            <p className="angosta mt-3 max-w-[52ch] text-[0.9rem] leading-relaxed text-tinta-suave">
              “{reserva.notas}”
            </p>
          )}
        </div>
        <Sello reserva={reserva} />
      </div>

      {error && (
        <Aviso tono="error" className="mt-6">
          {error}
        </Aviso>
      )}

      {/* ---- acciones por turno ---- */}
      {abierta && accion === null && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {pendiente && (
            <Boton
              onClick={() => correr(() => confirmarReserva(token, reserva.id))}
              disabled={trabajando}
              className="py-2.5 text-[0.72rem]"
            >
              Confirmar
            </Boton>
          )}
          <Boton tono="borde" onClick={() => setAccion('reprogramar')} className="py-2.5 text-[0.72rem]">
            Reprogramar
          </Boton>
          {confirmada && (
            <Boton
              tono="borde"
              onClick={() => correr(() => marcarAusente(token, reserva.id))}
              disabled={trabajando}
              className="py-2.5 text-[0.72rem]"
            >
              Marcar ausente
            </Boton>
          )}
          <Boton tono="borde" onClick={() => setAccion('cancelar')} className="py-2.5 text-[0.72rem]">
            Cancelar
          </Boton>
        </div>
      )}

      {accion === 'cancelar' && (
        <div className="mt-6 max-w-[58ch]">
          {pagado > 0 ? (
            /* Con algo pagado, `reembolsar` es obligatorio: no se asume, se pregunta. Son dos
               caminos distintos, no un sí/no a una sola acción. */
            <>
              <Aviso>
                Esta clienta pagó {formatearPrecio(pagado)}. Al cancelar tenés que decidir qué
                pasa con ese dinero.
              </Aviso>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Boton
                  onClick={() => correr(() => cancelarReserva(token, reserva.id, true))}
                  disabled={trabajando}
                  className="py-2.5 text-[0.72rem]"
                >
                  Devolver {formatearPrecio(pagado)} y cancelar
                </Boton>
                <Boton
                  tono="borde"
                  onClick={() => correr(() => cancelarReserva(token, reserva.id, false))}
                  disabled={trabajando}
                  className="py-2.5 text-[0.72rem]"
                >
                  Cancelar sin devolver
                </Boton>
                <BotonVolver onClick={() => setAccion(null)} disabled={trabajando} />
              </div>
            </>
          ) : (
            <>
              <Aviso>
                El horario queda libre para otra clienta. Este turno no tiene pagos, así que no
                hay nada que devolver.
              </Aviso>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Boton
                  onClick={() => correr(() => cancelarReserva(token, reserva.id, false))}
                  disabled={trabajando}
                  className="py-2.5 text-[0.72rem]"
                >
                  {trabajando ? 'Cancelando…' : 'Cancelar el turno'}
                </Boton>
                <BotonVolver onClick={() => setAccion(null)} disabled={trabajando} />
              </div>
            </>
          )}
        </div>
      )}

      {accion === 'reprogramar' && (
        <div className="mt-8">
          {servicio ? (
            <>
              <p className="angosta max-w-[52ch] text-[0.95rem] leading-relaxed text-tinta-suave">
                Elegí el día y la hora nuevos. Desde el panel podés mover el turno a cualquier
                horario libre, sin el plazo que tiene la clienta.
              </p>
              <div className="mt-7">
                <SelectorFecha
                  servicio={servicio}
                  fecha={null}
                  hora={null}
                  recargar={0}
                  onElegir={(fecha, hora) =>
                    correr(() => reprogramarReserva(token, reserva.id, fecha, hora))
                  }
                />
              </div>
            </>
          ) : (
            <Aviso tono="error">
              No encontramos este tratamiento en el catálogo: puede estar dado de baja. Para
              moverlo, primero reactivá el tratamiento.
            </Aviso>
          )}
          <div className="mt-8">
            <BotonVolver onClick={() => setAccion(null)} disabled={trabajando} texto="Dejar el turno como está" />
          </div>
        </div>
      )}
    </li>
  );
}

function BotonVolver({
  onClick,
  disabled,
  texto = 'No, volver',
}: {
  onClick: () => void;
  disabled: boolean;
  texto?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45"
    >
      {texto}
    </button>
  );
}

function Sello({ reserva }: { reserva: Reserva }) {
  const base =
    'angosta shrink-0 px-3.5 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em]';

  switch (reserva.estado) {
    case 'confirmada':
      return <span className={`${base} bg-verde text-tinta`}>Confirmado</span>;
    case 'pendiente':
      return <span className={`${base} border border-tinta/35 text-tinta`}>Esperando pago</span>;
    case 'ausente':
      return <span className={`${base} border border-tinta bg-tinta text-papel`}>Ausente</span>;
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
      return 'Canceló la clienta';
    case 'centro':
      return 'Cancelado';
    case 'sistema':
      return 'Venció sin pagar';
    default:
      return 'Cancelado';
  }
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
