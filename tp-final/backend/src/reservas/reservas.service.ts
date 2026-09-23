import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MetodoPago, type Prisma } from '@prisma/client';
import { ClientesService } from '../clientes/clientes.service.js';
import { CobrosService, MINUTOS_PARA_PAGAR } from '../cobros/cobros.service.js';
import { CuentasMercadoPagoService } from '../cobros/cuentas-mercadopago.service.js';
import type { TenantRequest, UsuarioRequest } from '../common/decorators.js';
import {
  aDate,
  aFecha,
  aHora,
  aMinutos,
  ahoraEn,
  demasiadoTarde,
  DIAS_MAX_A_FUTURO,
  esFechaReal,
  minutosHasta,
  sumarDias,
} from '../common/horario.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import { paginate } from '../common/pagination/paginate.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { PLANES } from '../planes/planes.js';
import {
  avisoCancelacion,
  avisoTurnoNuevo,
  datosDelTurno,
  turnoCancelado,
  turnoConfirmado,
  turnoDe,
  turnoReprogramado,
} from '../notificaciones/plantillas.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { runSerializable } from '../prisma/run-serializable.js';
import { exigirCupo, exigirTopeDelMes } from './cupo.js';
import type { CreateReservaDto } from './dto/create-reserva.dto.js';
import type { ListReservasQueryDto } from './dto/list-reservas-query.dto.js';
import {
  reservaSelect,
  type EstadoReservaSoloDto,
  type ReservaDto,
} from './dto/reserva.dto.js';
import {
  EstadoReservaDto,
  type UpdateReservaDto,
} from './dto/update-reserva.dto.js';
import { recordatorioEnviadoAt } from './recordatorios.service.js';

type Fila = Prisma.ReservaGetPayload<{ select: typeof reservaSelect }>;
type Ahora = { fecha: string; hora: string };

/**
 * Si faltan al menos `horas` para el turno. Es la regla de las dos politicas, y la usan las
 * banderas que ve el front y las acciones que la aplican: escritas por separado, el boton
 * podria decir una cosa y el PATCH hacer otra.
 */
const enPlazo = (
  r: { fecha: Date; horaInicio: string },
  horas: number | null,
  ahora: Ahora,
): boolean =>
  horas !== null &&
  minutosHasta(aFecha(r.fecha), r.horaInicio, ahora) >= horas * 60;

/**
 * La reserva como sale por la API. La fecha sale como "YYYY-MM-DD", igual que entra. El
 * cobro y las dos banderas se calculan aca, con la hora del centro: el front no tiene que
 * hacer aritmetica de zonas horarias para saber si muestra el boton de cancelar.
 */
function aDto(fila: Fila, ahora: Ahora): ReservaDto {
  const { pagos, montoOnlineCentavos, pagoVenceAt, checkoutUrl, ...resto } =
    fila;
  const suma = (
    lista: typeof pagos,
    campo: 'montoCentavos' | 'reembolsadoCentavos',
  ) => lista.reduce((s, p) => s + p[campo], 0);
  const entrados = pagos.filter(
    (p) => p.estado === 'aprobado' || p.estado === 'reembolsado',
  );
  const pagadoVigente = suma(
    pagos.filter((p) => p.estado === 'aprobado'),
    'montoCentavos',
  );
  const pendiente = fila.estado === 'pendiente';
  return {
    ...resto,
    fecha: aFecha(fila.fecha),
    cobro:
      montoOnlineCentavos > 0
        ? {
            montoCentavos: montoOnlineCentavos,
            pagadoCentavos: suma(entrados, 'montoCentavos'),
            reembolsadoCentavos: suma(pagos, 'reembolsadoCentavos'),
            venceAt: pendiente ? pagoVenceAt : null,
            checkoutUrl: pendiente ? checkoutUrl : null,
          }
        : null,
    puedeReprogramar:
      fila.estado === 'confirmada' &&
      enPlazo(fila, fila.reprogramacionHorasAntes, ahora),
    puedeCancelarConReembolso:
      fila.estado === 'confirmada' &&
      pagadoVigente > 0 &&
      enPlazo(fila, fila.cancelacionHorasAntes, ahora),
  };
}

/**
 * Rechaza una fecha que el regex del DTO acepta pero que no existe en el calendario.
 *
 * El regex deja pasar 2026-02-30 y 2026-10-00, y a Date le dan un rollover silencioso o un
 * Invalid Date que llega al where de Prisma y sale como 500 en vez de 400.
 */
