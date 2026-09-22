import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { CursorPageDto } from './cursor-page.dto.js';

/**
 * Lo unico que el plugin de Swagger no puede inferir: los genericos. Sin esto,
 * CursorPageDto<ServicioDto> sale documentado como una lista de `object`.
 */
export const ApiCursorPage = <M extends Type<unknown>>(model: M) =>
  applyDecorators(
    ApiExtraModels(CursorPageDto, model),
    ApiOkResponse({
      description: 'Una pagina de resultados.',
      schema: {
        allOf: [
          { $ref: getSchemaPath(CursorPageDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );
