import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  PUBLICO,
  ROLES,
  type RequestConTenant,
  type Rol,
} from '../common/decorators.js';
import { camposDelPlan, planVigente } from '../planes/planes.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { TenantContext } from './tenant-context.js';

/**
 * Lo que el login firma. `tid` es el id interno del tenant, que nunca sale por la API; el
 * token de la plataforma no lo lleva.
 */
export type JwtPayload = { sub: string; tid?: string; rol: Rol };

/**
 * Guard global. Hace cinco cosas, en orden:
 *   1. resuelve el centro del slug del path y lo deja en el TenantContext,
 *   2. verifica el Bearer si vino,
 *   3. exige que el token sea del lugar del path (403): con centro, de ese centro; sin
 *      centro, de la plataforma,
 *   4. exige sesion en todo lo que no este marcado @Publico,
 *   5. exige que el rol del token este entre los de la ruta; sin @Roles, solo admin (403).
 */
@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<RequestConTenant>();
    const slug = req.params?.tenantSlug;

    let tenantId: string | null = null;
    if (slug) {
      // findFirst sobre Tenant: es el unico modelo que la extension no filtra, porque es la
      // raiz del arbol y no tiene tenantId.
      const tenant = await this.db.tenant.findFirst({
        where: { slug },
        select: {
          id: true,
          slug: true,
          nombre: true,
          zonaHoraria: true,
          activo: true,
          ...camposDelPlan,
        },
      });
      // Un centro dado de baja responde igual que uno que no existe: no hay por que
      // confirmar que el slug existe.
      if (!tenant?.activo) {
        throw new NotFoundException({
          code: 'tenant_not_found',
          message: 'No encontramos ese centro.',
        });
      }
      tenantId = tenant.id;
      TenantContext.set(tenant.id);
      // Al request va todo MENOS el id: el id es el claim tid y no se serializa nunca.
      req.tenant = {
        slug: tenant.slug,
        nombre: tenant.nombre,
        zonaHoraria: tenant.zonaHoraria,
        plan: planVigente(tenant),
      };
    }

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      let payload: JwtPayload;
      try {
        payload = await this.jwt.verifyAsync<JwtPayload>(token, {
          algorithms: ['HS256'],
        });
      } catch {
        throw new UnauthorizedException({
          code: 'invalid_token',
          message: 'Tu sesion vencio. Volve a entrar.',
        });
      }
      // El path nombra el lugar, pero el token es la autoridad. Una ruta de centro acepta
      // solo tokens de ese centro; una sin centro, solo el de la plataforma.
      const suyo = tenantId
        ? payload.rol !== 'superadmin' && payload.tid === tenantId
        : payload.rol === 'superadmin' && payload.tid === undefined;
      if (suyo) {
        req.usuario = { id: payload.sub, rol: payload.rol };
      } else if (tenantId || !publico) {
        // Una ruta publica sin centro (los planes, el alta de un centro) no depende de quien
        // pregunta: un token ajeno ahi se ignora, asi un front que manda el token en cada
        // request no las rompe.
        throw new ForbiddenException({
          code: 'wrong_tenant',
          message: 'Esa cuenta no pertenece a este centro.',
        });
      }
    }

    if (publico) return true;

    // El chequeo corre SIEMPRE, con slug o sin el: un `if (!slug) return true` se saltearia
    // token, cross-check y proteccion de una sola vez.
    if (!req.usuario) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Necesitas iniciar sesion.',
      });
    }
    // Sin @Roles, la ruta es de administracion. Antes de las cuentas de clientas bastaba con
    // tener token del centro; con clientas, eso le abria la agenda completa a cualquiera.
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]) ?? ['admin'];
    if (!roles.includes(req.usuario.rol)) {
      throw new ForbiddenException({
        code: 'forbidden_role',
        message: 'Tu cuenta no tiene acceso a esta seccion.',
      });
    }
    return true;
  }
}
