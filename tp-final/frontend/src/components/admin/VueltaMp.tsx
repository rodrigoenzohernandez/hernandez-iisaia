'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Aviso } from '@/components/Aviso';
import { BotonEnlace } from '@/components/Boton';
import { Flecha, Tilde } from '@/components/Iconos';
import { ErrorApi } from '@/lib/cliente';
import { conectarMercadoPago } from '@/lib/admin';
import { leerSlugMp, leerToken, sesionVencida } from '@/lib/sesion';

type Estado =
  | { tipo: 'conectando' }
  | { tipo: 'ok' }
  | { tipo: 'anonimo' }
  | { tipo: 'error'; mensaje: string };

/**
 * La vuelta de la autorización de Mercado Pago. Mercado Pago redirige acá con `code` y `state`
 * en la query; los mandamos tal como vinieron y el backend canjea la conexión.
 *
 * El `state` va cifrado y vence a los diez minutos: uno vencido, adulterado o de otro centro
 * da `invalid_state`, y ahí la salida es volver a empezar desde el botón.
 */
export function VueltaMp() {
  const params = useSearchParams();
  const [estado, setEstado] = useState<Estado>({ tipo: 'conectando' });
  const [slug, setSlug] = useState<string | null>(null);
  // En desarrollo el efecto corre dos veces; sin esto se canjea el code dos veces y el segundo falla.
  const yaCorrio = useRef(false);

  useEffect(() => {
    if (yaCorrio.current) return;
    yaCorrio.current = true;

    (async () => {
      const code = params.get('code');
      const state = params.get('state');

      // La administradora canceló en Mercado Pago, o la vuelta llegó sin lo que hace falta.
      if (!code || !state) {
        setEstado({ tipo: 'error', mensaje: 'No se completó la autorización en Mercado Pago. Volvé a intentarlo desde Cobros.' });
        return;
      }

      const elSlug = leerSlugMp();
      if (!elSlug) {
        setEstado({ tipo: 'error', mensaje: 'No sabemos a qué centro volver. Empezá la conexión de nuevo desde Cobros.' });
        return;
      }
      setSlug(elSlug);

      const token = leerToken('admin', elSlug);
      if (!token) {
        setEstado({ tipo: 'anonimo' });
        return;
      }

      try {
        await conectarMercadoPago(elSlug, token, code, state);
        setEstado({ tipo: 'ok' });
      } catch (e) {
        if (!(e instanceof ErrorApi)) throw e;
        if (sesionVencida(e.codigo)) {
          setEstado({ tipo: 'anonimo' });
          return;
        }
        // `invalid_state` incluido: el mensaje del backend ya dice que se volvió a empezar.
        setEstado({ tipo: 'error', mensaje: e.message });
      }
    })();
  }, [params]);

  if (estado.tipo === 'conectando') {
    return (
      <section className="max-w-[52ch]">
        <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          Conectando tu cuenta
        </h1>
        <p aria-live="polite" className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
          Estamos terminando la conexión con Mercado Pago. No cierres esta página.
        </p>
      </section>
    );
  }

  if (estado.tipo === 'ok') {
    return (
      <section className="max-w-[52ch]">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-verde text-tinta">
            <Tilde className="h-5 w-5" />
          </span>
          <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
            Cuenta conectada
          </h1>
        </div>
        <p className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
          Ya podés cobrar las señas online. Desde Cobros manejás el plan y la conexión.
        </p>
        <div className="mt-11">
          <BotonEnlace href={slug ? `/${slug}/admin/cobros` : '/'}>
            Ir a Cobros
            <Flecha className="h-4 w-4" />
          </BotonEnlace>
        </div>
      </section>
    );
  }

  if (estado.tipo === 'anonimo') {
    return (
      <section className="max-w-[52ch]">
        <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          Entrá de nuevo
        </h1>
        <p className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
          Tu sesión venció durante la conexión. Ingresá otra vez y volvé a conectar la cuenta
          desde Cobros.
        </p>
        <div className="mt-11">
          <BotonEnlace href={slug ? `/${slug}/admin/ingresar` : '/'}>
            Ingresar
            <Flecha className="h-4 w-4" />
          </BotonEnlace>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[52ch]">
      <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
        No pudimos conectarla
      </h1>
      <Aviso tono="error" className="mt-7">{estado.mensaje}</Aviso>
      <p className="mt-10">
        <Link href={slug ? `/${slug}/admin/cobros` : '/'} className="inline-flex items-center gap-2.5 text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-tinta underline decoration-verde decoration-2 underline-offset-[0.35em]">
          Volver a Cobros
          <Flecha className="h-4 w-4" />
        </Link>
      </p>
    </section>
  );
}
