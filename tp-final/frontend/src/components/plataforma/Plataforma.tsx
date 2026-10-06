'use client';

import { useState } from 'react';
import { EncabezadoSeccion } from '@/components/admin/EncabezadoSeccion';
import { PanelCargando, PanelError } from '@/components/admin/EstadosPanel';
import { usePanel } from '@/components/admin/usePanel';
import { BotonEnlace } from '@/components/Boton';
import { Flecha } from '@/components/Iconos';
import {
  listarCentros,
  obtenerResumen,
  type Centro,
  type Resumen,
} from '@/lib/plataforma';
import { formatearPrecio } from '@/lib/formato';
import { FilaCentro } from './FilaCentro';

type Datos = { resumen: Resumen; centros: Centro[] };

const FILTROS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'activos', texto: 'Activos' },
  { valor: 'inactivos', texto: 'De baja' },
] as const;

function formatearMes(mes: string): string {
  const d = new Date(`${mes}-01T00:00:00`);
  const txt = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function Plataforma() {
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'inactivos'>('todos');

  const { estado, recargar, salir } = usePanel<Datos>(
    { rol: 'plataforma' },
    async (token) => {
      const activo = filtro === 'todos' ? undefined : filtro === 'activos';
      const [resumen, pagina] = await Promise.all([
        obtenerResumen(token),
        listarCentros(token, { activo }),
      ]);
      return { resumen, centros: pagina.data };
    },
    [filtro],
  );

  if (estado.tipo === 'anonimo') {
    return (
      <section className="max-w-[50ch]">
        <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          Entrá a la plataforma
        </h1>
        <p className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
          Tu sesión no está activa o venció. Ingresá de nuevo.
        </p>
        <div className="mt-11">
          <BotonEnlace href="/plataforma/ingresar">
            Ingresar
            <Flecha className="h-4 w-4" />
          </BotonEnlace>
        </div>
      </section>
    );
  }

  return (
    <section>
      <EncabezadoSeccion titulo="Plataforma" onSalir={salir} />

      {/* ---- resumen del mes: tira de datos, no tarjetas métricas ---- */}
      {estado.tipo === 'listo' && <ResumenTira resumen={estado.datos.resumen} />}

      {/* ---- filtro ---- */}
      <div className="mt-10">
        <span className="angosta block text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-tinta-suave">
          Centros
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const activo = filtro === f.valor;
            return (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                aria-pressed={activo}
                className={`angosta px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  activo ? 'bg-tinta text-papel' : 'border border-tinta/20 text-tinta-suave hover:border-tinta/45'
                }`}
              >
                {f.texto}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- tabla de centros ---- */}
      <div className="mt-10">
        {estado.tipo === 'cargando' && <PanelCargando texto="Trayendo los centros…" />}
        {estado.tipo === 'error' && <PanelError mensaje={estado.mensaje} onReintentar={recargar} />}
        {estado.tipo === 'listo' &&
          (estado.datos.centros.length === 0 ? (
            <p className="angosta text-[1.02rem] leading-relaxed text-tinta-suave">
              No hay centros con este filtro.
            </p>
          ) : (
            <ul className="border-t border-tinta/15">
              {estado.datos.centros.map((centro) => (
                <FilaCentro key={centro.slug} centro={centro} token={estado.token} onCambio={recargar} />
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}

function ResumenTira({ resumen }: { resumen: Resumen }) {
  const datos = [
    { valor: `${resumen.centros}`, texto: `centros · ${resumen.centrosActivos} activos · ${resumen.centrosNuevos} nuevos` },
    { valor: `${resumen.porPlan.basico} · ${resumen.porPlan.profesional}`, texto: 'básico · profesional' },
    { valor: `${resumen.turnosDelMes}`, texto: 'turnos del mes' },
    { valor: formatearPrecio(resumen.cobradoDelMesCentavos), texto: 'cobrado online' },
    { valor: formatearPrecio(resumen.ingresoMensualCentavos), texto: 'ingreso esperado / mes' },
  ];
  return (
    <div className="mt-8 border-y border-tinta/15 py-6">
      <p className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-verde-hondo">
        {formatearMes(resumen.mes)}
      </p>
      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
        {datos.map((d) => (
          <div key={d.texto} className="flex items-baseline gap-2.5">
            <dd className="cifra ancha text-[1.1rem] font-bold leading-none">{d.valor}</dd>
            <dt className="angosta text-[0.8rem] text-tinta-tenue">{d.texto}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
