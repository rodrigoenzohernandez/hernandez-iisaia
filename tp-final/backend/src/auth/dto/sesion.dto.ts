import { ApiProperty } from '@nestjs/swagger';

export class UsuarioSesionDto {
  id!: string;
  nombre!: string;
  /** Siempre `admin` en el MVP. */
  rol!: string;
}

export class SesionDto {
  /** JWT para el header `Authorization: Bearer <token>`. */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  usuario!: UsuarioSesionDto;
}
