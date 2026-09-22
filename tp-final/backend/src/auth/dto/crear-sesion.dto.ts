import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CrearSesionDto {
  /** Email de la persona administradora del centro. */
  @ApiProperty({ example: 'admin@ejemplo.test' })
  @IsEmail({}, { message: 'El email no es valido.' })
  email!: string;

  /** Su contrasena. */
  @IsString()
  @Length(1, 200, { message: 'La contrasena es obligatoria.' })
  password!: string;
}
