'use client';

import { useEffect, useState } from 'react';
import { ErrorApi, obtenerDisponibilidad, type Servicio, type Slot } from '@/lib/cliente';
import {
  diaDeLaSemana,
  diaDelMes,
  formatearFechaLarga,
  formatearMes,
  hoyEnCentro,
  mismoMes,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
} from '@/lib/formato';
import { FlechaIzquierda, Flecha } from '@/components/Iconos';

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
// El backend rechaza con `too_far_ahead` más allá de noventa días, así que el calendario
// no ofrece lo que la API va a negar.
const DIAS_MAXIMOS = 90;

function grillaDelMes(mes: string): (string | null)[] {
  const primero = primerDiaDelMes(mes);
  const desplazamiento = (diaDeLaSemana(primero) + 6) % 7; // la semana arranca el lunes
  const celdas: (string | null)[] = Array.from({ length: desplazamiento }, () => null);
  let cursor = primero;
  while (mismoMes(cursor, primero)) {
    celdas.push(cursor);
    cursor = sumarDias(cursor, 1);
  }
  return celdas;
}

type Props = {
  servicio: Servicio;
  fecha: string | null;
  hora: string | null;
  onElegir: (fecha: string, hora: string) => void;
  recargar: number;
};

export function SelectorFecha({ servicio, fecha, hora, onElegir, recargar }: Props) {
  const hoy = hoyEnCentro();
  const ultimo = sumarDias(hoy, DIAS_MAXIMOS);

  const [mes, setMes] = useState(() => primerDiaDelMes(fecha ?? hoy));
  const [dia, setDia] = useState<string | null>(fecha);
  const [respuesta, setRespuesta] = useState<{
    clave: string;
    slots: Slot[];
    error: string | null;
  } | null>(null);

  // La clave identifica el pedido en curso. Compararla contra la respuesta deja "cargando"
  // como valor derivado, así el efecto solo escribe estado desde sus callbacks y no fuerza
  // un render extra al montarse.
  const clave = dia ? `${servicio.id}|${dia}|${recargar}` : null;

  useEffect(() => {
    if (!dia || !clave) return;
    let vigente = true;
    obtenerDisponibilidad(servicio.id, dia)
      .then((disponibilidad) => {
        if (vigente) setRespuesta({ clave, slots: disponibilidad.data, error: null });
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setRespuesta({
          clave,
          slots: [],
          error: e instanceof ErrorApi ? e.message : 'No pudimos traer los horarios de ese día.',
        });
      });
    return () => {
      vigente = false;
    };
  }, [servicio.id, dia, clave]);

  const listo = respuesta?.clave === clave;
  const cargando = clave !== null && !listo;
  const slots = listo ? respuesta.slots : null;
  const error = listo ? respuesta.error : null;

  const mesAnterior = sumarMeses(mes, -1);
  const mesSiguiente = sumarMeses(mes, 1);
  const puedeRetroceder = !mismoMes(mes, hoy);
  const puedeAvanzar = mesSiguiente <= ultimo;

  const libres = slots?.filter((s) => s.cuposDisponibles > 0).length ?? 0;

  return (
    <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[auto_1fr]">
      <div>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setMes(mesAnterior)}
            disabled={!puedeRetroceder}
            className="flex h-9 w-9 items-center justify-center border border-tinta/20 text-tinta transition-colors hover:border-tinta hover:bg-tinta hover:text-papel disabled:pointer-events-none disabled:opacity-25"
            aria-label="Mes anterior"
          >
            <FlechaIzquierda className="h-4 w-4" />
          </button>
          <p aria-live="polite" className="ancha text-[0.82rem] font-bold uppercase tracking-[0.14em]">
            {formatearMes(mes)}
          </p>
          <button
            type="button"
            onClick={() => setMes(mesSiguiente)}
            disabled={!puedeAvanzar}
            className="flex h-9 w-9 items-center justify-center border border-tinta/20 text-tinta transition-colors hover:border-tinta hover:bg-tinta hover:text-papel disabled:pointer-events-none disabled:opacity-25"
            aria-label="Mes siguiente"
          >
            <Flecha className="h-4 w-4" />
          </button>
        </div>

        {/* Sin role="grid": declararlo a medias, con spans y buttons sueltos en vez de filas
            y celdas, se lee peor con un lector de pantalla que no declararlo. El aria-label
            por día y el aria-pressed ya cargan el significado. */}
        <div className="mt-7 grid w-full max-w-[22rem] grid-cols-7 gap-1">
          {LETRAS.map((letra, i) => (
            <span
              key={i}
              aria-hidden
              className="angosta pb-2 text-center text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-tinta-tenue"
            >
              {letra}
            </span>
          ))}
          {grillaDelMes(mes).map((celda, i) => {
            if (!celda) return <span key={`hueco-${i}`} />;
            const fueraDeRango = celda < hoy || celda > ultimo;
            const elegido = celda === dia;
            return (
              <button
                key={celda}
                type="button"
                disabled={fueraDeRango}
                onClick={() => setDia(celda)}
                aria-pressed={elegido}
                aria-label={formatearFechaLarga(celda)}
                className={[
                  'cifra flex h-11 w-full items-center justify-center text-[0.88rem] transition-colors duration-150',
                  fueraDeRango
                    ? 'cursor-not-allowed text-tinta/20'
                    : elegido
                      ? 'bg-tinta font-bold text-papel'
                      : 'text-tinta hover:bg-verde-humo',
                ].join(' ')}
              >
                {diaDelMes(celda)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {!dia ? (
          <p className="angosta max-w-[38ch] text-[1rem] leading-relaxed text-tinta-suave">
            Elegí un día en el calendario y te mostramos los horarios de{' '}
            <span className="font-semibold text-tinta">{servicio.nombre}</span> para esa fecha.
          </p>
        ) : (
          <>
            <p className="ancha text-[0.78rem] font-bold uppercase tracking-[0.14em]">
              {formatearFechaLarga(dia)}
            </p>

            <p aria-live="polite" className="angosta mt-2 text-[0.84rem] text-tinta-tenue">
              {cargando
                ? 'Consultando la agenda…'
                : error
                  ? error
                  : slots && slots.length === 0
                    ? 'Ese día el centro no atiende.'
                    : `${libres} de ${slots?.length ?? 0} horarios libres`}
            </p>

            {slots && slots.length > 0 && (
              <ul className="mt-7 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:max-w-[30rem]">
                {slots.map((slot) => {
                  const lleno = slot.cuposDisponibles === 0;
                  const elegido = dia === fecha && slot.hora === hora;
                  return (
                    <li key={slot.hora}>
                      <button
                        type="button"
                        disabled={lleno}
                        onClick={() => onElegir(dia, slot.hora)}
                        aria-pressed={elegido}
                        className={[
                          'cifra relative w-full overflow-hidden border py-3 text-[0.92rem] transition-colors duration-150',
                          lleno
                            ? 'cursor-not-allowed border-tinta/12 bg-tinta/[0.04] text-tinta/35'
                            : elegido
                              ? 'border-verde-vivo bg-verde-vivo font-bold text-tinta'
                              : 'border-tinta/20 text-tinta hover:border-tinta hover:bg-verde-humo',
                        ].join(' ')}
                      >
                        {slot.hora}
                        {/* El estado es estructura, no tinte: el tachado sobrevive a cualquier
                            daltonismo y a una captura en blanco y negro. */}
                        {lleno && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),currentColor_calc(50%-0.5px),currentColor_calc(50%+0.5px),transparent_calc(50%+0.5px))] opacity-45"
                          />
                        )}
                        {lleno && <span className="sr-only"> — sin cupo</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {slots && slots.length > 0 && libres === 0 && (
              <p className="angosta mt-6 max-w-[40ch] text-[0.9rem] leading-relaxed text-tinta-suave">
                Ese día está completo. Los horarios quedan a la vista igual, para que sepas a qué
                hora atiende el centro.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
