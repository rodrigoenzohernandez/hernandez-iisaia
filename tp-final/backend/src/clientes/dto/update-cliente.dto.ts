import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { recortar } from '../../common/transforms.js';

/** Lo que la clienta puede editar de su perfil. El email no: es su identidad. */
export class UpdateClienteDto {
  @IsOptional()
  @IsString()
  @Transform(recortar)
  @Length(2, 120, {
    message: 'El nombre tiene que tener entre 2 y 120 caracteres.',
  })
  nombre?: string;

  @IsOptional()
  @IsString()
  @Length(6, 30, {
    message: 'El telefono tiene que tener entre 6 y 30 caracteres.',
  })
  telefono?: string;
}
