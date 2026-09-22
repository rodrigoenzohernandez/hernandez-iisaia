import { ApiProperty } from '@nestjs/swagger';

/**
 * El cuerpo de todos los errores de la API. Existe para que Swagger tipee los 4xx: el codigo
 * es un identificador de maquina en ingles y el mensaje es para una persona, en espanol.
 */
export class ErrorDto {
  @ApiProperty({ example: 'slot_full' })
  code!: string;

  @ApiProperty({ example: 'Ese horario ya no tiene cupo. Elegi otro.' })
  message!: string;
}
