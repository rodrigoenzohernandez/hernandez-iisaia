import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Una franja de atencion. Es la representacion que viaja en los dos sentidos: el GET
 * devuelve estas y el PUT recibe estas mismas.
 *
 * No lleva `id` a proposito: es lo que hace idempotente al PUT. Si lo llevara,
 * deleteMany + createMany generaria ids nuevos en cada llamada y la segunda respuesta no
 * seria igual a la primera.
 */
export class VentanaAtencionDto {
  /** 1 lunes .. 7 domingo. Un dia sin franjas es un dia cerrado. */
  @ApiProperty({ example: 1, minimum: 1, maximum: 7 })
  @Type(() => Number)
  @IsInt({ message: 'diaSemana tiene que ser un entero de 1 a 7.' })
  @Min(1, { message: 'diaSemana va de 1 (lunes) a 7 (domingo).' })
  @Max(7, { message: 'diaSemana va de 1 (lunes) a 7 (domingo).' })
  diaSemana!: number;

  /** Hora de pared en que abre la franja, "HH:mm". */
  @ApiProperty({ example: '09:00' })
  @Matches(HORA, { message: 'horaInicio tiene que tener formato HH:mm.' })
  horaInicio!: string;

  /**
   * Minuto mas tardio en que un turno puede TERMINAR, no cuando se cierra la puerta.
   * Con 13:30 un tratamiento de 45 minutos llega a empezar 12:45.
   */
  @ApiProperty({ example: '13:30' })
  @Matches(HORA, { message: 'horaFin tiene que tener formato HH:mm.' })
  horaFin!: string;

  /** Separacion entre inicios de la grilla, en minutos. */
  @ApiProperty({ example: 45, minimum: 5, maximum: 240 })
  @Type(() => Number)
  @IsInt({ message: 'intervaloMinutos tiene que ser un entero.' })
  // El minimo es una barrera de seguridad, no una preferencia: con 0 el generador de grilla
  // entra en loop infinito, y se llega ahi desde un GET publico.
  @Min(5, { message: 'El intervalo minimo es de 5 minutos.' })
  @Max(240, { message: 'El intervalo maximo es de 240 minutos.' })
  intervaloMinutos!: number;

  /** Turnos simultaneos aceptados en esta franja. Mayor a 1 habilita el doble turno. */
  @ApiProperty({ example: 1, minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsInt({ message: 'capacidad tiene que ser un entero.' })
  @Min(1, { message: 'La capacidad minima es 1.' })
  @Max(20, { message: 'La capacidad maxima es 20.' })
  capacidad!: number;
}

export const ventanaSelect = {
  diaSemana: true,
  horaInicio: true,
  horaFin: true,
  intervaloMinutos: true,
  capacidad: true,
} as const;
