'use client';

import { useEffect, useState } from 'react';
import { ErrorApi } from '@/lib/cliente';
import { cerrarSesion, leerToken, sesionVencida } from '@/lib/sesion';

/**
 * El patrón que comparten las tres pantallas del panel: leer el token, cargar datos, y pasar
 * por los mismos cuatro estados. Si la sesión venció a mitad de camino, limpia el token y cae
 * a `anonimo` en vez de dejar un error que no se arregla reintentando.
 *
 * `cargar` recibe el token y trae lo que la pantalla necesite. `recargar()` fuerza otra vuelta;
 * `salir()` cierra la sesión a pedido.
 */
export type EstadoPanel<T> =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; token: string; datos: T };

/**
 * La sesión del panel: el rol y, para la administradora, el slug del centro. La plataforma es
 * global y no lleva slug.
 */
export type SesionPanel = { rol: 'admin'; slug: string } | { rol: 'plataforma' };

export function usePanel<T>(
  sesion: SesionPanel,
  cargar: (token: string) => Promise<T>,
  deps: readonly unknown[] = [],
): {
  estado: EstadoPanel<T>;
  recargar: () => void;
  salir: () => void;
} {
  const slug = sesion.rol === 'admin' ? sesion.slug : undefined;
  const [estado, setEstado] = useState<EstadoPanel<T>>({ tipo: 'cargando' });
  const [contador, setContador] = useState(0);

  useEffect(() => {
    let vigente = true;
    // No se fuerza `cargando` al recargar: se mantiene lo que ya hay en pantalla hasta que
    // llegan los datos nuevos, y así una recarga tras una acción no parpadea. El primer
    // render ya arranca en `cargando` por el estado inicial.

    (async () => {
      const token = leerToken(sesion.rol, slug);
      if (!token) {
        if (vigente) setEstado({ tipo: 'anonimo' });
        return;
      }
      try {
        const datos = await cargar(token);
        if (vigente) setEstado({ tipo: 'listo', token, datos });
      } catch (e) {
        if (!vigente) return;
        if (!(e instanceof ErrorApi)) throw e;
        if (sesionVencida(e.codigo)) {
          cerrarSesion(sesion.rol, slug);
          setEstado({ tipo: 'anonimo' });
          return;
        }
        setEstado({ tipo: 'error', mensaje: e.message });
      }
    })();

    return () => {
      vigente = false;
    };
    // `cargar` se recrea en cada render; las deps reales las declara quien llama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contador, slug, sesion.rol, ...deps]);

  return {
    estado,
    recargar: () => setContador((n) => n + 1),
    salir: () => {
      cerrarSesion(sesion.rol, slug);
      setEstado({ tipo: 'anonimo' });
    },
  };
}