function exigirFechaReal(fecha: string, campo = 'fecha'): void {
  if (!esFechaReal(fecha)) {
    throw new BadRequestException({
      code: 'validation_error',
      message: `El valor de ${campo} no es una fecha que exista.`,
    });
  }
}

function reservaNoExiste(): never {
  throw new NotFoundException({
    code: 'reserva_not_found',
    message: 'La reserva no existe.',
  });
}

function transicionInvalida(desde: string, hacia: string): never {
  throw new ConflictException({
    code: 'invalid_transition',
    message: `Una reserva ${desde} no puede pasar a ${hacia}.`,
  });
}

function soloElCentro(): never {
  throw new ForbiddenException({
    code: 'forbidden_role',
    message: 'Eso lo puede hacer solo el centro.',
  });
}

/**
 * Valida la fecha y hora de un turno nuevo o reprogramado. La carga del centro solo rechaza
 * el pasado: es la administradora anotando a alguien que esta en el mostrador.
 */
function exigirHorarioReservable(
  fecha: string,
  hora: string,
  ahora: Ahora,
  delCentro: boolean,
): void {
  exigirFechaReal(fecha);
  const pasado = delCentro
    ? minutosHasta(fecha, hora, ahora) < 0
    : demasiadoTarde(fecha, hora, ahora);
  if (pasado) {
    throw new ConflictException({
      code: 'past_date',
      message: 'Ese horario ya paso o esta demasiado cerca.',
    });
  }
  if (fecha > sumarDias(ahora.fecha, DIAS_MAX_A_FUTURO)) {
    throw new BadRequestException({
      code: 'too_far_ahead',
      message: 'Todavia no se pueden reservar turnos tan lejanos.',
    });
  }
}

/** Los datos de contacto que quedan copiados en la reserva. */
type Contacto = { nombre: string; email: string; telefono: string };

/** Lo que se lee de una reserva para cambiarla y avisarlo por mail. */
const delTurno = { ...datosDelTurno, estado: true, horaFin: true } as const;

