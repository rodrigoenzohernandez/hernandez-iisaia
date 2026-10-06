'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { campo, etiqueta, nota } from '@/components/campos';
import { ErrorApi, type Servicio } from '@/lib/cliente';
import { crearServicio, actualizarServicio, type CrearServicio } from '@/lib/admin';
import { useSlug } from '@/hooks/useSlug';

/**
 * Alta y edición de un tratamiento. El mismo formulario para los dos: si llega `servicio`,
 * edita; si no, crea.
 *
 * Los precios se cargan en pesos enteros y se guardan en centavos, que es lo que pide la API.
 * Las dos políticas son el corazón de esta pantalla: `reprogramacionHorasAntes` en `null`
 * significa que la clienta no reprograma sola, así que no es lo mismo vacío que cero.
 */
export function FormularioServicio({
  token,
  servicio,
  onListo,
  onCancelar,
}: {
  token: string;
  servicio: Servicio | null;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const slug = useSlug();
  const [nombre, setNombre] = useState(servicio?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(servicio?.descripcion ?? '');
  const [duracion, setDuracion] = useState(String(servicio?.duracionMinutos ?? 30));
  const [precio, setPrecio] = useState(servicio ? String(servicio.precioCentavos / 100) : '');
  const [sena, setSena] = useState(servicio ? String(servicio.senaCentavos / 100) : '');
  const [valoracion, setValoracion] = useState(servicio?.requiereValoracion ?? false);
  // Reprogramación: el check decide si la clienta puede; el número, con cuánta antelación.
  const [permiteReprogramar, setPermiteReprogramar] = useState(
    servicio ? servicio.reprogramacionHorasAntes !== null : true,
  );
  const [horasReprogramar, setHorasReprogramar] = useState(
    String(servicio?.reprogramacionHorasAntes ?? 24),
  );
  const [horasCancelar, setHorasCancelar] = useState(String(servicio?.cancelacionHorasAntes ?? 24));

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const precioNum = Math.round(Number(precio) * 100);
  const senaNum = Math.round(Number(sena) * 100);
  // El backend valida esto también; adelantarlo evita un viaje y explica el porqué en el acto.
  const senaInvalida = sena !== '' && precio !== '' && senaNum > precioNum;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (senaInvalida) return;
    setEnviando(true);
    setError(null);

    const datos: CrearServicio = {
      nombre: nombre.trim(),
      duracionMinutos: Number(duracion),
      precioCentavos: precioNum,
      senaCentavos: senaNum,
      requiereValoracion: valoracion,
      // `null` es intencional: apaga la reprogramación de la clienta. No se omite.
      reprogramacionHorasAntes: permiteReprogramar ? Number(horasReprogramar) : null,
      cancelacionHorasAntes: Number(horasCancelar),
    };
    const descr = descripcion.trim();
    if (descr) datos.descripcion = descr;

    try {
      if (servicio) {
        await actualizarServicio(slug, token, servicio.id, datos);
      } else {
        await crearServicio(slug, token, datos);
      }
      onListo();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `servicio_name_taken` incluido: el nombre es único en el centro.
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="max-w-[46rem]">
      <h2 className="ancha text-[clamp(1.3rem,2.2vw,1.8rem)] font-bold uppercase leading-tight tracking-[-0.02em]">
        {servicio ? 'Editar tratamiento' : 'Nuevo tratamiento'}
      </h2>

      {error && <Aviso tono="error" className="mt-7">{error}</Aviso>}

      <div className="mt-8 grid gap-7 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nombre" className={etiqueta}>Nombre</label>
          <input id="nombre" className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} autoFocus />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="descripcion" className={etiqueta}>Descripción</label>
          <textarea id="descripcion" className={campo} rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} />
        </div>

        <div>
          <label htmlFor="duracion" className={etiqueta}>Duración (minutos)</label>
          <input id="duracion" type="number" inputMode="numeric" className={`${campo} cifra`} value={duracion} onChange={(e) => setDuracion(e.target.value)} required min={5} max={600} step={5} />
        </div>

        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-3 pb-3">
            <input type="checkbox" checked={valoracion} onChange={(e) => setValoracion(e.target.checked)} className="h-4 w-4 accent-verde-hondo" />
            <span className="angosta text-[0.9rem] text-tinta">Requiere valoración previa</span>
          </label>
        </div>

        <div>
          <label htmlFor="precio" className={etiqueta}>Precio (pesos)</label>
          <input id="precio" type="number" inputMode="numeric" className={`${campo} cifra`} value={precio} onChange={(e) => setPrecio(e.target.value)} required min={0} step={100} />
        </div>

        <div>
          <label htmlFor="sena" className={etiqueta}>Seña (pesos)</label>
          <input id="sena" type="number" inputMode="numeric" className={`${campo} cifra`} value={sena} onChange={(e) => setSena(e.target.value)} required min={0} step={100} aria-describedby="sena-nota" aria-invalid={senaInvalida} />
          <p id="sena-nota" className={nota}>
            {senaInvalida ? 'La seña no puede superar el precio.' : 'La parte que se cobra online al reservar. Puede ser igual al precio.'}
          </p>
        </div>
      </div>

      {/* ---- políticas ---- */}
      <fieldset className="mt-10 border-t border-tinta/15 pt-8">
        <legend className="angosta text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-verde-hondo">
          Qué puede hacer la clienta con su turno
        </legend>

        <label className="mt-6 flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={permiteReprogramar} onChange={(e) => setPermiteReprogramar(e.target.checked)} className="h-4 w-4 accent-verde-hondo" />
          <span className="angosta text-[0.95rem] text-tinta">La clienta puede reprogramar sola</span>
        </label>

        {permiteReprogramar && (
          <div className="mt-5 pl-7">
            <label htmlFor="horas-reprogramar" className={etiqueta}>Hasta cuántas horas antes</label>
            <input id="horas-reprogramar" type="number" inputMode="numeric" className={`${campo} cifra max-w-[10rem]`} value={horasReprogramar} onChange={(e) => setHorasReprogramar(e.target.value)} min={0} max={720} />
          </div>
        )}

        <div className="mt-7">
          <label htmlFor="horas-cancelar" className={etiqueta}>Cancela con devolución hasta cuántas horas antes</label>
          <input id="horas-cancelar" type="number" inputMode="numeric" className={`${campo} cifra max-w-[10rem]`} value={horasCancelar} onChange={(e) => setHorasCancelar(e.target.value)} required min={0} max={720} aria-describedby="cancelar-nota" />
          <p id="cancelar-nota" className={nota}>
            Después de ese plazo, cancelar no devuelve lo pagado. En 0, nunca hay devolución.
          </p>
        </div>
      </fieldset>

      <div className="mt-10 flex flex-wrap items-center gap-6">
        <Boton type="submit" disabled={enviando || senaInvalida}>
          {enviando ? 'Guardando…' : servicio ? 'Guardar cambios' : 'Crear tratamiento'}
        </Boton>
        <button type="button" onClick={onCancelar} disabled={enviando} className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45">
          Cancelar
        </button>
      </div>
    </form>
  );
}
