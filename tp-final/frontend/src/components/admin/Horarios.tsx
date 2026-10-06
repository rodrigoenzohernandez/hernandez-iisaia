'use client';

import { listarPlanes, type Plan } from '@/lib/cliente';
import { obtenerSuscripcion, obtenerVentanas } from '@/lib/admin';
import { EncabezadoSeccion } from './EncabezadoSeccion';
import { PanelAnonimo, PanelCargando, PanelError } from './EstadosPanel';
import { EditorSemana, type Franja } from './EditorSemana';
import { usePanel } from './usePanel';
import { useSlug } from '@/hooks/useSlug';

type Datos = { franjas: Franja[]; plan: Plan };

let contadorKey = 0;
const nuevaKey = () => `f${contadorKey++}`;

export function Horarios() {
  const slug = useSlug();
  const { estado, recargar, salir } = usePanel<Datos>({ rol: 'admin', slug }, async (token) => {
    const [ventanas, planes, suscripcion] = await Promise.all([
      obtenerVentanas(slug, token),
      listarPlanes(),
      obtenerSuscripcion(slug, token),
    ]);
    const plan = planes.find((p) => p.id === suscripcion.plan) ?? planes[0];
    return {
      franjas: ventanas.data.map((v) => ({ ...v, key: nuevaKey() })),
      plan,
    };
  });

  if (estado.tipo === 'anonimo') return <PanelAnonimo />;

  return (
    <section>
      <EncabezadoSeccion titulo="Horarios" onSalir={salir} />

      <p className="angosta mt-7 max-w-[60ch] text-[1.02rem] leading-relaxed text-tinta-suave">
        Estas son las franjas en las que el centro toma turnos. Cada franja define un tramo del
        día, cada cuántos minutos arranca un turno y cuántas clientas podés atender a la vez. Un
        día sin franjas queda cerrado.
      </p>

      <div className="mt-12">
        {estado.tipo === 'cargando' && <PanelCargando texto="Trayendo tus horarios…" />}
        {estado.tipo === 'error' && <PanelError mensaje={estado.mensaje} onReintentar={recargar} />}

        {estado.tipo === 'listo' && (
          <EditorSemana
            token={estado.token}
            inicial={estado.datos.franjas}
            plan={estado.datos.plan}
            nuevaKey={nuevaKey}
          />
        )}
      </div>
    </section>
  );
}
