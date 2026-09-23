import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoReserva, MetodoPago, type Prisma } from '@prisma/client';
import { ClientesService } from '../clientes/clientes.service.js';
import type { TenantRequest, UsuarioRequest } from '../common/decorators.js';
import {
  aDate,
  aFecha,
  aHora,
  aMinutos,
  ahoraEn,
  demasiadoTarde,
  DIAS_MAX_A_FUTURO,
  diaSemanaISO,
  esFechaReal,
  minutosHasta,
  ocupacionMaxima,
  sumarDias,
  ventanaDe,
} from '../common/horario.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import {
  avisoTurnoNuevo,
  turnoCancelado,
  turnoConfirmado,
} from '../notificaciones/plantillas.js';
import type { CursorPageDto } from '../common/pagination/cursor-page.dto.js';
import { paginate } from '../common/pagination/paginate.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { runSerializable } from '../prisma/run-serializable.js';
import { RECORDATORIO_MINUTOS } from './recordatorios.service.js';
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

/** Fila como la devuelve Prisma, con la fecha todavia como Date. */
type ReservaFila = Omit<ReservaDto, 'fecha'> & { fecha: Date };

/** La fecha sale como "YYYY-MM-DD", igual que entra. El wire es simetrico. */
const aDto = (fila: ReservaFila): ReservaDto => ({
  ...fila,
  fecha: aFecha(fila.fecha),
});

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

/** Los datos de contacto que quedan copiados en la reserva. */
type Contacto = { nombre: string; email: string; telefono: string };

