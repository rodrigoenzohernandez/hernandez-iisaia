import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { PedirCodigoDto } from './pedir-codigo.dto.js';

/** El email del pedido de codigo, con la misma normalizacion, y el codigo que llego. */
export class CrearSesionClienteDto extends PedirCodigoDto {
  /** Los seis digitos que llegaron por mail. */
  @ApiProperty({ example: '482913' })
  @Matches(/^\d{6}$/, { message: 'El codigo son seis digitos.' })
  codigo!: string;
}
