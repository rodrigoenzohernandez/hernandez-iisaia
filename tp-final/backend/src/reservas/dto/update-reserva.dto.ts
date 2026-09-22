import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Los estados a los que la administradora puede mover una reserva. */
export enum EstadoReservaDto {
  confirmada = 'confirmada',
  cancelada = 'cancelada',
}

export class UpdateReservaDto {
  /**
   * Nuevo estado. Transiciones validas: pendiente -> confirmada | cancelada,
   * confirmada -> cancelada. `cancelada` es terminal.
   */
  @ApiProperty({ enum: EstadoReservaDto, example: 'cancelada' })
  @IsEnum(EstadoReservaDto, {
    message: 'El estado tiene que ser confirmada o cancelada.',
  })
  estado!: EstadoReservaDto;
}
