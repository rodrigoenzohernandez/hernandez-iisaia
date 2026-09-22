import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MetodoPago } from '@prisma/client';

/**
 * El alta publica de un turno. Los datos que pide el paso 3 del prototipo y nada mas:
 * ninguna contrasena, porque la clienta no tiene cuenta.
 *
 * Lo que NO esta y no puede estar: horaFin, senaCentavos y la duracion. Los calcula el
 * servidor desde el tratamiento. Un precio que manda el cliente es un bug de plata; una
 * duracion que manda el cliente es un HIFU de cinco minutos.
 */
export class CreateReservaDto {
  @IsString()
  @Length(1, 40)
  servicioId!: string;

  /** Dia del turno, en hora de pared del centro. */
  @ApiProperty({ example: '2026-10-05', description: 'Formato YYYY-MM-DD.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha tiene que tener formato YYYY-MM-DD.',
  })
  fecha!: string;

  /** Hora de inicio, tal como la devolvio el endpoint de disponibilidad. */
  @ApiProperty({
    example: '09:45',
    description: 'Formato HH:mm, de la grilla del centro.',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'hora tiene que tener formato HH:mm.',
  })
  hora!: string;

  // El enum lo genera Prisma desde el schema: mantener una copia local es una divergencia
  // esperando a pasar.
  @ApiProperty({ enum: MetodoPago, example: 'efectivo' })
  @IsEnum(MetodoPago, {
    message: 'El metodo de pago tiene que ser efectivo o mercadopago.',
  })
  metodoPago!: MetodoPago;

  /** Un solo campo, como el formulario del prototipo. */
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(2, 120, {
    message: 'El nombre tiene que tener entre 2 y 120 caracteres.',
  })
  clienteNombre!: string;

  // Se normaliza porque es la clave con la que se detecta el doble submit: sin esto,
  // "Ana@Example.com " y "ana@example.com" pasan como dos personas distintas.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El email no es valido.' })
  clienteEmail!: string;

  @IsString()
  @Length(6, 30, {
    message: 'El telefono tiene que tener entre 6 y 30 caracteres.',
  })
  clienteTelefono!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Las notas no pueden pasar de 500 caracteres.' })
  notas?: string;
}
