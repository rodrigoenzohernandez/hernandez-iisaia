import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { aDate, ahoraEn } from '../common/horario.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import { paginate } from '../common/pagination/paginate.js';
import { hashPassword, senuelo, verifyPassword } from '../common/password.js';
import { SLUGS_RESERVADOS } from '../common/slug.js';
import { camposDelPlan, PLANES, planVigente } from '../planes/planes.js';
import { SuscripcionesService } from '../planes/suscripciones.service.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import type { CentroCreadoDto, CrearCentroDto } from './dto/alta-centro.dto.js';
import type {
  CentroDto,
  CrearSesionPlataformaDto,
  ListCentrosQueryDto,
  ResumenDto,
  SesionPlataformaDto,
  UpdateCentroDto,
} from './dto/plataforma.dto.js';

/** Lo que se lee de cada centro. Los conteos van por relacion: una sola query por pagina. */
const centroSelect = {
  id: true,
  slug: true,
  nombre: true,
  activo: true,
  createdAt: true,
  suscripcionMpId: true,
  ...camposDelPlan,
  cuentaMercadoPago: { select: { requiereReconexion: true } },
  _count: { select: { servicios: true, clientes: true } },
} as const;

type FilaCentro = Prisma.TenantGetPayload<{ select: typeof centroSelect }>;

/**
 * El mes en curso en la hora de la plataforma. Las fechas de turno son dias de pared y los
 * cobros son instantes, asi que van los dos rangos. Argentina esta en UTC-3 fijo desde 2009.
 */
function mesEnCurso() {
  const [anio, mes] = ahoraEn('America/Argentina/Buenos_Aires')
    .fecha.split('-')
    .map(Number);
  const siguiente = mes === 12 ? [anio + 1, 1] : [anio, mes + 1];
  const primero = (a: number, m: number) =>
    `${a}-${String(m).padStart(2, '0')}-01`;
  const desde = primero(anio, mes);
  const hasta = primero(siguiente[0], siguiente[1]);
  return {
    nombre: desde.slice(0, 7),
    dias: { gte: aDate(desde), lt: aDate(hasta) },
    instantes: {
      gte: new Date(`${desde}T00:00:00-03:00`),
      lt: new Date(`${hasta}T00:00:00-03:00`),
    },
  };
}
type Mes = ReturnType<typeof mesEnCurso>;

function slugTomado(): never {
  throw new ConflictException({
    code: 'slug_taken',
    message: 'Ese slug ya esta en uso. Elegi otro.',
  });
}

/**
 * La plataforma: la cuenta de superadmin, el panel con los centros y el alta de centros.
 *
 * Tenant y Superadmin son globales y la extension no los filtra. Los numeros de cada centro
 * que viven en tablas con tenantId se leen con runAs, sellados como en cualquier request.
 */
