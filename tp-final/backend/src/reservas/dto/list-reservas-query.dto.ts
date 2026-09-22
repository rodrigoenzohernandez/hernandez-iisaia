import { EstadoReserva } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { CursorPageQueryDto } from '../../common/pagination/cursor-page.dto.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class ListReservasQueryDto extends CursorPageQueryDto {
  // El enum lo genera Prisma desde el schema.
  @IsOptional()
  @IsEnum(EstadoReserva, { message: 'estado no es un valor valido.' })
  estado?: EstadoReserva;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  servicioId?: string;

  /** Desde esta fecha, inclusive. */
  @IsOptional()
  @Matches(FECHA, { message: 'desde tiene que tener formato YYYY-MM-DD.' })
  desde?: string;

  /** Hasta esta fecha, inclusive. */
  @IsOptional()
  @Matches(FECHA, { message: 'hasta tiene que tener formato YYYY-MM-DD.' })
  hasta?: string;
}
