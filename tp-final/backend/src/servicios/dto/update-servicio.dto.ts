import { PartialType } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { SiVino } from '../../common/transforms.js';
import { CreateServicioDto } from './create-servicio.dto.js';

/**
 * PATCH parcial. Suma `activo`, que es como se da de baja: no hay DELETE, porque un DELETE
 * tras el cual el recurso sigue existiendo es un contrato mentiroso.
 *
 * skipNullProperties en false: el PartialType de siempre agrega IsOptional, que deja pasar
 * null, y un null en una columna que no lo acepta es un 500 en vez de un 400. Los campos donde
 * null significa algo, como reprogramacionHorasAntes, lo siguen aceptando por su IsOptional.
 */
export class UpdateServicioDto extends PartialType(CreateServicioDto, {
  skipNullProperties: false,
}) {
  @SiVino()
  @IsBoolean()
  activo?: boolean;
}
