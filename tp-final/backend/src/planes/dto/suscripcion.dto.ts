import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { aEmail } from '../../common/transforms.js';

/** Los estados de una suscripcion en Mercado Pago. */
export const ESTADOS_DE_SUSCRIPCION = [
  'pending',
  'authorized',
  'paused',
  'cancelled',
] as const;

export class SuscripcionMpDto {
  @ApiProperty({ enum: Plan, example: 'profesional' })
  plan!: Plan;

  /** El estado en Mercado Pago. `pending` hasta que la administradora autoriza el cobro. */
  @ApiProperty({ enum: ESTADOS_DE_SUSCRIPCION, example: 'authorized' })
  estado!: string;

  /** Donde la administradora autoriza el cobro mensual. Solo mientras esta `pending`. */
  @ApiProperty({ type: String, nullable: true })
  url!: string | null;
}

export class SuscripcionDto {
  /** El plan que rige hoy. Sus limites salen de GET /planes. */
  @ApiProperty({ enum: Plan, example: 'basico' })
  plan!: Plan;

  /**
   * Hasta cuando esta pago el plan. Con la suscripcion activa hay 10 dias de gracia despues,
   * que cubren los reintentos de Mercado Pago si un cobro falla.
   */
  @ApiProperty({ type: Date, nullable: true })
  pagoHasta!: Date | null;

  /** La suscripcion en Mercado Pago. null si el centro nunca se suscribio. */
  @ApiProperty({ type: SuscripcionMpDto, nullable: true })
  suscripcion!: SuscripcionMpDto | null;
}

export class UpdateSuscripcionDto {
  @ApiProperty({ enum: Plan, example: 'profesional' })
  @IsEnum(Plan)
  plan!: Plan;

  /**
   * Solo si paga otra cuenta de Mercado Pago que la conectada: si no coincide con la que
   * autoriza, Mercado Pago rechaza el cobro. Default: el de la cuenta conectada del centro.
   */
  @ApiProperty({ required: false, example: 'pagos@lodelili.com' })
  @IsOptional()
  @Transform(aEmail)
  @IsEmail({}, { message: 'El email no es valido.' })
  @MaxLength(254)
  emailPagador?: string;
}
