import { ApiProperty } from '@nestjs/swagger';

/** Lo que se cobra online de una reserva. */
export class CobroDto {
  /** La sena, o el precio total si se paga con Mercado Pago, en centavos. */
  @ApiProperty({ example: 540_000 })
  montoCentavos!: number;

  /** Lo que entro por Mercado Pago, aprobado. */
  @ApiProperty({ example: 540_000 })
  pagadoCentavos!: number;

  /** Lo que se devolvio. */
  @ApiProperty({ example: 0 })
  reembolsadoCentavos!: number;

  /** Hasta cuando se puede pagar; despues la reserva vence. null si ya no esta pendiente. */
  @ApiProperty({ type: Date, nullable: true })
  venceAt!: Date | null;

  /** El link de Mercado Pago al que se redirige para pagar. null si ya no esta pendiente. */
  @ApiProperty({ type: String, nullable: true })
  checkoutUrl!: string | null;
}

export class ReservaDto {
  id!: string;

  @ApiProperty({ example: '2026-10-05' })
  fecha!: string;

  @ApiProperty({ example: '09:45' })
  horaInicio!: string;

  @ApiProperty({ example: '10:30' })
  horaFin!: string;

  /** `pendiente` (esperando el pago), `confirmada`, `cancelada` o `ausente`. */
  @ApiProperty({ example: 'confirmada' })
  estado!: string;

  /** `clienta`, `centro` o `sistema` (vencio sin pagarse). null si no esta cancelada. */
  @ApiProperty({ type: String, nullable: true, example: null })
  canceladaPor!: string | null;

  /** `efectivo` o `mercadopago`. */
  @ApiProperty({ example: 'efectivo' })
  metodoPago!: string;

  /** Sena congelada al momento de reservar, en centavos. */
  @ApiProperty({ example: 540_000 })
  senaCentavos!: number;

  /** Precio congelado al momento de reservar, en centavos. */
  @ApiProperty({ example: 1_800_000 })
  precioCentavos!: number;

  /** El cobro online. null si no hay nada que pagar por Mercado Pago. */
  @ApiProperty({ type: CobroDto, nullable: true })
  cobro!: CobroDto | null;

  /** La politica que la clienta acepto al reservar. null: no puede reprogramar sola. */
  @ApiProperty({ type: Number, nullable: true, example: 24 })
  reprogramacionHorasAntes!: number | null;

  @ApiProperty({ example: 24 })
  cancelacionHorasAntes!: number;

  /**
   * Si la clienta puede reprogramarla sola ahora. Lo calcula el servidor con la hora del
   * centro, para que el front no tenga que hacer aritmetica de zonas horarias.
   */
  puedeReprogramar!: boolean;

  /** Si cancelarla ahora devuelve lo pagado. Fuera de plazo se pierde todo lo pagado. */
  puedeCancelarConReembolso!: boolean;

  clienteNombre!: string;
  clienteEmail!: string;
  clienteTelefono!: string;
  notas!: string | null;

  servicioId!: string;

  /** La clienta duenia del turno. Existe aunque haya reservado sin cuenta. */
  clienteId!: string;

  createdAt!: Date;
}

/** Lo unico que ve quien vuelve de pagar sin sesion: el estado, sin datos personales. */
export class EstadoReservaSoloDto {
  /** `pendiente`, `confirmada`, `cancelada` o `ausente`. */
  @ApiProperty({ example: 'confirmada' })
  estado!: string;
}

export const reservaSelect = {
  id: true,
  fecha: true,
  horaInicio: true,
  horaFin: true,
  estado: true,
  canceladaPor: true,
  metodoPago: true,
  senaCentavos: true,
  precioCentavos: true,
  montoOnlineCentavos: true,
  pagoVenceAt: true,
  checkoutUrl: true,
  reprogramacionHorasAntes: true,
  cancelacionHorasAntes: true,
  clienteNombre: true,
  clienteEmail: true,
  clienteTelefono: true,
  notas: true,
  servicioId: true,
  clienteId: true,
  createdAt: true,
  pagos: {
    select: { estado: true, montoCentavos: true, reembolsadoCentavos: true },
  },
} as const;
