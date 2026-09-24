import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { senuelo, verifyPassword } from '../common/password.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import type { JwtPayload } from '../tenancy/tenant-auth.guard.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import type { CrearSesionDto } from './dto/crear-sesion.dto.js';
import type { SesionDto } from './dto/sesion.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async create(dto: CrearSesionDto): Promise<SesionDto> {
    // findUnique por (tenantId, email) y NUNCA findFirst por email solo: el mismo email
    // puede administrar dos centros, y un findFirst convertiria el login en un oraculo de
    // credenciales entre centros, y peor, firmaria un token del centro del path.
    const usuario = await this.db.usuario.findUnique({
      where: {
        tenantId_email: { tenantId: TenantContext.require(), email: dto.email },
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        passwordHash: true,
        tenantId: true,
      },
    });

    // Correr scrypt SIEMPRE, incluso sin usuario: con un short-circuit el 401 de "ese email
    // no existe" vuelve en una fraccion del tiempo del 401 de "contrasena incorrecta", y esa
    // diferencia es un enumerador de cuentas medible con curl.
    const correcta = await verifyPassword(
      dto.password,
      usuario?.passwordHash ?? senuelo,
    );

    // El mismo 401 para email inexistente y para contrasena incorrecta.
    if (!usuario || !correcta) {
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Email o contrasena incorrectos.',
      });
    }

    return {
      accessToken: await this.jwt.signAsync<JwtPayload>({
        sub: usuario.id,
        tid: usuario.tenantId,
        rol: usuario.rol,
      }),
      // Campos explicitos: el passwordHash no sale nunca del backend.
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    };
  }
}
