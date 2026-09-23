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
import { recortar, SiVino } from '../../common/transforms.js';

export class CreateServicioDto {
  /** Nombre del tratamiento. Unico dentro del centro. */
  @IsString()
  @Transform(recortar)
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

  @SiVino()
  @IsBoolean()
  requiereValoracion?: boolean;

  /**
   * Hasta cuantas horas antes del turno la clienta puede reprogramar sola, sin costo. null
   * apaga la reprogramacion por autogestion; el centro puede reprogramar siempre.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Las horas para reprogramar son un entero.' })
  @Min(0, { message: 'Las horas para reprogramar no pueden ser negativas.' })
  @Max(720, { message: 'Las horas para reprogramar no pueden pasar de 720.' })
  reprogramacionHorasAntes?: number | null;

  /** Hasta cuantas horas antes la clienta cancela con reembolso total. */
  @SiVino()
  @Type(() => Number)
  @IsInt({ message: 'Las horas para cancelar son un entero.' })
  @Min(0, { message: 'Las horas para cancelar no pueden ser negativas.' })
  @Max(720, { message: 'Las horas para cancelar no pueden pasar de 720.' })
  cancelacionHorasAntes?: number;
}
