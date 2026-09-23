import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SesionDto } from '../../auth/dto/sesion.dto.js';
import { SLUG } from '../../common/slug.js';
import { aEmail, recortar } from '../../common/transforms.js';

export class AdministradoraDto {
  @ApiProperty({ example: 'Lucia Gomez' })
  @Transform(recortar)
  @IsString()
  @Length(1, 80)
  nombre!: string;

  @ApiProperty({ example: 'lucia@esteticaluz.com' })
  @Transform(aEmail)
  @IsEmail({}, { message: 'El email no es valido.' })
  @MaxLength(254)
  email!: string;

  /** De 12 a 128 caracteres. El tope existe para que un body gigante no ponga a trabajar a scrypt. */
  @IsString()
  @Length(12, 128, {
    message: 'La contrasena tiene que tener entre 12 y 128 caracteres.',
  })
  password!: string;
}

export class CrearCentroDto {
  @ApiProperty({ example: 'Estetica Luz' })
  @Transform(recortar)
  @IsString()
  @Length(2, 80)
  nombre!: string;

  /** Va en la URL del centro: minusculas, numeros y guiones, de 3 a 40 caracteres. */
  @ApiProperty({ example: 'estetica-luz' })
  @IsString()
  @Matches(SLUG, {
    message:
      'El slug va en minusculas, con numeros y guiones, de 3 a 40 caracteres.',
  })
  slug!: string;

  /** Quien da de alta el centro: queda como su administradora. */
  @ValidateNested()
  @Type(() => AdministradoraDto)
  admin!: AdministradoraDto;
}

export class CentroCreadoResumenDto {
  slug!: string;
  nombre!: string;
}

/** El centro nuevo y la sesion de su administradora, lista para entrar al panel. */
export class CentroCreadoDto extends SesionDto {
  centro!: CentroCreadoResumenDto;
}