@Injectable()
export class ReservasService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notificaciones: NotificacionesService,
    private readonly clientes: ClientesService,
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
      await this.clientes.asegurar(cuenta.email, { nombre, telefono });
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

    // Fuera de la transaccion a proposito: la duracion y la sena se congelan en la reserva,
    // asi que perder serializacion sobre ellas no cuesta nada, y la transaccion interactiva
    // queda en menos statements.
    const servicio = await this.db.servicio.findFirst({
      where: { id: dto.servicioId, activo: true },
      select: {
        id: true,
        nombre: true,
        duracionMinutos: true,
        senaCentavos: true,
      },
    });
    if (!servicio) {
      throw new NotFoundException({
        code: 'servicio_not_found',
        message: 'El tratamiento no esta disponible.',
      });
    }

    exigirFechaReal(dto.fecha);

    const ahora = ahoraEn(tenant.zonaHoraria);
    const pasado = cargaDelCentro
      ? minutosHasta(dto.fecha, dto.hora, ahora) < 0
      : demasiadoTarde(dto.fecha, dto.hora, ahora);
    if (pasado) {
      throw new ConflictException({
        code: 'past_date',
        message: 'Ese horario ya paso o esta demasiado cerca.',
      });
    }
    if (dto.fecha > sumarDias(ahora.fecha, DIAS_MAX_A_FUTURO)) {
      throw new BadRequestException({
        code: 'too_far_ahead',
        message: 'Todavia no se pueden reservar turnos tan lejanos.',
      });
    }

    const { clienteId, contacto } = await this.duenia(dto, usuario);
    const horaFin = aHora(aMinutos(dto.hora) + servicio.duracionMinutos);
    // Un turno que empieza en menos de 24 horas no necesita recordatorio: el mail de
    // confirmacion que sale ahora ya lo es.
    const sinRecordatorio =
      minutosHasta(dto.fecha, dto.hora, ahora) <= RECORDATORIO_MINUTOS;

    const reserva = await runSerializable(this.db, async (tx) => {
      // Leer las franjas DENTRO de la transaccion es lo que hace que un PUT de horarios
      // concurrente conflictue con este alta en vez de pisarla.
      const ventanas = await tx.ventanaAtencion.findMany({
        where: { diaSemana: diaSemanaISO(dto.fecha) },
      });
      const ventana = ventanaDe(ventanas, dto.hora, servicio.duracionMinutos);
      if (!ventana) {
        throw new ConflictException({
          code: 'outside_business_hours',
          message: 'Ese horario no esta dentro de la agenda de atencion.',
        });
      }

      // Ocupacion simultanea: toda reserva viva que se pise con [hora, horaFin).
      const solapadas = await tx.reserva.findMany({
        where: {
          fecha: aDate(dto.fecha),
          estado: { not: 'cancelada' },
          horaInicio: { lt: horaFin },
          horaFin: { gt: dto.hora },
        },
        select: { horaInicio: true, horaFin: true, clienteEmail: true },
      });

      // La misma funcion que usa la disponibilidad: contar cuantas reservas PISAN el turno
      // nuevo no es lo mismo que cuantas hay A LA VEZ, porque dos que lo pisan en momentos
      // distintos suman 2 sin que nunca haya 2 simultaneas. ocupacionMaxima ya incluye el
      // turno nuevo.
      const sinCupo =
        ocupacionMaxima(solapadas, dto.hora, horaFin) > ventana.capacidad;
      // Doble submit del formulario publico: con capacidad mayor a 1 entraban dos reservas
      // identicas de la misma persona.
      const duplicada = solapadas.some(
        (r) => r.horaInicio === dto.hora && r.clienteEmail === contacto.email,
      );
      // Un solo codigo para los dos casos: uno distinto para el duplicado dejaba averiguar,
      // sin token, si un email dado tiene turno a una hora dada.
      if (sinCupo || duplicada) {
        throw new ConflictException({
          code: 'slot_full',
          message: 'Ese horario ya no tiene cupo. Elegi otro.',
        });
      }

      const fila = await tx.reserva.create({
        data: {
          servicioId: servicio.id,
          clienteId,
          fecha: aDate(dto.fecha),
          horaInicio: dto.hora,
          // Calculados por el servidor, nunca por el cliente.
          horaFin,
          senaCentavos: servicio.senaCentavos,
          metodoPago: dto.metodoPago,
          // Efectivo confirma: la duenia cobra la sena en el local. Mercado Pago queda
          // pendiente hasta que exista la integracion real y alguien confirme el pago. La
          // carga del centro confirma siempre: el centro cobra como quiera.
          estado:
            cargaDelCentro || dto.metodoPago === MetodoPago.efectivo
              ? 'confirmada'
              : 'pendiente',
          // Copia, como la sena: si la clienta cambia su telefono, el turno de ayer conserva
          // el que dejo al reservar.
          clienteNombre: contacto.nombre,
          clienteEmail: contacto.email,
          clienteTelefono: contacto.telefono,
          notas: dto.notas ?? null,
          recordatorioEnviadoAt: sinRecordatorio ? new Date() : null,
        } as Prisma.ReservaUncheckedCreateInput,
        select: reservaSelect,
      });

      // Dentro de la transaccion: si SERIALIZABLE la reintenta, los mails se reintentan con
      // ella y no quedan duplicados.
      if (fila.estado === EstadoReserva.confirmada) {
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
      return aDto(fila);
    });
    this.notificaciones.despacharAhora();
    return reserva;
  }

  /** El listado del centro, o el de una sola clienta si viene clienteId. */
  async findAll(
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
    return { data: pagina.data.map(aDto), nextCursor: pagina.nextCursor };
  }

  /** Una reserva: la ve su duenia o la administracion. Para cualquier otra persona no existe. */
  async findOne(
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
    return fila ? aDto(fila) : reservaNoExiste();
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
  ): Promise<ReservaDto> {
    // `cancelada` es terminal. Sin eso, descancelar resucita una reserva sobre un cupo que ya
    // volvio a ocuparse: sobrecupo desde el panel, sin necesidad de concurrencia.
    const ORIGENES: Record<EstadoReservaDto, EstadoReserva[]> = {
      [EstadoReservaDto.confirmada]: [EstadoReserva.pendiente],
      [EstadoReservaDto.cancelada]: [
        EstadoReserva.pendiente,
        EstadoReserva.confirmada,
      ],
    };

    const { count, fila } = await this.db.$transaction(async (tx) => {
      // El estado esperado va en el WHERE y no en un if despues de leerlo: leer, validar en
      // memoria y escribir con where solo por id es un read-modify-write, y dos PATCH
      // simultaneos pasaban los dos. El UPDATE condicional es atomico.
      const { count } = await tx.reserva.updateMany({
        where: { id: reservaId, estado: { in: ORIGENES[dto.estado] } },
        data: { estado: dto.estado },
      });
      const fila = await tx.reserva.findFirst({
        where: { id: reservaId },
        select: { ...reservaSelect, servicio: { select: { nombre: true } } },
      });
      // El mail solo si el cambio ocurrio, y en la misma transaccion que el cambio.
      if (count > 0 && fila) {
        const datos = {
          centro: tenant.nombre,
          clienteNombre: fila.clienteNombre,
          servicio: fila.servicio.nombre,
          fecha: aFecha(fila.fecha),
          hora: fila.horaInicio,
        };
        await this.notificaciones.encolar(
          tx,
          fila.clienteEmail,
          dto.estado === EstadoReservaDto.confirmada
            ? turnoConfirmado(datos)
            : turnoCancelado(datos),
        );
      }
      return { count, fila };
    });
    this.notificaciones.despacharAhora();
    if (!fila) reservaNoExiste();
    // La reserva existe pero el UPDATE no la alcanzo: estaba en un estado del que no se
    // puede salir hacia el pedido.
    if (count === 0) {
      throw new ConflictException({
        code: 'invalid_transition',
        message: `Una reserva ${fila.estado} no puede pasar a ${dto.estado}.`,
      });
    }
    const { servicio: _servicio, ...reserva } = fila;
    return aDto(reserva);
  }
}
