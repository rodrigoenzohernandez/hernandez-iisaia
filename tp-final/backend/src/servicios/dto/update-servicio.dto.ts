import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { CreateServicioDto } from './create-servicio.dto.js';

/**
 * PATCH parcial. Suma `activo`, que es como se da de baja: no hay DELETE, porque un DELETE
 * tras el cual el recurso sigue existiendo es un contrato mentiroso.
 */
export class UpdateServicioDto extends PartialType(
  // cancelacionHorasAntes se redeclara abajo: PartialType le agregaria IsOptional, que deja
  // pasar null, y null en esa columna es un 500 en vez de un 400.
  OmitType(CreateServicioDto, ['cancelacionHorasAntes'] as const),
) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Hasta cuantas horas antes la clienta cancela con reembolso total. */
  @ValidateIf(
    (o: { cancelacionHorasAntes?: unknown }) =>
      o.cancelacionHorasAntes !== undefined,
  )
  @Type(() => Number)
  @IsInt({ message: 'Las horas para cancelar son un entero.' })
  @Min(0, { message: 'Las horas para cancelar no pueden ser negativas.' })
  @Max(720, { message: 'Las horas para cancelar no pueden pasar de 720.' })
  cancelacionHorasAntes?: number;
}
