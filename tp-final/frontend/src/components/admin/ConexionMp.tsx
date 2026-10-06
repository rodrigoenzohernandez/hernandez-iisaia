'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { Tilde } from '@/components/Iconos';
import { ErrorApi } from '@/lib/cliente';
import {
  desconectarMercadoPago,
  urlAutorizacionMercadoPago,
  type CuentaMercadoPago,
} from '@/lib/admin';
import { recordarSlugMp } from '@/lib/sesion';
import { useSlug } from '@/hooks/useSlug';
import { formatearFechaLarga } from '@/lib/formato';

/**
 * La conexión del centro con su cuenta de Mercado Pago. Sin esto, el centro no cobra online:
 * las señas y los reembolsos viven de esta cuenta.
 *
 * Tres estados: sin conectar, conectada, y `requiereReconexion` —Mercado Pago revocó el
 * acceso y hasta reconectar el centro dejó de cobrar—. El último se ve como el primero pero
 * con una advertencia, porque la acción es la misma: volver a autorizar.
 */
export function ConexionMp({
  cuenta,
  token,
  onCambio,
}: {
  cuenta: CuentaMercadoPago;
  token: string;
  onCambio: () => void;
}) {
  const slug = useSlug();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  async function conectar() {
    setTrabajando(true);
    setError(null);
    try {
      const { url } = await urlAutorizacionMercadoPago(slug, token);
      // El slug se guarda ANTES de irnos: la vuelta cae en una URL fija y así sabe a dónde volver.
      recordarSlugMp(slug);
      window.location.href = url;
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `mercadopago_not_configured` (503): es un error de la plataforma, no del centro.
      setError(e.message);
      setTrabajando(false);
    }
  }

  async function desconectar() {
    setTrabajando(true);
    setError(null);
    try {
      await desconectarMercadoPago(slug, token);
      setConfirmandoBaja(false);
      onCambio();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `mp_account_change_blocked` (409): hay pagos por reembolsar o la suscripción sigue.
      setError(e.message);
      setTrabajando(false);
    }
  }

  return (
    <section>
      <h2 className="ancha text-[clamp(1.2rem,2vw,1.6rem)] font-bold uppercase leading-tight tracking-[-0.02em]">
        Cobro online
      </h2>

      {error && <Aviso tono="error" className="mt-6">{error}</Aviso>}

      {cuenta.conectada && !cuenta.requiereReconexion ? (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-verde text-tinta">
              <Tilde className="h-4 w-4" />
            </span>
            <p className="angosta text-[1rem] text-tinta">
              Conectado con Mercado Pago
              {cuenta.liveMode === false && (
                <span className="cifra ml-2 text-[0.8rem] text-tinta-tenue">(cuenta de prueba)</span>
              )}
            </p>
          </div>
          {cuenta.conectadaAt && (
            <p className="cifra angosta mt-2 pl-12 text-[0.85rem] text-tinta-tenue">
              Desde el {formatearFechaLarga(cuenta.conectadaAt.slice(0, 10))}
            </p>
          )}

          {confirmandoBaja ? (
            <div className="mt-7 max-w-[54ch]">
              <Aviso>
                Al desconectar, el centro deja de cobrar online: los nuevos turnos pasan a
                efectivo. No se puede si quedan pagos por reembolsar o la suscripción sigue activa.
              </Aviso>
              <div className="mt-6 flex flex-wrap items-center gap-5">
                <Boton tono="borde" onClick={desconectar} disabled={trabajando} className="py-2.5 text-[0.72rem]">
                  {trabajando ? 'Desconectando…' : 'Sí, desconectar'}
                </Boton>
                <button type="button" onClick={() => setConfirmandoBaja(false)} disabled={trabajando} className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45">
                  No, dejarlo conectado
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-7">
              <Boton tono="borde" onClick={() => setConfirmandoBaja(true)} className="py-2.5 text-[0.72rem]">
                Desconectar
              </Boton>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 max-w-[58ch]">
          {cuenta.requiereReconexion && (
            <Aviso tono="error" className="mb-6">
              Mercado Pago revocó el acceso: el centro dejó de cobrar online. Reconectá la cuenta
              para volver a tomar señas.
            </Aviso>
          )}
          <p className="angosta text-[1.02rem] leading-relaxed text-tinta-suave">
            Conectá la cuenta de Mercado Pago del centro para cobrar las señas al reservar y
            manejar las devoluciones. Es parte del plan Profesional.
          </p>
          <div className="mt-7">
            <Boton onClick={conectar} disabled={trabajando}>
              {trabajando
                ? 'Abriendo Mercado Pago…'
                : cuenta.requiereReconexion
                  ? 'Reconectar con Mercado Pago'
                  : 'Conectar con Mercado Pago'}
            </Boton>
          </div>
        </div>
      )}
    </section>
  );
}
