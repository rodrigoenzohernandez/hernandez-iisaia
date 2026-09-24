import { Global, Module } from '@nestjs/common';
import { env } from '../env.js';
import {
  EMAIL_SENDER,
  type EmailSender,
  LogEmailSender,
  ResendEmailSender,
} from './email.js';
import { NotificacionesService } from './notificaciones.service.js';

/** Global como Prisma: casi todo el dominio avisa algo por mail. */
@Global()
@Module({
  providers: [
    NotificacionesService,
    {
      provide: EMAIL_SENDER,
      // El unico lugar que conoce a los proveedores. SES es otra rama de este ternario.
      useFactory: (): EmailSender =>
        env.email.provider === 'resend'
          ? new ResendEmailSender(env.email.resendApiKey!, env.email.from)
          : new LogEmailSender(),
    },
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
