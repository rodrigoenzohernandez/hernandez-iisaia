'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { campo, etiqueta } from '@/components/campos';
import { Flecha } from '@/components/Iconos';
import { ErrorApi } from '@/lib/cliente';
import { iniciarSesionPlataforma } from '@/lib/plataforma';
import { guardarToken } from '@/lib/sesion';

/**
 * Ingreso de la plataforma (superadmin). La cuenta no se da de alta: la crea el seed. El token
 * es global —no pertenece a ningún centro— y dura ocho horas.
 */
export function IngresoPlataforma() {
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
      const sesion = await iniciarSesionPlataforma(email.trim(), password);
      guardarToken('plataforma', sesion.accessToken);
      router.replace('/plataforma');
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <section className="max-w-[46ch]">
      <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
        Panel de la plataforma
      </h1>

      {error && <Aviso tono="error" className="mt-8">{error}</Aviso>}

      <form onSubmit={enviar} className="mt-10">
        <div>
          <label htmlFor="email" className={etiqueta}>Email</label>
          <input id="email" type="email" className={campo} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </div>
        <div className="mt-7">
          <label htmlFor="password" className={etiqueta}>Contraseña</label>
          <input id="password" type="password" className={campo} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <Boton type="submit" disabled={enviando} className="mt-9">
          {enviando ? 'Entrando…' : 'Entrar'}
          <Flecha className="h-4 w-4" />
        </Boton>
      </form>
    </section>
  );
}
