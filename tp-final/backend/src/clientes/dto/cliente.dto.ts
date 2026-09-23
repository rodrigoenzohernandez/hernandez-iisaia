import { ApiProperty } from '@nestjs/swagger';

export class ClienteDto {
  id!: string;

  /** La identidad de la clienta en el centro. No se cambia: es a donde llega el codigo. */
  @ApiProperty({ example: 'ana@example.com' })
  email!: string;

  /** null hasta que lo complete, reservando o desde el perfil. */
  nombre!: string | null;
  telefono!: string | null;
}

export const clienteSelect = {
  id: true,
  email: true,
  nombre: true,
  telefono: true,
} as const;

export class SesionClienteDto {
  /**
   * JWT para el header `Authorization: Bearer <token>`. Dura 30 dias: una clienta entra poco,
   * y cada ingreso le cuesta ir al mail a buscar el codigo.
   */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  cliente!: ClienteDto;
}
