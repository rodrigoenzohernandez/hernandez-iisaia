import { ApiProperty } from '@nestjs/swagger';

export class ReservaDto {
  id!: string;

  @ApiProperty({ example: '2026-10-05' })
  fecha!: string;

  @ApiProperty({ example: '09:45' })
  horaInicio!: string;

  @ApiProperty({ example: '10:30' })
  horaFin!: string;

  /** `pendiente`, `confirmada` o `cancelada`. */
  @ApiProperty({ example: 'confirmada' })
  estado!: string;

  /** `efectivo` o `mercadopago`. */
  @ApiProperty({ example: 'efectivo' })
  metodoPago!: string;

  /** Sena congelada al momento de reservar, en centavos. */
  @ApiProperty({ example: 540_000 })
  senaCentavos!: number;

  clienteNombre!: string;
  clienteEmail!: string;
  clienteTelefono!: string;
  notas!: string | null;

  servicioId!: string;
  createdAt!: Date;
}

export const reservaSelect = {
  id: true,
  fecha: true,
  horaInicio: true,
  horaFin: true,
  estado: true,
  metodoPago: true,
  senaCentavos: true,
  clienteNombre: true,
  clienteEmail: true,
  clienteTelefono: true,
  notas: true,
  servicioId: true,
  createdAt: true,
} as const;
