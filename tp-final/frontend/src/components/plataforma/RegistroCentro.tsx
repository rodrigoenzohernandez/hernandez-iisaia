'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso } from '@/components/Aviso';
import { Boton } from '@/components/Boton';
import { campo, etiqueta, nota } from '@/components/campos';
import { Flecha } from '@/components/Iconos';
import { ErrorApi } from '@/lib/cliente';
import { crearCentro } from '@/lib/plataforma';
import { guardarToken } from '@/lib/sesion';

/** Minúsculas, números y guiones; espacios y acentos a guiones; sin guiones de borde. */
function normalizarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function RegistroCentro() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [adminNombre, setAdminNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El slug se autocompleta desde el nombre hasta que la dueña lo edita a mano.
  function cambiarNombre(valor: string) {
    setNombre(valor);
    if (!slugTocado) setSlug(normalizarSlug(valor));
  }

  const slugValido = slug.length >= 3 && slug.length <= 40;
  const passwordValida = password.length >= 12 && password.length <= 128;
  const listo = Boolean(nombre.trim() && slugValido && adminNombre.trim() && email.trim() && passwordValida);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!listo) return;
    setEnviando(true);
    setError(null);
    try {
      const resp = await crearCentro({
        nombre: nombre.trim(),
        slug,
        admin: { nombre: adminNombre.trim(), email: email.trim(), password },
      });
      // Entra directo a su panel: la respuesta ya trae la sesión de la administradora.
      guardarToken('admin', resp.accessToken, resp.centro.slug);
      router.replace(`/${resp.centro.slug}/admin`);
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      // `slug_taken` (409), `validation_error` (slug o contraseña), `too_many_requests` (3/hora):
      // el mensaje del backend ya está redactado.
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <section className="max-w-[46rem]">
      <h1 className="ancha text-[clamp(1.9rem,4vw,3.2rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.03em]">
        Registrá tu centro
      </h1>
      <p className="angosta mt-6 max-w-[52ch] text-[1.05rem] leading-relaxed text-tinta-suave">
        Creás tu centro y tu cuenta de administradora en un paso, y entrás directo al panel.
        Arranca en el plan Básico; después cargás tus tratamientos y tus horarios.
      </p>

      {error && <Aviso tono="error" className="mt-8">{error}</Aviso>}

      <form onSubmit={enviar} className="mt-10">
        <div className="grid gap-7 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nombre" className={etiqueta}>Nombre del centro</label>
            <input id="nombre" className={campo} value={nombre} onChange={(e) => cambiarNombre(e.target.value)} required maxLength={120} autoFocus />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="slug" className={etiqueta}>Dirección web</label>
            <div className="mt-2 flex items-stretch border border-tinta/20 bg-papel focus-within:border-verde-hondo">
              <span className="cifra angosta flex items-center whitespace-nowrap border-r border-tinta/15 px-3 text-[0.9rem] text-tinta-tenue">
                /…/
              </span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => { setSlugTocado(true); setSlug(normalizarSlug(e.target.value)); }}
                required
                minLength={3}
                maxLength={40}
                className="cifra w-full bg-transparent px-3 py-3 text-[0.98rem] text-tinta focus:outline-none"
                aria-describedby="slug-nota"
              />
            </div>
            <p id="slug-nota" className={nota}>
              {slug && !slugValido
                ? 'La dirección va de 3 a 40 caracteres.'
                : `Tu centro va a estar en una dirección como esta. Minúsculas, números y guiones.`}
            </p>
          </div>

          <div className="sm:col-span-2 mt-2 border-t border-tinta/15 pt-7">
            <p className="angosta text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-verde-hondo">
              Tu cuenta de administradora
            </p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="admin-nombre" className={etiqueta}>Tu nombre</label>
            <input id="admin-nombre" className={campo} value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} required maxLength={120} autoComplete="name" />
          </div>
          <div>
            <label htmlFor="email" className={etiqueta}>Email</label>
            <input id="email" type="email" className={campo} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label htmlFor="password" className={etiqueta}>Contraseña</label>
            <input id="password" type="password" className={campo} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="password-nota" />
            <p id="password-nota" className={nota}>
              {password && !passwordValida ? 'De 12 a 128 caracteres.' : 'Al menos 12 caracteres.'}
            </p>
          </div>
        </div>

        <Boton type="submit" disabled={enviando || !listo} className="mt-10">
          {enviando ? 'Creando tu centro…' : 'Crear mi centro'}
          <Flecha className="h-4 w-4" />
        </Boton>
      </form>
    </section>
  );
}
