import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { aEmail } from '../../common/transforms.js';

export class CrearSesionDto {
  /**
   * Email de la persona administradora del centro. Se normaliza como en el alta del centro:
   * si no, quien se registro como "Lucia@..." no podria volver a entrar escribiendolo igual.
   */
  @ApiProperty({ example: 'admin@ejemplo.test' })
  @Transform(aEmail)
  @IsEmail({}, { message: 'El email no es valido.' })
  email!: string;

  /** Su contrasena. */
  @IsString()
  @Length(1, 200, { message: 'La contrasena es obligatoria.' })
  password!: string;
}
