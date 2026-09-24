import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearSesionDto } from '../../auth/dto/crear-sesion.dto.js';
import { CursorPageQueryDto } from '../../common/pagination/cursor-page.dto.js';
import { aBooleano } from '../../common/transforms.js';
import { ESTADOS_DE_SUSCRIPCION } from '../../planes/dto/suscripcion.dto.js';

/** El mismo login que el de un centro, con su normalizacion del email. */
export class CrearSesionPlataformaDto extends CrearSesionDto {}

export class SuperadminDto {
  id!: string;
  nombre!: string;
  email!: string;
}

export class SesionPlataformaDto {
  /** JWT para el header `Authorization: Bearer <token>`. Vale solo en /plataforma. */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  superadmin!: SuperadminDto;
}

export class ListCentrosQueryDto extends CursorPageQueryDto {
  /** Solo los activos, o solo los dados de baja. Sin el filtro, todos. */
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'activo tiene que ser true o false.' })
  activo?: boolean;
}

export class CentroDto {
  @ApiProperty({ example: 'lo-de-lili' })
  slug!: string;
  nombre!: string;
  activo!: boolean;
  /** Cuando se dio de alta. */
  createdAt!: Date;

  /** El plan que rige hoy. */
  @ApiProperty({ enum: Plan })
  plan!: Plan;

  /** El estado de la suscripcion en Mercado Pago. null si nunca se suscribio. */
  @ApiProperty({
    type: String,
    nullable: true,
    enum: ESTADOS_DE_SUSCRIPCION,
  })
  suscripcionEstado!: string | null;

  /** Hasta cuando esta pago el plan. */
  @ApiProperty({ type: Date, nullable: true })
  pagoHasta!: Date | null;

  /** Si el centro cobra con Mercado Pago. */
  @ApiProperty({ enum: ['conectada', 'requiere_reconexion', 'sin_conectar'] })
  mercadoPago!: 'conectada' | 'requiere_reconexion' | 'sin_conectar';

  servicios!: number;
  clientas!: number;
  /** Turnos del mes en curso, por la fecha del turno y sin los cancelados. */
  turnosDelMes!: number;
  /** Lo cobrado online en el mes en curso, sin lo que ya se devolvio de esos pagos. */
  cobradoDelMesCentavos!: number;
}

export class PorPlanDto {
  basico!: number;
  profesional!: number;
}

export class ResumenDto {
  /** El mes de los numeros, en la hora de Argentina. */
  @ApiProperty({ example: '2026-09' })
  mes!: string;
  centros!: number;
  centrosActivos!: number;
  /** Los que se dieron de alta en el mes. */
  centrosNuevos!: number;
  /** Los centros activos, por plan vigente. */
  porPlan!: PorPlanDto;
  /** Suscripciones autorizadas por el precio del plan: lo que se espera cobrar por mes. */
  ingresoMensualCentavos!: number;
  turnosDelMes!: number;
  cobradoDelMesCentavos!: number;
}

export class UpdateCentroDto {
  /** false da de baja el centro: sus rutas responden 404 y deja de tomar turnos. */
  @IsBoolean()
  activo!: boolean;
}
