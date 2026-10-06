'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { ErrorApi } from '@/lib/cliente';
import { cambiarActivoCentro, type Centro } from '@/lib/plataforma';
import { formatearPrecio } from '@/lib/formato';

// El estado se codifica por estructura, con dos señales cada uno (nunca solo por tinte):
// conectada va en campo verde; a reconectar en campo tinta macizo; sin conectar queda con
// borde punteado (distinto del borde sólido de los chips de plan) y texto apagado.
const MP: Record<Centro['mercadoPago'], { texto: string; clase: string }> = {
  conectada: { texto: 'MP conectada', clase: 'bg-verde/15 text-verde-hondo' },
  requiere_reconexion: { texto: 'MP a reconectar', clase: 'border border-tinta bg-tinta text-papel' },
  sin_conectar: { texto: 'MP sin conectar', clase: 'border border-dashed border-tinta/45 text-tinta-tenue' },
};

export function FilaCentro({
  centro,
  token,
  onCambio,
}: {
  centro: Centro;
  token: string;
  onCambio: () => void;
}) {
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alternar(activo: boolean) {
    setTrabajando(true);
    setError(null);
    try {
      await cambiarActivoCentro(token, centro.slug, activo);
      setConfirmandoBaja(false);
      onCambio();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      setError(e.message);
      setTrabajando(false);
    }
  }

  const mp = MP[centro.mercadoPago];

  return (
    <li className={`border-b border-tinta/15 py-7 ${centro.activo ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="ancha text-[1.22rem] font-bold uppercase leading-tight tracking-[-0.015em]">
              {centro.nombre}
            </p>
            <span className="cifra bg-tinta/[0.06] px-2 py-0.5 text-[0.7rem] text-tinta-tenue">/{centro.slug}</span>
            {!centro.activo && (
              <span className="angosta bg-tinta/[0.06] px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-tinta-tenue">
                De baja
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.82rem] text-tinta-suave">
            <span className={`angosta px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] ${centro.plan === 'profesional' ? 'bg-verde text-tinta' : 'border border-tinta/35 text-tinta'}`}>
              {centro.plan === 'profesional' ? 'Profesional' : 'Básico'}
            </span>
            <span className={`angosta px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] ${mp.clase}`}>
              {mp.texto}
            </span>
          </div>

          <p className="cifra angosta mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.85rem] text-tinta-tenue">
            <span>{centro.servicios} tratamientos</span>
            <span>{centro.clientas} clientas</span>
            <span>{centro.turnosDelMes} turnos del mes</span>
            <span>{formatearPrecio(centro.cobradoDelMesCentavos)} cobrado</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          {centro.activo ? (
            confirmandoBaja ? (
              <div className="flex flex-wrap items-center justify-end gap-4">
                <Boton tono="borde" onClick={() => alternar(false)} disabled={trabajando} className="py-2.5 text-[0.72rem]">
                  {trabajando ? 'Dando de baja…' : 'Sí, dar de baja'}
                </Boton>
                <button type="button" onClick={() => setConfirmandoBaja(false)} disabled={trabajando} className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45">
                  No
                </button>
              </div>
            ) : (
              <Boton tono="borde" onClick={() => setConfirmandoBaja(true)} className="py-2.5 text-[0.72rem]">
                Dar de baja
              </Boton>
            )
          ) : (
            <Boton tono="borde" onClick={() => alternar(true)} disabled={trabajando} className="py-2.5 text-[0.72rem]">
              {trabajando ? 'Reactivando…' : 'Reactivar'}
            </Boton>
          )}
        </div>
      </div>

      {confirmandoBaja && !error && (
        <Aviso className="mt-5 max-w-[60ch]">
          Al dar de baja, todas las rutas del centro responden 404 y deja de tomar turnos. Los
          reembolsos pendientes igual siguen saliendo. Se puede reactivar después.
        </Aviso>
      )}
      {error && <Aviso tono="error" className="mt-5">{error}</Aviso>}
    </li>
  );
}
