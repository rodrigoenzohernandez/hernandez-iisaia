import { ApiProperty } from '@nestjs/swagger';

export class ServicioDto {
  id!: string;

  /** Nombre del tratamiento. Unico dentro del centro. */
  nombre!: string;

  descripcion!: string | null;

  /** Cuanto dura el turno. Define cuantos inicios de grilla entran en cada franja. */
  duracionMinutos!: number;

  /** Precio total, en centavos. 1800000 son $18.000,00. */
  @ApiProperty({ example: 1_800_000 })
  precioCentavos!: number;

  /** Sena que se cobra al reservar, en centavos. Nunca mayor al precio. */
  @ApiProperty({ example: 540_000 })
  senaCentavos!: number;

  /** Si el tratamiento necesita una valoracion previa con el equipo. */
  requiereValoracion!: boolean;

  /** Un servicio inactivo no se puede reservar. La baja es logica. */
  activo!: boolean;
}

/** Los campos que devuelve la API. Ningun endpoint devuelve un modelo de Prisma completo. */
export const servicioSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  duracionMinutos: true,
  precioCentavos: true,
  senaCentavos: true,
  requiereValoracion: true,
  activo: true,
} as const;
