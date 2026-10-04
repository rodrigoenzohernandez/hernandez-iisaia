'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { campo, etiqueta, nota } from '@/components/campos';
import { ErrorApi, type Plan } from '@/lib/cliente';
import { cambiarPlan, type Suscripcion as SuscripcionDto } from '@/lib/admin';
import { formatearFechaLarga, formatearPrecio } from '@/lib/formato';

/**
 * El plan del centro y el cambio de plan. El plan rige desde el primer cobro aprobado, no
 * desde el PUT: mientras la suscripción está `pending`, se muestra "procesando" y sigue el
 * plan viejo.
 */
export function Suscripcion({
  suscripcion,
  planes,
  token,
  onCambio,
}: {
  suscripcion: SuscripcionDto;
  planes: Plan[];
  token: string;
  onCambio: () => void;
}) {
  const [emailPagador, setEmailPagador] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esProfesional = suscripcion.plan === 'profesional';
  const mp = suscripcion.suscripcion;
  const procesando = mp?.estado === 'pending';

  async function subir(evento: React.FormEvent) {
    evento.preventDefault();
    setTrabajando(true);
    setError(null);
    try {
      const resp = await cambiarPlan(token, 'profesional', emailPagador.trim() || undefined);
      // El PUT devuelve la URL donde la administradora autoriza el cobro mensual.
      if (resp.suscripcion?.url) {
        window.location.href = resp.suscripcion.url;
        return;
      }
      onCambio();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `mercadopago_not_connected` (409): primero hay que conectar la cuenta, arriba.
      setError(e.message);
      setTrabajando(false);
    }
  }

  async function bajar() {
    setTrabajando(true);
    setError(null);
    try {
      await cambiarPlan(token, 'basico');
      setBajando(false);
      onCambio();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      setError(e.message);
      setTrabajando(false);
    }
  }

  return (
    <section className="border-t border-tinta/15 pt-12">
      <h2 className="ancha text-[clamp(1.2rem,2vw,1.6rem)] font-bold uppercase leading-tight tracking-[-0.02em]">
        Tu plan
      </h2>

      {/* estado actual */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className={`angosta px-3.5 py-2 text-[0.66rem] font-semibold uppercase tracking-[0.2em] ${esProfesional ? 'bg-verde text-tinta' : 'border border-tinta/35 text-tinta'}`}>
          Plan {esProfesional ? 'Profesional' : 'Básico'}
        </span>
        {suscripcion.pagoHasta && esProfesional && (
          <span className="cifra angosta text-[0.88rem] text-tinta-tenue">
            Pago hasta el {formatearFechaLarga(suscripcion.pagoHasta.slice(0, 10))}
          </span>
        )}
      </div>

      {procesando && (
        <Aviso className="mt-6">
          Tu suscripción al Profesional está procesándose. El plan se activa cuando Mercado Pago
          confirma el primer cobro.
          {mp?.url && (
            <>
              {' '}
              Si quedó pendiente de autorizar,{' '}
              <a href={mp.url} className="font-semibold underline decoration-verde decoration-2 underline-offset-2">
                terminá acá
              </a>
              .
            </>
          )}
        </Aviso>
      )}

      {error && <Aviso tono="error" className="mt-6">{error}</Aviso>}

      {/* comparación de planes */}
      <div className="mt-9 grid gap-6 sm:grid-cols-2">
        {planes.map((p) => (
          <TarjetaPlan key={p.id} plan={p} actual={p.id === suscripcion.plan} />
        ))}
      </div>

      {/* acciones */}
      <div className="mt-10">
        {!esProfesional &&
          (subiendo ? (
            <form onSubmit={subir} className="max-w-[46ch]">
              <label htmlFor="email-pagador" className={etiqueta}>Email de la cuenta de Mercado Pago que paga</label>
              <input
                id="email-pagador"
                type="email"
                className={campo}
                value={emailPagador}
                onChange={(e) => setEmailPagador(e.target.value)}
                autoFocus
                aria-describedby="pagador-nota"
              />
              <p id="pagador-nota" className={nota}>
                Si lo dejás vacío, usamos tu email. Si no coincide con la cuenta que paga, Mercado
                Pago rechaza el cobro.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <Boton type="submit" disabled={trabajando}>
                  {trabajando ? 'Abriendo Mercado Pago…' : 'Ir a autorizar el cobro'}
                </Boton>
                <button type="button" onClick={() => setSubiendo(false)} disabled={trabajando} className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <Boton onClick={() => setSubiendo(true)}>Subir al Profesional</Boton>
          ))}

        {esProfesional &&
          !procesando &&
          (bajando ? (
            <div className="max-w-[54ch]">
              <Aviso>
                Al bajar al Básico se cancela la suscripción. El Profesional sigue hasta la fecha
                ya paga, y después el centro deja de cobrar online y vuelve al tope de 60 turnos
                por mes.
              </Aviso>
              <div className="mt-6 flex flex-wrap items-center gap-5">
                <Boton tono="borde" onClick={bajar} disabled={trabajando} className="py-2.5 text-[0.72rem]">
                  {trabajando ? 'Cambiando…' : 'Sí, bajar al Básico'}
                </Boton>
                <button type="button" onClick={() => setBajando(false)} disabled={trabajando} className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45">
                  No, seguir en Profesional
                </button>
              </div>
            </div>
          ) : (
            <Boton tono="borde" onClick={() => setBajando(true)}>Bajar al Básico</Boton>
          ))}
      </div>
    </section>
  );
}

function TarjetaPlan({ plan, actual }: { plan: Plan; actual: boolean }) {
  return (
    <div className={`p-6 ${actual ? 'bg-tinta text-papel' : 'border border-tinta/15'}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="ancha text-[1.1rem] font-bold uppercase tracking-[-0.01em]">{plan.nombre}</h3>
        {actual && (
          <span className="angosta text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-verde">
            Tu plan
          </span>
        )}
      </div>
      <p className="cifra mt-3 text-[1.3rem] font-bold">
        {plan.precioCentavos === 0 ? 'Gratis' : <>{formatearPrecio(plan.precioCentavos)}<span className="angosta text-[0.8rem] font-normal opacity-70"> / mes</span></>}
      </p>
      <ul className={`angosta mt-5 space-y-2 text-[0.88rem] ${actual ? 'text-papel/80' : 'text-tinta-suave'}`}>
        <li>{plan.turnosPorMes === null ? 'Turnos sin tope' : `${plan.turnosPorMes} turnos por mes`}</li>
        <li>Hasta {plan.capacidadMaxima} {plan.capacidadMaxima === 1 ? 'turno' : 'turnos'} a la vez por franja</li>
        <li>{plan.recordatorios ? 'Recordatorio 24 h antes' : 'Sin recordatorios automáticos'}</li>
        <li>{plan.cobroOnline ? 'Cobro online, señas y reembolsos' : 'Sin cobro online'}</li>
      </ul>
    </div>
  );
}
