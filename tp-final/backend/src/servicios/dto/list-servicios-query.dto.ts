import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CursorPageQueryDto } from '../../common/pagination/cursor-page.dto.js';
import { aBooleano } from '../../common/transforms.js';

export class ListServiciosQueryDto extends CursorPageQueryDto {
  /**
   * Filtra por estado. El front del cliente pide `activo=true`; el ABM no manda nada y ve
   * todo. Es un filtro comun y no un flag de autorizacion: un parametro que cambia el nivel
   * de acceso de una ruta publica es lo que se rompe en el segundo refactor.
   */
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'activo tiene que ser true o false.' })
  activo?: boolean;
}