@Injectable()
export class PlataformaService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Db,
    private readonly suscripciones: SuscripcionesService,
  ) {}

  async ingresar(dto: CrearSesionPlataformaDto): Promise<SesionPlataformaDto> {
    const cuenta = await this.db.superadmin.findUnique({
      where: { email: dto.email },
      select: { id: true, nombre: true, email: true, passwordHash: true },
    });
    // scrypt siempre, con el senuelo si no hay cuenta, y el mismo 401 para las dos fallas:
    // igual que el login de los centros.
    const correcta = await verifyPassword(
      dto.password,
      cuenta?.passwordHash ?? senuelo,
    );
    if (!cuenta || !correcta) {
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Email o contrasena incorrectos.',
      });
    }
    return {
      // Sin tid: el guard solo acepta este token en las rutas sin centro.
      accessToken: await this.jwt.signAsync({
        sub: cuenta.id,
        rol: 'superadmin',
      }),
      superadmin: { id: cuenta.id, nombre: cuenta.nombre, email: cuenta.email },
    };
  }

  async centros(query: ListCentrosQueryDto): Promise<CursorPageDto<CentroDto>> {
    const mes = mesEnCurso();
    const pagina = await paginate(query, ['slug', 'id'], (p) =>
      this.db.tenant.findMany({
        where: {
          ...(query.activo === undefined ? {} : { activo: query.activo }),
          ...p.where,
        },
        orderBy: p.orderBy,
        take: p.take,
        select: centroSelect,
      }),
    );
    return {
      data: await Promise.all(pagina.data.map((t) => this.aCentro(t, mes))),
      nextCursor: pagina.nextCursor,
    };
  }

  async resumen(): Promise<ResumenDto> {
    const mes = mesEnCurso();
    const centros = await this.db.tenant.findMany({
      select: { id: true, activo: true, createdAt: true, ...camposDelPlan },
    });
    // ponytail: dos queries por centro. Con cientos de centros, un groupBy por tenantId.
    const numeros = await Promise.all(
      centros.map((c) => TenantContext.runAs(c.id, () => this.delMes(mes))),
    );
    const activos = centros.filter((c) => c.activo);
    const porPlan = { basico: 0, profesional: 0 };
    for (const c of activos) porPlan[planVigente(c)]++;
    const pagando = activos.filter(
      (c) =>
        c.suscripcionEstado === 'authorized' &&
        planVigente(c) === 'profesional',
    ).length;
    const suma = (campo: 'turnosDelMes' | 'cobradoDelMesCentavos') =>
      numeros.reduce((s, n) => s + n[campo], 0);
    return {
      mes: mes.nombre,
      centros: centros.length,
      centrosActivos: activos.length,
      centrosNuevos: centros.filter((c) => c.createdAt >= mes.instantes.gte)
        .length,
      porPlan,
      ingresoMensualCentavos: pagando * PLANES.profesional.precioCentavos,
      turnosDelMes: suma('turnosDelMes'),
      cobradoDelMesCentavos: suma('cobradoDelMesCentavos'),
    };
  }

  async actualizar(slug: string, dto: UpdateCentroDto): Promise<CentroDto> {
    // Un centro dado de baja no puede entrar a cancelar su plan, asi que la baja lo cancela:
    // si no, Mercado Pago le seguiria cobrando todos los meses.
    if (!dto.activo) {
      const centro = await this.db.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (centro) {
        await TenantContext.runAs(centro.id, () =>
          this.suscripciones.cancelar(),
        );
      }
    }
    try {
      const t = await this.db.tenant.update({
        where: { slug },
        data: { activo: dto.activo },
        select: centroSelect,
      });
      return this.aCentro(t, mesEnCurso());
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException({
          code: 'tenant_not_found',
          message: 'No encontramos ese centro.',
        });
      }
      throw e;
    }
  }

  /** Crea el centro, en Basico, con su administradora, y devuelve la sesion de ella. */
  async crearCentro(dto: CrearCentroDto): Promise<CentroCreadoDto> {
    if (SLUGS_RESERVADOS.has(dto.slug)) slugTomado();
    const passwordHash = await hashPassword(dto.admin.password);
    let t: {
      id: string;
      slug: string;
      nombre: string;
      usuarios: { id: string; nombre: string; rol: string }[];
    };
    try {
      // Una sola escritura: el centro y su administradora nacen juntos o no nacen.
      t = await this.db.tenant.create({
        data: {
          slug: dto.slug,
          nombre: dto.nombre,
          usuarios: {
            create: {
              email: dto.admin.email,
              nombre: dto.admin.nombre,
              passwordHash,
            },
          },
        },
        select: {
          id: true,
          slug: true,
          nombre: true,
          usuarios: { select: { id: true, nombre: true, rol: true } },
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        slugTomado();
      }
      throw e;
    }
    const [usuario] = t.usuarios;
    return {
      centro: { slug: t.slug, nombre: t.nombre },
      accessToken: await this.jwt.signAsync({
        sub: usuario.id,
        tid: t.id,
        rol: usuario.rol,
      }),
      usuario,
    };
  }

  private async aCentro(t: FilaCentro, mes: Mes): Promise<CentroDto> {
    const numeros = await TenantContext.runAs(t.id, () => this.delMes(mes));
    return {
      slug: t.slug,
      nombre: t.nombre,
      activo: t.activo,
      createdAt: t.createdAt,
      plan: planVigente(t),
      suscripcionEstado: t.suscripcionMpId ? t.suscripcionEstado : null,
      pagoHasta: t.planPagoHasta,
      mercadoPago: !t.cuentaMercadoPago
        ? 'sin_conectar'
        : t.cuentaMercadoPago.requiereReconexion
          ? 'requiere_reconexion'
          : 'conectada',
      servicios: t._count.servicios,
      clientas: t._count.clientes,
      ...numeros,
    };
  }

  /** Los numeros del mes del centro en contexto. */
  private async delMes(mes: Mes) {
    const [turnosDelMes, cobros] = await Promise.all([
      this.db.reserva.count({
        where: { fecha: mes.dias, estado: { not: 'cancelada' } },
      }),
      this.db.pago.aggregate({
        where: {
          estado: { in: ['aprobado', 'reembolsado'] },
          aprobadoAt: mes.instantes,
        },
        _sum: { montoCentavos: true, reembolsadoCentavos: true },
      }),
    ]);
    return {
      turnosDelMes,
      cobradoDelMesCentavos:
        (cobros._sum.montoCentavos ?? 0) -
        (cobros._sum.reembolsadoCentavos ?? 0),
    };
  }
}
