import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CursorPageQueryDto {
  /** Cuantos elementos devolver como maximo en esta pagina. */
  @IsOptional()
  // @Type explicito y no enableImplicitConversion global: convertir todo implicitamente
  // hace que cualquier string no vacio se vuelva true en un campo booleano.
  @Type(() => Number)
  @IsInt({ message: 'limit tiene que ser un numero entero.' })
  @Min(1, { message: 'limit tiene que ser 1 o mas.' })
  @Max(100, { message: 'limit no puede ser mayor a 100.' })
  limit: number = 20;

  /** El nextCursor que devolvio la pagina anterior. Es opaco: mandalo tal cual. */
  @IsOptional()
  @IsString()
  // Es input publico que se decodifica y se parsea: sin tope, `?cursor=<2MB>` es un
  // JSON.parse gigante gratis y sin token. 512 y no 200 porque el cursor del catalogo
  // codifica el nombre del tratamiento, y un nombre largo en UTF-8 pasaba el tope anterior.
  @MaxLength(512, { message: 'Ese cursor no es valido.' })
  cursor?: string;
}

/** Una pagina de resultados. `nextCursor` en null significa que era la ultima. */
export class CursorPageDto<T = unknown> {
  // El generico se borra en compilacion, asi que el plugin de Swagger infiere `data` como un
  // array de CursorPageDto y detecta una dependencia circular. Este esquema generico corta el
  // ciclo; el tipo real de cada item lo pone @ApiCursorPage(Modelo) con un allOf.
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  data!: T[];

  /** Pasalo como `cursor` para pedir la pagina siguiente. null = era la ultima. */
  @ApiProperty({ type: String, nullable: true, example: null })
  nextCursor!: string | null;
}
