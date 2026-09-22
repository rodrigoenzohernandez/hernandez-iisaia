import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateServicioDto } from './create-servicio.dto.js';

/**
 * PATCH parcial. Suma `activo`, que es como se da de baja: no hay DELETE, porque un DELETE
 * tras el cual el recurso sigue existiendo es un contrato mentiroso.
 */
export class UpdateServicioDto extends PartialType(CreateServicioDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
