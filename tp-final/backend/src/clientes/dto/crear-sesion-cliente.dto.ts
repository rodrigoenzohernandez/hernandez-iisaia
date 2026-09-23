import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { aEmail } from '../../common/transforms.js';

export class CrearSesionClienteDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(aEmail)
  @IsEmail({}, { message: 'El email no es valido.' })
  email!: string;

  /** Los seis digitos que llegaron por mail. */
  @ApiProperty({ example: '482913' })
  @Matches(/^\d{6}$/, { message: 'El codigo son seis digitos.' })
  codigo!: string;
}
