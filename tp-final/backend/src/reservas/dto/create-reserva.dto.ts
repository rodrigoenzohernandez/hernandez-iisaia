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
import { aEmail, recortar } from '../../common/transforms.js';

/**
 * El alta de un turno. La hacen tres personas distintas con el mismo body:
 *   - sin sesion, la clienta deja nombre, email y telefono, que son obligatorios;
 *   - con sesion de clienta, el email sale de la cuenta, y nombre y telefono del body o del
 *     perfil;
 *   - con sesion de administracion, el centro carga el turno a nombre de una clienta, y los
 *     tres datos son obligatorios.
 * Por eso el DTO los declara opcionales y el service exige cada caso.
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

  /** Un solo campo, como el formulario del prototipo. Obligatorio sin sesion de clienta. */
  @IsOptional()
  @IsString()
  @Transform(recortar)
  @Length(2, 120, {
    message: 'El nombre tiene que tener entre 2 y 120 caracteres.',
  })
  clienteNombre?: string;

  /**
   * La identidad de la clienta: la reserva queda asociada a este email aunque no tenga
   * cuenta. Obligatorio sin sesion de clienta; con sesion, sale de la cuenta.
   */
  @IsOptional()
  @Transform(aEmail)
  @IsEmail({}, { message: 'El email no es valido.' })
  clienteEmail?: string;

  /** Obligatorio sin sesion de clienta. */
  @IsOptional()
  @IsString()
  @Length(6, 30, {
    message: 'El telefono tiene que tener entre 6 y 30 caracteres.',
  })
  clienteTelefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Las notas no pueden pasar de 500 caracteres.' })
  notas?: string;
}
