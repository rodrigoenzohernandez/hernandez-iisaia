'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { campo, etiqueta } from '@/components/campos';
import { Flecha } from '@/components/Iconos';
import { ErrorApi } from '@/lib/cliente';
import { iniciarSesionAdmin } from '@/lib/admin';
import { guardarToken } from '@/lib/sesion';

/**
 * Ingreso de la administradora: email y contraseña. A diferencia de la clienta, acá sí hay
 * contraseña —la cuenta la crea el alta del centro, no este formulario— y el token dura ocho
 * horas en vez de treinta días.
 */
export function IngresoAdmin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const sesion = await iniciarSesionAdmin(email.trim(), password);
      guardarToken('admin', sesion.accessToken);
      router.replace('/admin');
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // Email o contraseña equivocados vuelven como el mismo `invalid_credentials`: no se
      // dice cuál de los dos falló.
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <section className="max-w-[46ch]">
      <p className="angosta text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-verde-hondo">
        Panel del centro
      </p>
      <h1 className="ancha mt-4 text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
        Ingresá a tu agenda
      </h1>

      {error && <Aviso tono="error" className="mt-8">{error}</Aviso>}

      <form onSubmit={enviar} className="mt-10">
        <div>
          <label htmlFor="email" className={etiqueta}>
            Email
          </label>
          <input
            id="email"
            type="email"
            className={campo}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="mt-7">
          <label htmlFor="password" className={etiqueta}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            className={campo}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <Boton type="submit" disabled={enviando} className="mt-9">
          {enviando ? 'Entrando…' : 'Entrar'}
          <Flecha className="h-4 w-4" />
        </Boton>
      </form>
    </section>
  );
}
