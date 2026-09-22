import { ApiProperty } from '@nestjs/swagger';

export class SlotDto {
  /** Hora de inicio, en hora de pared del centro. */
  @ApiProperty({ example: '09:45' })
  hora!: string;

  /**
   * Cupos que quedan en ese horario. 0 significa lleno: el horario se devuelve igual para
   * que el front lo pinte en gris, como hace el prototipo.
   */
  @ApiProperty({ example: 1 })
  cuposDisponibles!: number;
}

export class DisponibilidadDto {
  @ApiProperty({ example: '2026-10-05' })
  fecha!: string;

  data!: SlotDto[];
}
