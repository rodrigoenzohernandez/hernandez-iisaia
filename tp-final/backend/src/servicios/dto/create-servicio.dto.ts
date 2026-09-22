import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateServicioDto {
  /** Nombre del tratamiento. Unico dentro del centro. */
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(2, 80, {
    message: 'El nombre tiene que tener entre 2 y 80 caracteres.',
  })
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'La descripcion no puede pasar de 500 caracteres.',
  })
  descripcion?: string;

  /**
   * Duracion del turno en minutos.
   *
   * El minimo no es cosmetico: con 0, horaFin queda igual a horaInicio, el predicado de
   * solape no matchea nada y el control de capacidad queda desactivado.
   */
  @Type(() => Number)
  @IsInt({ message: 'La duracion tiene que ser un numero entero de minutos.' })
  @Min(5, { message: 'La duracion minima es de 5 minutos.' })
  @Max(600, { message: 'La duracion maxima es de 600 minutos.' })
  duracionMinutos!: number;

  /** Precio total en centavos. */
  @Type(() => Number)
  @IsInt({ message: 'El precio tiene que ser un entero en centavos.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  precioCentavos!: number;

  /** Sena en centavos. El service valida ademas que no supere al precio. */
  @Type(() => Number)
  @IsInt({ message: 'La sena tiene que ser un entero en centavos.' })
  @Min(0, { message: 'La sena no puede ser negativa.' })
  senaCentavos!: number;

  @IsOptional()
  @IsBoolean()
  requiereValoracion?: boolean;
}
