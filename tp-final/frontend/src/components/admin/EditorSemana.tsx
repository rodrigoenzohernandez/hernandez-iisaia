'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { ErrorApi, type Plan } from '@/lib/cliente';
import { reemplazarVentanas, type Ventana } from '@/lib/admin';

export type Franja = Ventana & { key: string };

const DIAS = [
  { n: 1, nombre: 'Lunes' },
  { n: 2, nombre: 'Martes' },
  { n: 3, nombre: 'Miércoles' },
  { n: 4, nombre: 'Jueves' },
  { n: 5, nombre: 'Viernes' },
  { n: 6, nombre: 'Sábado' },
  { n: 7, nombre: 'Domingo' },
] as const;

const INTERVALOS = [15, 30, 45, 60, 90] as const;

/**
 * Edita la semana entera y la guarda de una. El `PUT` reemplaza todo, así que acá no se
 * manda una franja: se arma la colección completa y se envía.
 *
 * La capacidad tope la pone el plan (`plan.capacidadMaxima`); el input no deja pasarse, y si
 * aun así el backend rechaza con `plan_limit_reached`, se muestra su mensaje.
 */
export function EditorSemana({
  token,
  inicial,
  plan,
  nuevaKey,
}: {
  token: string;
  inicial: Franja[];
  plan: Plan;
  nuevaKey: () => string;
}) {
  const [franjas, setFranjas] = useState<Franja[]>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const tope = plan.capacidadMaxima;

  function cambiar(key: string, campo: keyof Ventana, valor: string | number) {
    setFranjas((fs) => fs.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)));
    setOk(false);
  }

  function agregar(dia: number) {
    setFranjas((fs) => [
      ...fs,
      { key: nuevaKey(), diaSemana: dia, horaInicio: '09:00', horaFin: '13:00', intervaloMinutos: 30, capacidad: 1 },
    ]);
    setOk(false);
  }

  function quitar(key: string) {
    setFranjas((fs) => fs.filter((f) => f.key !== key));
    setOk(false);
  }

  // Chequeo liviano antes de viajar: una franja que termina antes de empezar no tiene arreglo
  // del lado del server que valga la pena esperar.
  const invalida = franjas.find((f) => f.horaFin <= f.horaInicio);

  async function guardar() {
    if (invalida) {
      setError('Hay una franja que termina antes o a la misma hora que empieza. Revisala.');
      return;
    }
    setGuardando(true);
    setError(null);
    setOk(false);
    // Campo por campo y no un spread con `key` afuera: la API rechaza propiedades de más.
    const ventanas: Ventana[] = franjas.map((f) => ({
      diaSemana: f.diaSemana,
      horaInicio: f.horaInicio,
      horaFin: f.horaFin,
      intervaloMinutos: f.intervaloMinutos,
      capacidad: f.capacidad,
    }));
    try {
      await reemplazarVentanas(token, ventanas);
      // El borrador en pantalla ya es lo que se guardó: no hace falta recargar ni re-montar,
      // y así el aviso de confirmación no se borra solo.
      setOk(true);
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `ventanas_superpuestas`, `plan_limit_reached`, validación: el mensaje del backend ya
      // dice qué día o qué límite. No lo reescribimos.
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <div>
      <p className="angosta text-[0.85rem] text-tinta-tenue">
        Tu plan {plan.nombre} permite hasta{' '}
        <span className="cifra font-semibold text-tinta-suave">{tope}</span>{' '}
        {tope === 1 ? 'turno' : 'turnos'} a la vez por franja.
      </p>

      {error && <Aviso tono="error" className="mt-6">{error}</Aviso>}
      {ok && <Aviso className="mt-6">Horarios guardados.</Aviso>}

      <div className="mt-8 divide-y divide-tinta/15 border-y border-tinta/15">
        {DIAS.map((dia) => {
          const delDia = franjas.filter((f) => f.diaSemana === dia.n);
          return (
            <div key={dia.n} className="grid gap-x-10 gap-y-5 py-8 md:grid-cols-[9rem_1fr]">
              <div>
                <h2 className="ancha text-[1.05rem] font-bold uppercase tracking-[-0.01em]">
                  {dia.nombre}
                </h2>
                {delDia.length === 0 && (
                  <p className="angosta mt-1.5 text-[0.8rem] text-tinta-tenue">Cerrado</p>
                )}
              </div>

              <div>
                <ul className="space-y-4">
                  {delDia.map((f) => (
                    <li key={f.key} className="flex flex-wrap items-end gap-x-5 gap-y-4">
                      <CampoHora etiqueta="Desde" valor={f.horaInicio} onCambio={(v) => cambiar(f.key, 'horaInicio', v)} />
                      <CampoHora etiqueta="Hasta" valor={f.horaFin} onCambio={(v) => cambiar(f.key, 'horaFin', v)} />
                      <div>
                        <label className="angosta block text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-tinta-tenue">
                          Cada
                        </label>
                        <select
                          value={f.intervaloMinutos}
                          onChange={(e) => cambiar(f.key, 'intervaloMinutos', Number(e.target.value))}
                          className="cifra mt-1.5 border border-tinta/20 bg-papel px-3 py-2 text-[0.95rem] text-tinta focus:border-verde-hondo focus:outline-none"
                        >
                          {INTERVALOS.map((m) => (
                            <option key={m} value={m}>{m} min</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="angosta block text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-tinta-tenue">
                          A la vez
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={tope}
                          value={f.capacidad}
                          onChange={(e) => cambiar(f.key, 'capacidad', Math.max(1, Math.min(tope, Number(e.target.value))))}
                          disabled={tope === 1}
                          className="cifra mt-1.5 w-[5.5rem] border border-tinta/20 bg-papel px-3 py-2 text-[0.95rem] text-tinta focus:border-verde-hondo focus:outline-none disabled:opacity-50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => quitar(f.key)}
                        className="angosta pb-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.3em] hover:text-tinta"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => agregar(dia.n)}
                  className={`angosta ${delDia.length > 0 ? 'mt-5' : ''} text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-verde-hondo underline decoration-verde decoration-2 underline-offset-[0.35em] hover:text-tinta`}
                >
                  + Agregar franja
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <Boton onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar la semana'}
        </Boton>
      </div>
    </div>
  );
}

function CampoHora({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
}) {
  return (
    <div>
      <label className="angosta block text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-tinta-tenue">
        {etiqueta}
      </label>
      <input
        type="time"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="cifra mt-1.5 border border-tinta/20 bg-papel px-3 py-2 text-[0.95rem] text-tinta focus:border-verde-hondo focus:outline-none"
      />
    </div>
  );
}
