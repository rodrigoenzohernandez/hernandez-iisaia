import { Boton, BotonEnlace } from '@/components/Boton';
import { Flecha } from '@/components/Iconos';

/** La sesión no está activa o venció: mismo cartel en las tres pantallas. */
export function PanelAnonimo() {
  return (
    <section className="max-w-[50ch]">
      <h1 className="ancha text-[clamp(1.5rem,2.8vw,2.3rem)] font-bold uppercase leading-tight tracking-[-0.025em]">
        Entrá a tu panel
      </h1>
      <p className="angosta mt-7 text-[1.02rem] leading-relaxed text-tinta-suave">
        Tu sesión no está activa o venció. Ingresá de nuevo con tu email y contraseña.
      </p>
      <div className="mt-11">
        <BotonEnlace href="/admin/ingresar">
          Ingresar
          <Flecha className="h-4 w-4" />
        </BotonEnlace>
      </div>
    </section>
  );
}

/** Un error que no es de sesión: se muestra el mensaje del backend y se ofrece reintentar. */
export function PanelError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="max-w-[54ch]">
      <p role="alert" className="border-l-2 border-tinta bg-verde-humo px-6 py-5 text-[0.95rem] leading-relaxed text-tinta">
        {mensaje}
      </p>
      <div className="mt-8">
        <Boton tono="borde" onClick={onReintentar}>
          Reintentar
        </Boton>
      </div>
    </div>
  );
}

/** La carga se cuenta, no gira. */
export function PanelCargando({ texto }: { texto: string }) {
  return (
    <p aria-live="polite" className="angosta text-[1.02rem] text-tinta-suave">
      {texto}
    </p>
  );
}
