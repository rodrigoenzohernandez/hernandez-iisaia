'use client';

import { listarPlanes, type Plan } from '@/lib/cliente';
import {
  obtenerCuentaMercadoPago,
  obtenerSuscripcion,
  type CuentaMercadoPago,
  type Suscripcion as SuscripcionDto,
} from '@/lib/admin';
import { ConexionMp } from './ConexionMp';
import { EncabezadoSeccion } from './EncabezadoSeccion';
import { PanelAnonimo, PanelCargando, PanelError } from './EstadosPanel';
import { Suscripcion } from './Suscripcion';
import { usePanel } from './usePanel';
import { useSlug } from '@/hooks/useSlug';

type Datos = {
  cuenta: CuentaMercadoPago;
  suscripcion: SuscripcionDto;
  planes: Plan[];
};

export function Cobros() {
  const slug = useSlug();
  const { estado, recargar, salir } = usePanel<Datos>({ rol: 'admin', slug }, async (token) => {
    const [cuenta, suscripcion, planes] = await Promise.all([
      obtenerCuentaMercadoPago(slug, token),
      obtenerSuscripcion(slug, token),
      listarPlanes(),
    ]);
    return { cuenta, suscripcion, planes };
  });

  if (estado.tipo === 'anonimo') return <PanelAnonimo />;

  return (
    <section>
      <EncabezadoSeccion titulo="Cobros" onSalir={salir} />

      <div className="mt-12">
        {estado.tipo === 'cargando' && <PanelCargando texto="Trayendo tus cobros…" />}
        {estado.tipo === 'error' && <PanelError mensaje={estado.mensaje} onReintentar={recargar} />}

        {estado.tipo === 'listo' && (
          <div className="space-y-12">
            <ConexionMp cuenta={estado.datos.cuenta} token={estado.token} onCambio={recargar} />
            <Suscripcion
              suscripcion={estado.datos.suscripcion}
              planes={estado.datos.planes}
              token={estado.token}
              onCambio={recargar}
            />
          </div>
        )}
      </div>
    </section>
  );
}
