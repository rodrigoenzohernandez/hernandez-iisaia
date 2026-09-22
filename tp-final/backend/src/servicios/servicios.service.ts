import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/pagination/paginate.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import type { CreateServicioDto } from './dto/create-servicio.dto.js';
import type { ListServiciosQueryDto } from './dto/list-servicios-query.dto.js';
import { servicioSelect, type ServicioDto } from './dto/servicio.dto.js';
import type { UpdateServicioDto } from './dto/update-servicio.dto.js';

/** Violacion de unique. Aca solo puede ser (tenantId, nombre). */
const ES_DUPLICADO = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** La fila del update no existe, o existe en otro centro: desde afuera es lo mismo. */
const NO_ENCONTRADO = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';

// Declaraciones y no arrow functions: TS solo estrecha el tipo con `never` si la funcion
// es una declaracion.
function noExiste(): never {
  throw new NotFoundException({
    code: 'servicio_not_found',
    message: 'El tratamiento no existe.',
  });
}

function nombreEnUso(): never {
  throw new ConflictException({
    code: 'servicio_name_taken',
    message: 'Ya hay un tratamiento con ese nombre en este centro.',
  });
}

@Injectable()
export class ServiciosService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * `autenticada` decide el DEFAULT del filtro, no el significado de `?activo=`.
   *
   * Sin token se devuelven solo los activos: el catalogo publico no deberia ofrecer
   * tratamientos que, si se reservan, dan 404. Con token el default es ver todo, porque el
   * ABM necesita administrar los dados de baja. En los dos casos `?activo=` sigue siendo un
   * filtro comun que se respeta tal como viene.
   */
  findAll(
    query: ListServiciosQueryDto,
    autenticada: boolean,
  ): Promise<CursorPageDto<ServicioDto>> {
    const activo = query.activo ?? (autenticada ? undefined : true);
    return paginate(query, ['nombre', 'id'], (pagina) =>
      this.db.servicio.findMany({
        // El filtro del llamador y el del keyset se combinan; la extension suma el tenantId.
        where: { ...(activo === undefined ? {} : { activo }), ...pagina.where },
        orderBy: pagina.orderBy,
        take: pagina.take,
        select: servicioSelect,
      }),
    );
  }

  async findOne(servicioId: string, autenticada = true): Promise<ServicioDto> {
    const servicio = await this.db.servicio.findFirst({
      // Mismo criterio que el listado: sin token, un tratamiento dado de baja no existe.
      where: { id: servicioId, ...(autenticada ? {} : { activo: true }) },
      select: servicioSelect,
    });
    return servicio ?? noExiste();
  }

  async create(dto: CreateServicioDto): Promise<ServicioDto> {
    this.validarSena(dto.senaCentavos, dto.precioCentavos);
    try {
      return await this.db.servicio.create({
        // El tenantId lo sella la extension: no viaja en el DTO ni en la firma.
        data: dto as Prisma.ServicioUncheckedCreateInput,
        select: servicioSelect,
      });
    } catch (e) {
      if (ES_DUPLICADO(e)) nombreEnUso();
      throw e;
    }
  }

  async update(
    servicioId: string,
    dto: UpdateServicioDto,
  ): Promise<ServicioDto> {
    // Se necesita el estado actual para validar la sena cuando el PATCH manda solo uno de
    // los dos montos.
    const actual = await this.db.servicio.findFirst({
      where: { id: servicioId },
      select: { precioCentavos: true, senaCentavos: true },
    });
    if (!actual) noExiste();
    this.validarSena(
      dto.senaCentavos ?? actual.senaCentavos,
      dto.precioCentavos ?? actual.precioCentavos,
    );

    try {
      // Una sola llamada: el WhereUniqueInput de Prisma 7 es AtLeast<{...filtros...}, "id">,
      // asi que el tenantId que agrega la extension conviv con el id y no hace falta el
      // updateMany + findOne de antes.
      return await this.db.servicio.update({
        where: { id: servicioId },
        data: dto,
        select: servicioSelect,
      });
    } catch (e) {
      if (ES_DUPLICADO(e)) nombreEnUso();
      if (NO_ENCONTRADO(e)) noExiste();
      throw e;
    }
  }

  /**
   * Una sena mayor al precio es plata mal cobrada, y no hay CHECK en la base que lo frene.
   * Va en el service porque cruza dos campos: un validador de class-validator ve uno solo.
   */
  private validarSena(senaCentavos: number, precioCentavos: number): void {
    if (senaCentavos > precioCentavos) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'La sena no puede ser mayor al precio.',
      });
    }
  }
}
