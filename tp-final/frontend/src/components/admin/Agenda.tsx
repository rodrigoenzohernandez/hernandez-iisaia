'use client';

import { useState } from 'react';
import { listarServicios, type Reserva, type Servicio } from '@/lib/cliente';
import { listarReservas, type FiltrosReservas } from '@/lib/admin';
import { hoyEnCentro } from '@/lib/formato';
import { EncabezadoSeccion } from './EncabezadoSeccion';
import { PanelAnonimo, PanelCargando, PanelError } from './EstadosPanel';
import { FilaAgenda } from './FilaAgenda';
import { usePanel } from './usePanel';

const ESTADOS = [
  { valor: '', texto: 'Todos' },
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'confirmada', texto: 'Confirmados' },
  { valor: 'cancelada', texto: 'Cancelados' },
  { valor: 'ausente', texto: 'Ausentes' },
] as const;

type Datos = { reservas: Reserva[]; servicios: Map<string, Servicio> };

export function Agenda() {
  // El default es "de hoy en adelante": lo que la administradora necesita ver al abrir.
  const [desde, setDesde] = useState(() => hoyEnCentro());
  const [filtroEstado, setFiltroEstado] = useState('');

  const { estado, recargar, salir } = usePanel<Datos>(
    async (token) => {
      const filtros: FiltrosReservas = {};
      if (desde) filtros.desde = desde;
      if (filtroEstado) filtros.estado = filtroEstado;
      const [pagina, servicios] = await Promise.all([
        listarReservas(token, filtros),
        listarServicios(token),
      ]);
      return {
        reservas: pagina.data,
        servicios: new Map(servicios.map((s) => [s.id, s])),
      };
    },
    [desde, filtroEstado],
  );

  if (estado.tipo === 'anonimo') return <PanelAnonimo />;

  return (
    <section>
      <EncabezadoSeccion titulo="Agenda" onSalir={salir} />

      {/* ---- filtros ---- */}
      <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-5">
        <div>
          <label htmlFor="desde" className="angosta block text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-tinta-suave">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="cifra mt-2 border border-tinta/20 bg-papel px-3 py-2 text-[0.95rem] text-tinta focus:border-verde-hondo focus:outline-none"
          />
        </div>
        <div>
          <span className="angosta block text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-tinta-suave">
            Estado
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ESTADOS.map((e) => {
              const activo = filtroEstado === e.valor;
              return (
                <button
                  key={e.valor}
                  type="button"
                  onClick={() => setFiltroEstado(e.valor)}
                  aria-pressed={activo}
                  className={`angosta px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors ${
                    activo
                      ? 'bg-tinta text-papel'
                      : 'border border-tinta/20 text-tinta-suave hover:border-tinta/45'
                  }`}
                >
                  {e.texto}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- lista ---- */}
      <div className="mt-12">
        {estado.tipo === 'cargando' && <PanelCargando texto="Trayendo la agenda…" />}

        {estado.tipo === 'error' && (
          <PanelError mensaje={estado.mensaje} onReintentar={recargar} />
        )}

        {estado.tipo === 'listo' &&
          (estado.datos.reservas.length === 0 ? (
            <p className="angosta text-[1.02rem] leading-relaxed text-tinta-suave">
              No hay turnos con este filtro.
            </p>
          ) : (
            <ul className="border-t border-tinta/15">
              {estado.datos.reservas.map((reserva) => (
                <FilaAgenda
                  key={reserva.id}
                  reserva={reserva}
                  servicio={estado.datos.servicios.get(reserva.servicioId) ?? null}
                  token={estado.token}
                  onCambio={recargar}
                />
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
