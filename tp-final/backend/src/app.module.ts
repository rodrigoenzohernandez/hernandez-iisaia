import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { CobrosModule } from './cobros/cobros.module.js';
import { env } from './env.js';
import { DisponibilidadModule } from './disponibilidad/disponibilidad.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { PlanesModule } from './planes/planes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReservasModule } from './reservas/reservas.module.js';
import { ServiciosModule } from './servicios/servicios.module.js';
import { TareasModule } from './tareas/tareas.module.js';
import { TenantAuthGuard } from './tenancy/tenant-auth.guard.js';
import { VentanasAtencionModule } from './ventanas-atencion/ventanas-atencion.module.js';

@Module({
  imports: [
    // Tope global holgado; las escrituras publicas llevan el suyo, mas estricto, con
    // @LimiteEstricto.
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: Math.max(120, env.throttleLimit) },
    ]),
    PrismaModule,
    NotificacionesModule,
    AuthModule,
    ClientesModule,
    CobrosModule,
    ServiciosModule,
    VentanasAtencionModule,
    DisponibilidadModule,
    ReservasModule,
    PlanesModule,
    TareasModule,
  ],
  providers: [
    // El ThrottlerGuard hay que registrarlo a mano: ThrottlerModule.forRoot solo publica las
    // opciones y el storage. Sin esta linea, los limites de las escrituras publicas y el
    // tope global son decoradores muertos y la API no tiene ningun limite de peticiones.
    // Va PRIMERO: conviene rechazar por volumen antes de gastar una query resolviendo el
    // centro y un scrypt verificando la contrasena.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // El guard de tenant es GLOBAL y @Publico() es la excepcion: falla cerrado. Olvidarse el
    // decorador rompe un endpoint publico en el primer curl; olvidarse un @UseGuards dejaria
    // una ruta de administracion abierta y nadie se enteraria.
    { provide: APP_GUARD, useClass: TenantAuthGuard },
  ],
})
export class AppModule {}
