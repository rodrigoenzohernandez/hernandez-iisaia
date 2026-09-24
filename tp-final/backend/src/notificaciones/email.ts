import { Logger } from '@nestjs/common';

/**
 * El mail que sale, ya armado. Es infraestructura y va en ingles: el proveedor no sabe
 * nada de turnos.
 */
export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** El id de la notificacion. Resend deduplica con esto; SES no tiene, y dedupe la cola. */
  idempotencyKey: string;
};

/**
 * Lo unico que la app necesita de un proveedor de mails. Cambiar Resend por SES es escribir
 * otra clase que cumpla esto y elegirla en notificaciones.module.ts.
 */
export interface EmailSender {
  send(email: Email): Promise<{ id: string }>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/** Imprime el mail en la consola. Es el de desarrollo: asi se ve el codigo de ingreso. */
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger('Mail');

  send(email: Email): Promise<{ id: string }> {
    this.logger.log(`Para ${email.to}: ${email.subject}\n${email.text}`);
    return Promise.resolve({ id: `log-${email.idempotencyKey}` });
  }
}

/**
 * Resend por su API REST. Sin el SDK: es un POST con tres headers, y el SDK no agrega nada
 * que haga falta para mandar.
 */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(email: Email): Promise<{ id: string }> {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        // La misma key con el mismo body devuelve el envio original durante 24 horas: un
        // reintento despues de un timeout no le llega dos veces a nadie.
        'Idempotency-Key': email.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      message?: string;
    };
    if (!respuesta.ok || !cuerpo.id) {
      throw new Error(
        `Resend respondio ${respuesta.status}: ${cuerpo.name ?? ''} ${cuerpo.message ?? ''}`,
      );
    }
    return { id: cuerpo.id };
  }
}
