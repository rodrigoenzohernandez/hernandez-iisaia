import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, Matches } from 'class-validator';
import { SiVino } from '../../common/transforms.js';

// SiVino y no IsOptional: IsOptional deja pasar null, y aca un null no es "no vino". Un estado
// null caia en confirmar, y un reembolsar null cancelaba un turno pago sin devolver.

/** Los estados a los que se puede mover una reserva. */
export enum EstadoReservaDto {
  confirmada = 'confirmada',
  cancelada = 'cancelada',
  ausente = 'ausente',
}

/**
 * Un PATCH hace una de dos cosas, nunca las dos:
 *   - cambiar el estado: confirmar (el centro), cancelar (la clienta o el centro) o marcar
 *     ausente (el centro, despues de la hora del turno);
 *   - reprogramar: fecha y hora nuevas, juntas.
 */
export class UpdateReservaDto {
  /**
   * Transiciones validas: pendiente -> confirmada | cancelada, confirmada -> cancelada |
   * ausente. `cancelada` y `ausente` son terminales.
   */
  @ApiProperty({
    enum: EstadoReservaDto,
    required: false,
    example: 'cancelada',
  })
  @SiVino()
  @IsEnum(EstadoReservaDto, {
    message: 'El estado tiene que ser confirmada, cancelada o ausente.',
  })
  estado?: EstadoReservaDto;

  /**
   * Solo el centro, solo al cancelar: si se devuelve lo pagado. Obligatorio si hubo pago.
   * Para la clienta lo decide la politica del servicio.
   */
  @SiVino()
  @IsBoolean({ message: 'reembolsar es true o false.' })
  reembolsar?: boolean;

  /** Fecha nueva, para reprogramar. Va con `hora`. */
  @ApiProperty({ required: false, example: '2026-10-12' })
  @SiVino()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha tiene que tener formato YYYY-MM-DD.',
  })
  fecha?: string;

  /** Hora nueva, de la grilla del centro. Va con `fecha`. */
  @ApiProperty({ required: false, example: '15:00' })
  @SiVino()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'hora tiene que tener formato HH:mm.',
  })
  hora?: string;
}
