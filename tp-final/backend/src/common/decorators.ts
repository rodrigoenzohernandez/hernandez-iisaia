import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const PUBLICO = 'publico';
export const ROLES = 'roles';

/** Los roles que viajan en el JWT. */
export type Rol = 'admin' | 'cliente' | 'superadmin';

/**
 * Marca una ruta como publica. El guard es global y el default es protegido, asi que esto
 * es la excepcion: olvidarse el decorador deja el endpoint CERRADO, no abierto. Olvidarse
 * un @UseGuards, en cambio, dejaria una ruta de administracion abierta y nadie se enteraria.
 */
export const Publico = () => SetMetadata(PUBLICO, true);

/**
 * Quien puede entrar a una ruta protegida. Sin este decorador la ruta es solo de
 * administracion: el default falla cerrado, igual que @Publico, y una ruta nueva que se
 * olvida de declarar sus roles queda para la administradora y no para cualquier token.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

/** El centro de la request, resuelto por el guard desde el slug del path. */
export type TenantRequest = {
  slug: string;
  nombre: string;
  zonaHoraria: string;
};

/** La persona autenticada, si el request trajo un Bearer valido. */
export type UsuarioRequest = { id: string; rol: Rol };

/**
 * Lo unico que se usa del request de express. Se tipa a mano para no sumar @types/express
 * como dependencia por dos propiedades.
 */
export type RequestConTenant = {
  headers: { authorization?: string };
  params?: Record<string, string | undefined>;
  tenant?: TenantRequest;
  usuario?: UsuarioRequest;
};

export const CurrentTenant = createParamDecorator(
  (_datos: unknown, ctx: ExecutionContext): TenantRequest => {
    const req = ctx.switchToHttp().getRequest<RequestConTenant>();
    // El guard corre antes y siempre resuelve el tenant: si falta, es un bug de cableado,
    // no un input invalido.
    if (!req.tenant)
      throw new Error('El guard no resolvio el tenant de esta request');
    return req.tenant;
  },
);

/**
 * La persona autenticada, si el request trajo un Bearer valido. `undefined` en las rutas
 * publicas cuando no vino token. Para decidir que ve cada quien se mira el ROL, nunca solo
 * si hay usuario: una clienta con sesion tambien trae token.
 */
export const CurrentUsuario = createParamDecorator(
  (_datos: unknown, ctx: ExecutionContext): UsuarioRequest | undefined =>
    ctx.switchToHttp().getRequest<RequestConTenant>().usuario,
);
