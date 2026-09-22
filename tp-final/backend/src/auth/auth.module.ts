import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../env.js';
import { AuthService } from './auth.service.js';
import { SesionesController } from './sesiones.controller.js';

@Module({
  imports: [
    // Global: el guard tambien necesita verificar tokens, y es el mismo secreto.
    JwtModule.register({
      global: true,
      secret: env.jwtSecret,
      // Literal y no una variable de entorno: el tipo de @nestjs/jwt es un template literal
      // ('8h', '30m', ...) que un string cualquiera no satisface, asi que leerlo del entorno
      // obligaba a un cast que anulaba el chequeo. Ocho horas es un turno de trabajo.
      signOptions: { algorithm: 'HS256', expiresIn: '8h' },
    }),
  ],
  controllers: [SesionesController],
  providers: [AuthService],
})
export class AuthModule {}
