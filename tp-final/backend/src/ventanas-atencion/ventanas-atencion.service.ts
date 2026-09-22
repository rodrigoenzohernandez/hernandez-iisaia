import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DB, type Db } from '../prisma/prisma.module.js';
import { runSerializable } from '../prisma/run-serializable.js';
import type {
  ReplaceVentanasDto,
  VentanasAtencionDto,
} from './dto/replace-ventanas.dto.js';
import {
  ventanaSelect,
  type VentanaAtencionDto,
} from './dto/ventana-atencion.dto.js';

const ORDEN = [{ diaSemana: 'asc' }, { horaInicio: 'asc' }] as const;

@Injectable()
export class VentanasAtencionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findAll(): Promise<VentanasAtencionDto> {
    // Sin paginar: son 84 filas como maximo y es configuracion. Paginar config es ceremonia.
    return {
      data: await this.db.ventanaAtencion.findMany({
        orderBy: [...ORDEN],
        select: ventanaSelect,
      }),
    };
  }

  async replaceAll(dto: ReplaceVentanasDto): Promise<VentanasAtencionDto> {
    this.validar(dto.data);

    // SERIALIZABLE tambien aca, y no solo en el alta de reservas: en READ COMMITTED dos PUT
    // concurrentes dejarian la UNION de las dos colecciones, y un alta podria reservar
    // contra una franja ya borrada. SSI solo detecta el conflicto si las dos transacciones
    // son SERIALIZABLE.
    return runSerializable(this.db, async (tx) => {
      // El where lo pone la extension: nunca borra las franjas de otro centro.
      await tx.ventanaAtencion.deleteMany({});
      // El tenantId lo sella la extension en runtime; el tipo generado lo exige igual.
      await tx.ventanaAtencion.createMany({
        data: dto.data as Prisma.VentanaAtencionCreateManyInput[],
      });
      return {
        data: await tx.ventanaAtencion.findMany({
          orderBy: [...ORDEN],
          select: ventanaSelect,
        }),
      };
    });
  }

  /**
   * Validacion de borde: sin esto, dos franjas pisadas dan dos capacidades para el mismo
   * horario y ventanaDe() devuelve la primera que matchea, que es un resultado arbitrario.
   */
  private validar(ventanas: VentanaAtencionDto[]): void {
    for (const v of ventanas) {
      if (v.horaFin <= v.horaInicio) {
        throw new BadRequestException({
          code: 'validation_error',
          message: `La franja del dia ${v.diaSemana} termina antes de empezar.`,
        });
      }
    }

    const porDia = new Map<number, VentanaAtencionDto[]>();
    for (const v of ventanas)
      porDia.set(v.diaSemana, [...(porDia.get(v.diaSemana) ?? []), v]);

    for (const [diaSemana, delDia] of porDia) {
      const ordenadas = [...delDia].sort((a, b) =>
        a.horaInicio.localeCompare(b.horaInicio),
      );
      for (let i = 1; i < ordenadas.length; i++) {
        // Comparacion lexicografica: valida porque las horas son "HH:mm" con cero a la
        // izquierda, y por eso el formato se valida en el DTO.
        if (ordenadas[i].horaInicio < ordenadas[i - 1].horaFin) {
          throw new ConflictException({
            code: 'ventanas_superpuestas',
            message: `Las franjas del dia ${diaSemana} se superponen.`,
          });
        }
      }
    }
  }
}
