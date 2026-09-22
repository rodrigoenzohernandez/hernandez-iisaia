import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { VentanaAtencionDto } from './ventana-atencion.dto.js';

/** El body del PUT: la semana completa. Mismo envoltorio que devuelve el GET. */
export class ReplaceVentanasDto {
  @IsArray()
  // 7 dias por, digamos, 12 franjas: mas que eso es un error de quien lo manda.
  @ArrayMaxSize(84, { message: 'Demasiadas franjas.' })
  @ValidateNested({ each: true })
  @Type(() => VentanaAtencionDto)
  data!: VentanaAtencionDto[];
}

export class VentanasAtencionDto {
  data!: VentanaAtencionDto[];
}