@Injectable()
export class ReservasService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notificaciones: NotificacionesService,
    private readonly clientes: ClientesService,
    private readonly cuentas: CuentasMercadoPagoService,
    private readonly cobros: CobrosService,
  ) {}

  /**
   * De quien es el turno y con que datos de contacto, segun quien reserva.
   *
   * Sin sesion y en la carga del centro, los tres datos vienen en el body. Con sesion de
   * clienta, el email es el de la cuenta: aceptar otro en el body dejaria reservar a nombre
   * de otra persona desde una cuenta propia.
   */
  private async duenia(
    dto: CreateReservaDto,
    usuario?: UsuarioRequest,
  ): Promise<{ clienteId: string; contacto: Contacto }> {
    if (usuario?.rol === 'cliente') {
      const cuenta = await this.clientes.findMe(usuario.id);
      if (dto.clienteEmail && dto.clienteEmail !== cuenta.email) {
        throw new BadRequestException({
          code: 'validation_error',
          message: 'La reserva va a nombre del email de tu cuenta.',
        });
      }
      const nombre = dto.clienteNombre ?? cuenta.nombre;
      const telefono = dto.clienteTelefono ?? cuenta.telefono;
      if (!nombre || !telefono) {
        throw new BadRequestException({
          code: 'validation_error',
          message: 'Completa tu nombre y tu telefono para reservar.',
        });
      }
      // Completa el perfil si le faltaba algo; nunca pisa lo que ya tenia.
      if (!cuenta.nombre || !cuenta.telefono) {
        await this.clientes.asegurar(cuenta.email, { nombre, telefono });
      }
      return {
        clienteId: cuenta.id,
        contacto: { nombre, email: cuenta.email, telefono },
      };
    }

    if (!dto.clienteNombre || !dto.clienteEmail || !dto.clienteTelefono) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Faltan los datos de la clienta: nombre, email y telefono.',
      });
    }
    const cliente = await this.clientes.asegurar(dto.clienteEmail, {
      nombre: dto.clienteNombre,
      telefono: dto.clienteTelefono,
    });
    return {
      clienteId: cliente.id,
      contacto: {
        nombre: dto.clienteNombre,
        email: dto.clienteEmail,
        telefono: dto.clienteTelefono,
      },
    };
  }

  async create(
    tenant: TenantRequest,
    dto: CreateReservaDto,
    usuario?: UsuarioRequest,
  ): Promise<ReservaDto> {
    // La carga del centro es la administradora anotando a alguien que llamo o que esta en el
    // mostrador: nace confirmada, sin cobro online, y puede ser con menos anticipacion.
    const cargaDelCentro = usuario?.rol === 'admin';

    // Fuera de la transaccion a proposito: precio, sena y duracion se congelan en la
    // reserva, asi que perder serializacion sobre ellos no cuesta nada, y la transaccion
    // interactiva queda en menos statements.
    const servicio = await this.db.servicio.findFirst({
      where: { id: dto.servicioId, activo: true },
      select: {
        id: true,
        nombre: true,
        duracionMinutos: true,
        precioCentavos: true,
        senaCentavos: true,
        reprogramacionHorasAntes: true,
        cancelacionHorasAntes: true,
      },
    });
    if (!servicio) {
      throw new NotFoundException({
        code: 'servicio_not_found',
        message: 'El tratamiento no esta disponible.',
      });
    }

    const ahora = ahoraEn(tenant.zonaHoraria);
    exigirHorarioReservable(dto.fecha, dto.hora, ahora, cargaDelCentro);
    const plan = PLANES[tenant.plan];

    // Que se cobra online, y con que cuenta. Se decide antes de la transaccion: una llamada a
    // Mercado Pago no va nunca adentro. Sin el plan que lo incluye no se cobra online, aunque
    // la cuenta siga conectada.
    const mp =
      cargaDelCentro || !plan.cobroOnline
        ? null
        : await this.cuentas.delCentro(tenant.slug);
    let montoOnline = 0;
    if (!cargaDelCentro && dto.metodoPago === MetodoPago.mercadopago) {
      if (!mp) {
        throw new ConflictException({
          code: 'online_payment_unavailable',
          message:
            'Este centro no esta cobrando con Mercado Pago ahora. Elegi pagar en efectivo.',
        });
      }
      montoOnline = servicio.precioCentavos;
    } else if (mp) {
      // En efectivo se cobra online la sena, si el centro puede cobrar. Si no puede, el turno
      // entra sin sena, como en el MVP.
      montoOnline = servicio.senaCentavos;
    }
    const pagoVenceAt =
      montoOnline > 0
        ? new Date(Date.now() + MINUTOS_PARA_PAGAR * 60_000)
        : null;

    const { clienteId, contacto } = await this.duenia(dto, usuario);
    const horaFin = aHora(aMinutos(dto.hora) + servicio.duracionMinutos);

    const fila = await runSerializable(this.db, async (tx) => {
      await exigirTopeDelMes(tx, dto.fecha, tenant.plan);
      await exigirCupo(tx, {
        fecha: dto.fecha,
        hora: dto.hora,
        horaFin,
        email: contacto.email,
        plan: tenant.plan,
      });

      const fila = await tx.reserva.create({
        data: {
          servicioId: servicio.id,
          clienteId,
          fecha: aDate(dto.fecha),
          horaInicio: dto.hora,
          // Calculados por el servidor, nunca por el cliente.
          horaFin,
          senaCentavos: servicio.senaCentavos,
          precioCentavos: servicio.precioCentavos,
          montoOnlineCentavos: montoOnline,
          pagoVenceAt,
          // La politica que la clienta acepta, copiada como la sena.
          reprogramacionHorasAntes: servicio.reprogramacionHorasAntes,
          cancelacionHorasAntes: servicio.cancelacionHorasAntes,
          metodoPago: dto.metodoPago,
          // Con algo que cobrar online, espera el pago; si no, esta confirmada.
          estado: montoOnline > 0 ? 'pendiente' : 'confirmada',
          // Copia, como la sena: si la clienta cambia su telefono, el turno de ayer conserva
          // el que dejo al reservar.
          clienteNombre: contacto.nombre,
          clienteEmail: contacto.email,
          clienteTelefono: contacto.telefono,
          notas: dto.notas ?? null,
          recordatorioEnviadoAt: recordatorioEnviadoAt(dto.fecha, dto.hora, ahora),
        } as Prisma.ReservaUncheckedCreateInput,
        select: reservaSelect,
      });

      // Dentro de la transaccion: si SERIALIZABLE la reintenta, los mails se reintentan con
      // ella y no quedan duplicados. Una reserva pendiente no avisa nada: avisa el pago.
      if (fila.estado === 'confirmada') {
        const datos = {
          centro: tenant.nombre,
          clienteNombre: contacto.nombre,
          servicio: servicio.nombre,
          fecha: dto.fecha,
          hora: dto.hora,
        };
        await this.notificaciones.encolar(
          tx,
          contacto.email,
          turnoConfirmado(datos),
        );
        // El centro no necesita que le avisen de un turno que cargo el mismo.
        if (!cargaDelCentro) {
          await this.notificaciones.encolarAlCentro(
            tx,
            avisoTurnoNuevo({
              ...datos,
              clienteEmail: contacto.email,
              clienteTelefono: contacto.telefono,
              notas: dto.notas,
            }),
          );
        }
      }
      return fila;
    });

    // La respuesta sale de la fila recien escrita, sin volver a leerla: una reserva nueva no
    // tiene pagos, y el link de pago es el que devuelve Mercado Pago.
    let checkoutUrl = fila.checkoutUrl;
    if (mp && pagoVenceAt) {
      ({ checkoutUrl } = await this.cobros.iniciarCobro(tenant, mp, {
        id: fila.id,
        montoOnlineCentavos: montoOnline,
        pagoVenceAt,
        clienteEmail: contacto.email,
        servicio: servicio.nombre,
        esSena: dto.metodoPago === MetodoPago.efectivo,
      }));
    }
    if (fila.estado === 'confirmada') this.notificaciones.despacharAhora();
    return aDto({ ...fila, checkoutUrl }, ahora);
  }

  /** El listado del centro, o el de una sola clienta si viene clienteId. */
  async findAll(
    tenant: TenantRequest,
    query: ListReservasQueryDto,
    clienteId?: string,
  ): Promise<CursorPageDto<ReservaDto>> {
    // El regex del DTO deja pasar fechas que no existen, y desde ahi entran al where.
    if (query.desde) exigirFechaReal(query.desde, 'desde');
    if (query.hasta) exigirFechaReal(query.hasta, 'hasta');

    const filtros = {
      // Puesto por el servidor desde el token, nunca desde la query: "mis turnos" no puede
      // listar los de otra persona cambiando un parametro.
      ...(clienteId ? { clienteId } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.servicioId ? { servicioId: query.servicioId } : {}),
      ...(query.desde || query.hasta
        ? {
            fecha: {
              ...(query.desde ? { gte: aDate(query.desde) } : {}),
              ...(query.hasta ? { lte: aDate(query.hasta) } : {}),
            },
          }
        : {}),
    };

    // Las claves terminan en id: sin ese desempate el orden no es total, porque con
    // capacidad mayor a 1 hay reservas con la misma fecha y hora.
    const pagina = await paginate(query, ['fecha', 'horaInicio', 'id'], (p) =>
      this.db.reserva.findMany({
        where: { ...filtros, ...p.where },
        orderBy: p.orderBy,
        take: p.take,
        select: reservaSelect,
      }),
    );
    const ahora = ahoraEn(tenant.zonaHoraria);
    return {
      data: pagina.data.map((f) => aDto(f, ahora)),
      nextCursor: pagina.nextCursor,
    };
  }

  /** Una reserva: la ve su duenia o la administracion. Para cualquier otra persona no existe. */
  async findOne(
    tenant: TenantRequest,
    reservaId: string,
    usuario: UsuarioRequest,
  ): Promise<ReservaDto> {
    const fila = await this.db.reserva.findFirst({
      where: {
        id: reservaId,
        ...(usuario.rol === 'cliente' ? { clienteId: usuario.id } : {}),
      },
      select: reservaSelect,
    });
    return fila ? aDto(fila, ahoraEn(tenant.zonaHoraria)) : reservaNoExiste();
  }

  /** Solo el estado, sin datos personales: lo consulta quien vuelve de pagar sin sesion. */
  async estado(reservaId: string): Promise<EstadoReservaSoloDto> {
    const fila = await this.db.reserva.findFirst({
      where: { id: reservaId },
      select: { estado: true },
    });
    return fila ?? reservaNoExiste();
  }

  async update(
    tenant: TenantRequest,
    reservaId: string,
    dto: UpdateReservaDto,
    usuario: UsuarioRequest,
  ): Promise<ReservaDto> {
    const reprogramar = dto.fecha !== undefined || dto.hora !== undefined;
    if (reprogramar === (dto.estado !== undefined)) {
      throw new BadRequestException({
        code: 'validation_error',
        message:
          'Manda un estado nuevo, o una fecha y una hora nuevas: una de las dos.',
      });
    }
    if (reprogramar && (!dto.fecha || !dto.hora)) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Para reprogramar hacen falta la fecha y la hora.',
      });
    }
    if (
      dto.reembolsar !== undefined &&
      dto.estado !== EstadoReservaDto.cancelada
    ) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'reembolsar va solo al cancelar.',
      });
    }

    const clienta = usuario.rol === 'cliente';
    // Para una clienta, las reservas de otra persona no existen: el mismo 404 que un id
    // inventado.
    const existe = await this.db.reserva.findFirst({
      where: { id: reservaId, ...(clienta ? { clienteId: usuario.id } : {}) },
      select: { id: true },
    });
    if (!existe) reservaNoExiste();

    if (reprogramar) {
      await this.reprogramar(tenant, reservaId, dto.fecha!, dto.hora!, clienta);
    } else if (dto.estado === EstadoReservaDto.cancelada) {
      await this.cancelar(tenant, reservaId, clienta, dto.reembolsar);
    } else if (dto.estado === EstadoReservaDto.ausente) {
      if (clienta) soloElCentro();
      await this.marcarAusente(tenant, reservaId);
    } else {
      if (clienta) soloElCentro();
      await this.confirmar(tenant, reservaId);
    }
    this.notificaciones.despacharAhora();
    return this.findOne(tenant, reservaId, usuario);
  }

  /** El centro confirma a mano una reserva pendiente: por ejemplo, porque le pagaron de otra forma. */
  private async confirmar(
    tenant: TenantRequest,
    reservaId: string,
  ): Promise<void> {
    // SERIALIZABLE, como el alta: leer, validar y escribir es seguro porque dos PATCH o un
    // alta simultanea conflictuan en vez de pasar los dos.
    await runSerializable(this.db, async (tx) => {
      const r = await tx.reserva.findFirstOrThrow({
        where: { id: reservaId },
        select: { ...delTurno, pagoVenceAt: true },
      });
      if (r.estado !== 'pendiente') transicionInvalida(r.estado, 'confirmada');
      // Una pendiente cuyo pago vencio ya no retiene el cupo, y otra persona puede haberlo
      // tomado: confirmarla es volver a pedirlo.
      if (r.pagoVenceAt && r.pagoVenceAt <= new Date()) {
        await exigirCupo(tx, {
          fecha: aFecha(r.fecha),
          hora: r.horaInicio,
          horaFin: r.horaFin,
          excluirId: reservaId,
          plan: tenant.plan,
        });
      }
      await tx.reserva.update({
        where: { id: reservaId },
        data: { estado: 'confirmada' },
      });
      await this.notificaciones.encolar(
        tx,
        r.clienteEmail,
        turnoConfirmado(turnoDe(tenant.nombre, r)),
      );
    });
  }

  /**
   * Cancela. Si hay reembolso, la fila del reembolso nace en la misma transaccion y el pedido
   * a Mercado Pago sale despues del commit.
   *
   * La clienta no elige: en plazo se le devuelve todo, fuera de plazo se pierde todo. El
   * centro elige, y tiene que decirlo si hubo pago.
   */
  private async cancelar(
    tenant: TenantRequest,
    reservaId: string,
    clienta: boolean,
    reembolsar?: boolean,
  ): Promise<void> {
    if (clienta && reembolsar !== undefined) {
      throw new BadRequestException({
        code: 'validation_error',
        message:
          'El reembolso lo decide la politica de cancelacion del centro.',
      });
    }
    const ahora = ahoraEn(tenant.zonaHoraria);
    // SERIALIZABLE: un pago que se aprueba mientras se cancela no puede quedar sin decidir.
    // O lo ve esta transaccion y lo reembolsa, o lo ve el webhook con la reserva ya
    // cancelada y lo devuelve.
    await runSerializable(this.db, async (tx) => {
      const r = await tx.reserva.findFirstOrThrow({
        where: { id: reservaId },
        select: { ...delTurno, cancelacionHorasAntes: true },
      });
      if (r.estado !== 'pendiente' && r.estado !== 'confirmada') {
        transicionInvalida(r.estado, 'cancelada');
      }
      const pagado = await this.cobros.pagado(tx, reservaId);
      let devolver: boolean;
      if (clienta) {
        devolver = enPlazo(r, r.cancelacionHorasAntes, ahora);
      } else {
        if (pagado > 0 && reembolsar === undefined) {
          throw new BadRequestException({
            code: 'validation_error',
            message:
              'Hubo un pago: indica si se reembolsa, con reembolsar true o false.',
          });
        }
        devolver = reembolsar ?? false;
      }

      await tx.reserva.update({
        where: { id: reservaId },
        data: {
          estado: 'cancelada',
          canceladaPor: clienta ? 'clienta' : 'centro',
          canceladaAt: new Date(),
        },
      });
      const reembolso = devolver
        ? await this.cobros.reembolsarTodo(tx, reservaId)
        : 0;
      const turno = turnoDe(tenant.nombre, r);
      await this.notificaciones.encolar(
        tx,
        r.clienteEmail,
        turnoCancelado({
          ...turno,
          pagadoCentavos: pagado,
          reembolsoCentavos: reembolso,
        }),
      );
      if (clienta) {
        await this.notificaciones.encolarAlCentro(
          tx,
          avisoCancelacion({ ...turno, reembolsoCentavos: reembolso }),
        );
      }
    });
    this.cobros.procesarReembolsosAhora(tenant);
  }

  /**
   * Mueve el turno a otra fecha y hora, con la misma validacion de cupo del alta.
   *
   * La clienta puede sola solo en plazo y sobre un turno confirmado; el centro, cuando
   * quiera. Lo pagado sigue con la reserva: reprogramar en plazo no cuesta nada.
   */
  private async reprogramar(
    tenant: TenantRequest,
    reservaId: string,
    fecha: string,
    hora: string,
    clienta: boolean,
  ): Promise<void> {
    const ahora = ahoraEn(tenant.zonaHoraria);
    exigirHorarioReservable(fecha, hora, ahora, !clienta);

    await runSerializable(this.db, async (tx) => {
      const r = await tx.reserva.findFirstOrThrow({
        where: { id: reservaId },
        select: { ...delTurno, reprogramacionHorasAntes: true },
      });
      if (clienta) {
        if (
          r.estado !== 'confirmada' ||
          !enPlazo(r, r.reprogramacionHorasAntes, ahora)
        ) {
          throw new ConflictException({
            code: 'reschedule_not_allowed',
            message:
              'Este turno ya no se puede reprogramar por tu cuenta. Escribile al centro.',
          });
        }
      } else if (r.estado !== 'pendiente' && r.estado !== 'confirmada') {
        throw new ConflictException({
          code: 'reschedule_not_allowed',
          message: `Una reserva ${r.estado} no se reprograma.`,
        });
      }

      // La duracion reservada, no la del servicio de hoy: es una copia, como la sena.
      const duracion = aMinutos(r.horaFin) - aMinutos(r.horaInicio);
      const horaFin = aHora(aMinutos(hora) + duracion);
      // Moverlo dentro del mismo mes no cambia cuantos turnos tiene el mes: el tope se mira
      // solo si cambia de mes.
      if (fecha.slice(0, 7) !== aFecha(r.fecha).slice(0, 7)) {
        await exigirTopeDelMes(tx, fecha, tenant.plan);
      }
      await exigirCupo(tx, {
        fecha,
        hora,
        horaFin,
        excluirId: reservaId,
        plan: tenant.plan,
      });
      await tx.reserva.update({
        where: { id: reservaId },
        data: {
          fecha: aDate(fecha),
          horaInicio: hora,
          horaFin,
          // El recordatorio vuelve a salir para el horario nuevo, salvo que ya este cerca.
          recordatorioEnviadoAt: recordatorioEnviadoAt(fecha, hora, ahora),
        },
      });
      await this.notificaciones.encolar(
        tx,
        r.clienteEmail,
        turnoReprogramado({
          ...turnoDe(tenant.nombre, r),
          fecha,
          hora,
          fechaAnterior: aFecha(r.fecha),
          horaAnterior: r.horaInicio,
        }),
      );
    });
  }

  /** No vino. Lo marca el centro despues de la hora del turno; lo pagado no se devuelve. */
  private async marcarAusente(
    tenant: TenantRequest,
    reservaId: string,
  ): Promise<void> {
    const r = await this.db.reserva.findFirstOrThrow({
      where: { id: reservaId },
      select: { estado: true, fecha: true, horaInicio: true },
    });
    if (r.estado !== 'confirmada') transicionInvalida(r.estado, 'ausente');
    const ahora = ahoraEn(tenant.zonaHoraria);
    if (minutosHasta(aFecha(r.fecha), r.horaInicio, ahora) > 0) {
      throw new ConflictException({
        code: 'too_early_for_no_show',
        message: 'Todavia no llego la hora del turno.',
      });
    }
    const { count } = await this.db.reserva.updateMany({
      where: { id: reservaId, estado: 'confirmada' },
      data: { estado: 'ausente' },
    });
    if (count === 0) transicionInvalida('cambiada', 'ausente');
  }
}
