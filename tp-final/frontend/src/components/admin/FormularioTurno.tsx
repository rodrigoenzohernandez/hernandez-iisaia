'use client';

import { useState } from 'react';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { campo, etiqueta, nota } from '@/components/campos';
import { SelectorFecha } from '@/components/reserva/SelectorFecha';
import { crearReserva, ErrorApi, type Servicio } from '@/lib/cliente';
import { formatearFechaLarga } from '@/lib/formato';

/**
 * Cargar un turno a nombre de una clienta, desde el panel. Es el mismo `POST /reservas` con el
 * token de administradora: nace confirmada, en efectivo, sin cobro online. El email es
 * obligatorio también acá —es la identidad de la clienta y el destino de la confirmación—, y
 * el formulario lo explica.
 *
 * La administradora acepta menos anticipación que el alta pública, pero la grilla sigue siendo
 * la misma: muestra los horarios libres reales del centro.
 */
export function FormularioTurno({
  servicios,
  token,
  onListo,
  onCancelar,
}: {
  servicios: Servicio[];
  token: string;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const activos = servicios.filter((s) => s.activo);
  const [servicioId, setServicioId] = useState('');
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [recargarGrilla, setRecargarGrilla] = useState(0);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const servicio = activos.find((s) => s.id === servicioId) ?? null;
  const listoParaEnviar = Boolean(servicio && fecha && hora && nombre.trim() && email.trim());

  function elegirServicio(id: string) {
    setServicioId(id);
    // Otro tratamiento puede durar distinto: la hora elegida deja de valer.
    setFecha(null);
    setHora(null);
    setError(null);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!servicio || !fecha || !hora) return;
    setEnviando(true);
    setError(null);
    try {
      await crearReserva(
        {
          servicioId: servicio.id,
          fecha,
          hora,
          metodoPago: 'efectivo',
          clienteNombre: nombre.trim(),
          clienteEmail: email.trim(),
          clienteTelefono: telefono.trim(),
        },
        token,
      );
      onListo();
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      setError(e.message);
      // El horario se ocupó o quedó viejo mientras cargaba: hay que volver a elegir con la
      // grilla fresca.
      if (
        e.codigo === 'slot_full' ||
        e.codigo === 'outside_business_hours' ||
        e.codigo === 'past_date' ||
        e.codigo === 'too_far_ahead'
      ) {
        setHora(null);
        setRecargarGrilla((n) => n + 1);
      }
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="max-w-[44rem]">
      <h2 className="ancha text-[clamp(1.3rem,2.2vw,1.8rem)] font-bold uppercase leading-tight tracking-[-0.02em]">
        Cargar un turno
      </h2>
      <p className="angosta mt-4 max-w-[54ch] text-[0.98rem] leading-relaxed text-tinta-suave">
        Para una clienta que reservó por teléfono o en el local. Queda confirmado y en efectivo;
        la seña se cobra en el centro.
      </p>

      {error && <Aviso tono="error" className="mt-7">{error}</Aviso>}

      {/* tratamiento */}
      <div className="mt-9">
        <label htmlFor="servicio" className={etiqueta}>Tratamiento</label>
        <select
          id="servicio"
          value={servicioId}
          onChange={(e) => elegirServicio(e.target.value)}
          required
          className={campo}
        >
          <option value="" disabled>Elegí un tratamiento</option>
          {activos.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        {activos.length === 0 && (
          <p className={nota}>No hay tratamientos activos. Cargá uno en Tratamientos primero.</p>
        )}
      </div>

      {/* día y hora */}
      {servicio && (
        <div className="mt-9">
          <span className={etiqueta}>Día y hora</span>
          <div className="mt-3">
            <SelectorFecha
              servicio={servicio}
              fecha={fecha}
              hora={hora}
              recargar={recargarGrilla}
              onElegir={(f, h) => {
                setFecha(f);
                setHora(h);
                setError(null);
              }}
            />
          </div>
        </div>
      )}

      {/* contacto */}
      <div className="mt-10 border-t border-tinta/15 pt-8">
        <div className="grid gap-7 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nombre" className={etiqueta}>Nombre y apellido de la clienta</label>
            <input id="nombre" className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="email" className={etiqueta}>Email</label>
            <input id="email" type="email" className={campo} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" aria-describedby="email-nota" />
            <p id="email-nota" className={nota}>
              Obligatorio: ahí le llega la confirmación y con eso entra a ver su turno.
            </p>
          </div>
          <div>
            <label htmlFor="telefono" className={etiqueta}>Teléfono</label>
            <input id="telefono" className={campo} value={telefono} onChange={(e) => setTelefono(e.target.value)} required maxLength={30} autoComplete="off" />
          </div>
        </div>
      </div>

      {fecha && hora && servicio && (
        <p className="cifra angosta mt-8 bg-verde-humo px-6 py-4 text-[0.92rem] leading-relaxed text-tinta">
          {servicio.nombre} · {mayuscula(formatearFechaLarga(fecha))} · {hora}
        </p>
      )}

      <div className="mt-9 flex flex-wrap items-center gap-6">
        <Boton type="submit" disabled={enviando || !listoParaEnviar}>
          {enviando ? 'Cargando…' : 'Cargar turno'}
        </Boton>
        <button type="button" onClick={onCancelar} disabled={enviando} className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-tinta-suave underline decoration-tinta/30 underline-offset-[0.35em] disabled:opacity-45">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
