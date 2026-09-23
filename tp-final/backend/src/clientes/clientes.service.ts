import { randomInt } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { cripto } from '../common/cripto.js';
import type { TenantRequest } from '../common/decorators.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { codigoAcceso } from '../notificaciones/plantillas.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  clienteSelect,
  type ClienteDto,
  type SesionClienteDto,
} from './dto/cliente.dto.js';
import type { CodigoPedidoDto } from './dto/pedir-codigo.dto.js';
import type { UpdateClienteDto } from './dto/update-cliente.dto.js';

const CODIGO_MINUTOS = 10;
const MAX_INTENTOS = 5;
/** Tope de codigos por email en la ventana: es lo que frena usar el alta como spam de mails. */
const MAX_CODIGOS = 3;
const VENTANA_CODIGOS_MINUTOS = 15;
const MAX_CODIGOS_POR_DIA = 10;

/**
 * La firma lleva el centro y el email ademas del codigo: la misma combinacion de seis digitos
 * en otra cuenta da otra firma.
 */
const firmaDe = (email: string, codigo: string): string =>
  cripto.firmar(`${TenantContext.require()}:${email}:${codigo}`);

@Injectable()
export class ClientesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async pedirCodigo(
    tenant: TenantRequest,
    email: string,
  ): Promise<CodigoPedidoDto> {
    const desde = (minutos: number) => ({
      email,
      createdAt: { gte: new Date(Date.now() - minutos * 60_000) },
    });
    const [recientes, delDia] = await Promise.all([
      this.db.codigoAcceso.count({ where: desde(VENTANA_CODIGOS_MINUTOS) }),
      this.db.codigoAcceso.count({ where: desde(24 * 60) }),
    ]);
    // Los intentos son por codigo, asi que el tope de codigos es el tope de adivinanzas: con
    // el diario, un email aguanta 50 intentos por dia y no 1440.
    // ponytail: tope blando. Dos pedidos simultaneos pueden pasarlo por uno; el throttler por
    // IP queda debajo.
    if (recientes >= MAX_CODIGOS || delDia >= MAX_CODIGOS_POR_DIA) {
      throw new HttpException(
        {
          code: 'too_many_codes',
          message:
            'Ya te mandamos varios codigos. Espera unos minutos y volve a pedir uno.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // randomInt es el CSPRNG de node:crypto; Math.random se puede predecir.
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiraAt = new Date(Date.now() + CODIGO_MINUTOS * 60_000);
    await this.db.$transaction(async (tx) => {
      await tx.codigoAcceso.create({
        data: {
          email,
          codigoHash: firmaDe(email, codigo),
          expiraAt,
        } as Prisma.CodigoAccesoUncheckedCreateInput,
      });
      // El mail vence con el codigo: despues se borra de la cola.
      await this.notificaciones.encolar(
        tx,
        email,
        codigoAcceso({
          centro: tenant.nombre,
          codigo,
          minutos: CODIGO_MINUTOS,
        }),
        expiraAt,
      );
    });
    this.notificaciones.despacharAhora();
    return { expiraEnMinutos: CODIGO_MINUTOS };
  }

  async ingresar(email: string, codigo: string): Promise<SesionClienteDto> {
    // Un solo error para todo: vencido, usado, inexistente, equivocado o sin intentos. Uno
    // distinto por caso le diria a quien prueba codigos cuando esta cerca.
    const invalido = new UnauthorizedException({
      code: 'invalid_code',
      message: 'El codigo no es valido o ya vencio. Pedi uno nuevo.',
    });

    // Solo vale el ultimo codigo pedido: pedir otro invalida el anterior.
    const ultimo = await this.db.codigoAcceso.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codigoHash: true, expiraAt: true, usadoAt: true },
    });
    if (!ultimo || ultimo.usadoAt || ultimo.expiraAt <= new Date()) {
      throw invalido;
    }

    // El intento se cuenta ANTES de comparar y con un UPDATE condicional: cinco intentos en
    // paralelo no pasan como uno solo.
    const { count } = await this.db.codigoAcceso.updateMany({
      where: { id: ultimo.id, usadoAt: null, intentos: { lt: MAX_INTENTOS } },
      data: { intentos: { increment: 1 } },
    });
    if (count === 0) throw invalido;
    if (!cripto.mismaFirma(ultimo.codigoHash, firmaDe(email, codigo))) {
      throw invalido;
    }

    // Marcarlo usado tambien es condicional: dos ingresos simultaneos con el mismo codigo,
    // entra uno.
    const usado = await this.db.codigoAcceso.updateMany({
      where: { id: ultimo.id, usadoAt: null },
      data: { usadoAt: new Date() },
    });
    if (usado.count === 0) throw invalido;

    const cliente = await this.asegurar(email);
    const accessToken = await this.jwt.signAsync(
      { sub: cliente.id, tid: TenantContext.require(), rol: 'cliente' },
      { expiresIn: '30d' },
    );
    return { accessToken, cliente };
  }

  /**
   * La clienta de ese email, creandola si no existe.
   *
   * Los datos solo COMPLETAN un perfil vacio: si una reserva sin cuenta pudiera pisarlos,
   * cualquiera le cambiaria el nombre a otra persona reservando con su email.
   */
  async asegurar(
    email: string,
    datos: { nombre?: string; telefono?: string } = {},
  ): Promise<ClienteDto> {
    const existente = await this.db.cliente.findFirst({
      where: { email },
      select: clienteSelect,
    });
    if (existente) {
      const faltan = {
        ...(!existente.nombre && datos.nombre ? { nombre: datos.nombre } : {}),
        ...(!existente.telefono && datos.telefono
          ? { telefono: datos.telefono }
          : {}),
      };
      if (Object.keys(faltan).length === 0) return existente;
      return this.db.cliente.update({
        where: { id: existente.id },
        data: faltan,
        select: clienteSelect,
      });
    }
    try {
      return await this.db.cliente.create({
        data: { email, ...datos } as Prisma.ClienteUncheckedCreateInput,
        select: clienteSelect,
      });
    } catch (e) {
      // Dos altas simultaneas del mismo email nuevo: la que pierde el unique usa la otra.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return this.db.cliente.findFirstOrThrow({
          where: { email },
          select: clienteSelect,
        });
      }
      throw e;
    }
  }

  async findMe(clienteId: string): Promise<ClienteDto> {
    const cliente = await this.db.cliente.findFirst({
      where: { id: clienteId },
      select: clienteSelect,
    });
    if (!cliente) {
      throw new NotFoundException({
        code: 'cliente_not_found',
        message: 'No encontramos tu cuenta. Volve a entrar.',
      });
    }
    return cliente;
  }

  async updateMe(
    clienteId: string,
    dto: UpdateClienteDto,
  ): Promise<ClienteDto> {
    await this.findMe(clienteId);
    return this.db.cliente.update({
      where: { id: clienteId },
      data: dto,
      select: clienteSelect,
    });
  }
}
