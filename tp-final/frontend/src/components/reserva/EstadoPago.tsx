'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BotonEnlace } from '@/components/Boton';
import { Flecha, FlechaIzquierda, Reloj, Tilde } from '@/components/Iconos';
import { ErrorApi, estadoReserva, type EstadoReserva } from '@/lib/cliente';

// El aviso de Mercado Pago tarda unos segundos en llegarle al backend. Sondeamos hasta dos
// minutos: pasado eso, el problema no se resuelve mirando la pantalla.
const CADA_MS = 2500;
const TOPE_MS = 120_000;

type Estado = EstadoReserva | 'consultando' | 'error';

export function EstadoPago({ slug, reservaId }: { slug: string; reservaId: string }) {
  const [estado, setEstado] = useState<Estado>('consultando');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [seCanso, setSeCanso] = useState(false);

  useEffect(() => {
    let vigente = true;
    let temporizador: ReturnType<typeof setTimeout>;
    const arranque = Date.now();

    async function consultar() {
      try {
        const { estado: actual } = await estadoReserva(slug, reservaId);
        if (!vigente) return;
        setEstado(actual);
        if (actual !== 'pendiente') return;
        if (Date.now() - arranque > TOPE_MS) {
          setSeCanso(true);
          return;
        }
        temporizador = setTimeout(consultar, CADA_MS);
      } catch (e) {
        if (!vigente) return;
        setEstado('error');
        setMensaje(e instanceof ErrorApi ? e.message : 'No pudimos consultar tu turno.');
      }
    }

    consultar();
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [slug, reservaId]);

  const { titulo, texto } = leer(estado, seCanso, mensaje);
  const confirmada = estado === 'confirmada';

  return (
    <section className="max-w-[58ch]">
      <div className="flex items-center gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            confirmada ? 'bg-verde text-tinta' : 'border border-tinta/25 text-tinta'
          }`}
        >
          {confirmada ? <Tilde className="h-5 w-5" /> : <Reloj className="h-5 w-5" />}
        </span>
        <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
          {titulo}
        </h1>
      </div>

      {/* El sondeo cambia este texto solo: hay que anunciarlo. */}
      <p aria-live="polite" className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
        {texto}
      </p>

      <div className="mt-12 flex flex-wrap items-center gap-5">
        {(estado === 'cancelada' || estado === 'error') && (
          <BotonEnlace href={`/${slug}/reservar`}>
            Elegir otro horario
            <Flecha className="h-4 w-4" />
          </BotonEnlace>
        )}
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-2.5 text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-tinta underline decoration-verde decoration-2 underline-offset-[0.35em]"
        >
          <FlechaIzquierda className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}

function leer(estado: Estado, seCanso: boolean, mensaje: string | null) {
  if (estado === 'error') {
    return {
      titulo: 'No pudimos consultarlo',
      texto: mensaje ?? 'Probá de nuevo en un momento.',
    };
  }
  if (seCanso) {
    return {
      titulo: 'Está tardando más de lo normal',
      texto:
        'El aviso de Mercado Pago todavía no llegó. Si el pago salió, el turno se confirma solo y te avisamos por mail. Podés cerrar esta página.',
    };
  }
  switch (estado) {
    case 'confirmada':
      return {
        titulo: 'Turno confirmado',
        texto: 'Recibimos el pago y te mandamos la confirmación por mail. Te esperamos.',
      };
    case 'cancelada':
      return {
        titulo: 'El pago no se completó',
        texto:
          'El horario se liberó porque el pago no llegó a tiempo. Si llegaste a pagar, la devolución sale sola y te avisamos por mail.',
      };
    case 'ausente':
      return {
        titulo: 'Este turno figura como ausente',
        texto: 'Si creés que es un error, escribile al centro.',
      };
    default:
      return {
        titulo: 'Estamos confirmando tu pago',
        texto:
          'El aviso de Mercado Pago tarda unos segundos. No cierres esta página: se actualiza sola.',
      };
  }
}
