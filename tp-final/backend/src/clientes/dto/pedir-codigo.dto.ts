import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { aEmail } from '../../common/transforms.js';

export class PedirCodigoDto {
  /** El email de la clienta. Si no tiene cuenta en el centro, se crea al entrar. */
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(aEmail)
  @IsEmail({}, { message: 'El email no es valido.' })
  email!: string;
}

export class CodigoPedidoDto {
  /** Cuanto tarda en vencer el codigo que se acaba de mandar. */
  @ApiProperty({ example: 10 })
  expiraEnMinutos!: number;
}
