'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { campo, etiqueta, nota } from '@/components/campos';
import { Flecha, FlechaIzquierda } from '@/components/Iconos';
import { ErrorApi } from '@/lib/cliente';
import { iniciarSesionClienta, pedirCodigo } from '@/lib/cuenta';
import { guardarToken } from '@/lib/sesion';

const LARGO_CODIGO = 6;

/**
 * Ingreso por código al mail. No hay contraseña ni alta: la cuenta nace sola la primera vez.
 *
 * El pedido de código contesta 202 exista o no la cuenta, así que esta pantalla **nunca**
 * dice si un email tiene turnos: pasa al paso del código igual. Decirlo convertiría el
 * formulario en un buscador de quién se atiende acá.
 */
export function Ingreso() {
  const router = useRouter();
  const [paso, setPaso] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [minutos, setMinutos] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviarEmail(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const { expiraEnMinutos } = await pedirCodigo(email.trim());
      setMinutos(expiraEnMinutos);
      setCodigo('');
      setPaso('codigo');
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `too_many_codes` es el único que importa distinguir: el resto ya viene redactado.
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const sesion = await iniciarSesionClienta(email.trim(), codigo.trim());
      guardarToken('clienta', sesion.accessToken);
      router.replace('/mis-turnos');
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      setError(e.message);
      setCodigo('');
      setEnviando(false);
    }
    // Sin `finally`: cuando sale bien la navegación ya arrancó y reactivar el botón solo
    // invita a mandarlo dos veces.
  }

  return (
    <section className="max-w-[52ch]">
      <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
        {paso === 'email' ? 'Ver mis turnos' : 'Revisá tu mail'}
      </h1>

      <p className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
        {paso === 'email' ? (
          <>
            Te mandamos un código al mail y entrás con eso. No hace falta contraseña ni crear
            una cuenta: con el mail que usaste para reservar alcanza.
          </>
        ) : (
          <>
            Si <span className="font-semibold">{email.trim()}</span> tiene turnos con nosotras, le
            llegó un código de {LARGO_CODIGO} dígitos
            {minutos !== null && <> que vale {minutos} minutos</>}.
          </>
        )}
      </p>

      {error && <Aviso tono="error" className="mt-8">{error}</Aviso>}

      {paso === 'email' ? (
        <form onSubmit={enviarEmail} className="mt-10">
          <label htmlFor="email" className={etiqueta}>
            Tu email
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
            aria-describedby="email-nota"
          />
          <p id="email-nota" className={nota}>
            Usá el mismo con el que reservaste: ahí están todos tus turnos, también los que
            sacaste sin cuenta.
          </p>

          <Boton type="submit" disabled={enviando} className="mt-9">
            {enviando ? 'Mandando el código…' : 'Mandame el código'}
            <Flecha className="h-4 w-4" />
          </Boton>
        </form>
      ) : (
        <form onSubmit={enviarCodigo} className="mt-10">
          <label htmlFor="codigo" className={etiqueta}>
            Código
          </label>
          <input
            id="codigo"
            className={`${campo} cifra max-w-[14rem] text-[1.4rem] tracking-[0.4em]`}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, LARGO_CODIGO))}
            required
            // Teclado numérico en el teléfono, y el código del SMS/mail ofrecido por el sistema.
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            minLength={LARGO_CODIGO}
            maxLength={LARGO_CODIGO}
          />

          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Boton type="submit" disabled={enviando || codigo.length < LARGO_CODIGO}>
              {enviando ? 'Entrando…' : 'Entrar'}
              <Flecha className="h-4 w-4" />
            </Boton>
            <button
              type="button"
              onClick={() => {
                setPaso('email');
                setError(null);
              }}
              className="inline-flex items-center gap-2.5 text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-tinta underline decoration-verde decoration-2 underline-offset-[0.35em]"
            >
              <FlechaIzquierda className="h-4 w-4" />
              Pedir otro código
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
