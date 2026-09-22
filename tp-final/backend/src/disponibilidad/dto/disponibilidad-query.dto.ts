import { Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DisponibilidadQueryDto {
  /**
   * Dia a consultar, en hora de pared del centro.
   *
   * Regex y no @IsDateString: @IsDateString acepta "2026-10-05T14:00:00Z", y con eso el
   * template `${fecha}T00:00:00Z` produce un Invalid Date que entraria al where de Prisma y
   * daria un 500 en un endpoint publico en vez de un 400.
   */
  @ApiProperty({ example: '2026-10-05', description: 'Formato YYYY-MM-DD.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha tiene que tener formato YYYY-MM-DD.',
  })
  fecha!: string;
}
