'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { ErrorApi, listarServicios, type Servicio } from '@/lib/cliente';
import { actualizarServicio } from '@/lib/admin';
import { formatearDuracion, formatearPrecio } from '@/lib/formato';
import { EncabezadoSeccion } from './EncabezadoSeccion';
import { PanelAnonimo, PanelCargando, PanelError } from './EstadosPanel';
import { FormularioServicio } from './FormularioServicio';
import { usePanel } from './usePanel';
import { useSlug } from '@/hooks/useSlug';

type Edicion = null | { servicio: Servicio | null };

export function Tratamientos() {
  // Con token de administradora, el listado trae también los dados de baja.
  const slug = useSlug();
  const { estado, recargar, salir } = usePanel<Servicio[]>({ rol: 'admin', slug }, (token) =>
    listarServicios(slug, token),
  );
  const [edicion, setEdicion] = useState<Edicion>(null);

  if (estado.tipo === 'anonimo') return <PanelAnonimo />;

  // En alta o edición, el formulario ocupa la pantalla: una cosa a la vez.
  if (estado.tipo === 'listo' && edicion) {
    return (
      <section>
        <FormularioServicio
          token={estado.token}
          servicio={edicion.servicio}
          onListo={() => {
            setEdicion(null);
            recargar();
          }}
          onCancelar={() => setEdicion(null)}
        />
      </section>
    );
  }

  return (
    <section>
      <EncabezadoSeccion
        titulo="Tratamientos"
        onSalir={salir}
        acciones={
          estado.tipo === 'listo' && (
            <Boton onClick={() => setEdicion({ servicio: null })} className="py-2.5 text-[0.72rem]">
              Nuevo tratamiento
            </Boton>
          )
        }
      />

      <div className="mt-12">
        {estado.tipo === 'cargando' && <PanelCargando texto="Trayendo los tratamientos…" />}
        {estado.tipo === 'error' && <PanelError mensaje={estado.mensaje} onReintentar={recargar} />}

        {estado.tipo === 'listo' &&
          (estado.datos.length === 0 ? (
            <p className="angosta text-[1.02rem] leading-relaxed text-tinta-suave">
              Todavía no cargaste tratamientos. Empezá con el primero.
            </p>
          ) : (
            <ul className="border-t border-tinta/15">
              {estado.datos.map((servicio) => (
                <FilaServicio
                  key={servicio.id}
                  servicio={servicio}
                  token={estado.token}
                  onEditar={() => setEdicion({ servicio })}
                  onCambio={recargar}
                />
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}

function FilaServicio({
  servicio,
  token,
  onEditar,
  onCambio,
}: {
  servicio: Servicio;
  token: string;
  onEditar: () => void;
  onCambio: () => void;
}) {
  const slug = useSlug();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alternarActivo() {
    setTrabajando(true);
    setError(null);
    try {
      await actualizarServicio(slug, token, servicio.id, { activo: !servicio.activo });
      onCambio();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      setError(e.message);
      setTrabajando(false);
    }
  }

  return (
    <li className={`border-b border-tinta/15 py-8 ${servicio.activo ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="ancha text-[1.22rem] font-bold uppercase leading-tight tracking-[-0.015em]">
              {servicio.nombre}
            </p>
            {!servicio.activo && (
              <span className="angosta bg-tinta/[0.06] px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-tinta-tenue">
                Dado de baja
              </span>
            )}
            {servicio.requiereValoracion && (
              <span className="angosta border border-verde-hondo/40 px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-verde-hondo">
                Con valoración
              </span>
            )}
          </div>

          <p className="cifra angosta mt-2.5 text-[0.92rem] text-tinta-suave">
            {formatearDuracion(servicio.duracionMinutos)} · {formatearPrecio(servicio.precioCentavos)} · seña{' '}
            {formatearPrecio(servicio.senaCentavos)}
          </p>
          <p className="angosta mt-1.5 text-[0.85rem] text-tinta-tenue">
            {servicio.reprogramacionHorasAntes === null
              ? 'La clienta no reprograma sola'
              : `Reprograma hasta ${servicio.reprogramacionHorasAntes} h antes`}
            {' · '}
            {servicio.cancelacionHorasAntes === 0
              ? 'sin devolución al cancelar'
              : `devuelve hasta ${servicio.cancelacionHorasAntes} h antes`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-4">
          <Boton tono="borde" onClick={onEditar} className="py-2.5 text-[0.72rem]">
            Editar
          </Boton>
          <Boton tono="borde" onClick={alternarActivo} disabled={trabajando} className="py-2.5 text-[0.72rem]">
            {servicio.activo ? 'Dar de baja' : 'Reactivar'}
          </Boton>
        </div>
      </div>

      {error && <Aviso tono="error" className="mt-6">{error}</Aviso>}
    </li>
  );
}
