import { ApiProperty } from '@nestjs/swagger';

/**
 * Todos los codigos de error que puede devolver la API.
 *
 * Estan enumerados en el contrato porque son la logica de ramificacion de quien consume:
 * un generador de cliente los convierte en una union de strings y el front puede hacer un
 * switch exhaustivo. La lista es la union de todos los endpoints; cada operacion documenta
 * aparte que status devuelve.
 */
export const CODIGOS_DE_ERROR = [
  'validation_error', // el body o la query no pasan la validacion
  'invalid_cursor', // el cursor de paginacion no es uno que haya emitido esta API
  'invalid_credentials', // email o contrasena incorrectos
  'unauthenticated', // falta el token en una ruta de administracion
  'invalid_token', // el token no es valido o vencio
  'wrong_tenant', // el token es de otro centro
  'tenant_not_found', // el centro del path no existe o esta inactivo
  'servicio_not_found', // el tratamiento no existe, o esta inactivo y se pidio sin token
  'reserva_not_found', // la reserva no existe
  'servicio_name_taken', // ya hay un tratamiento con ese nombre en el centro
  'ventanas_superpuestas', // dos franjas del mismo dia se pisan
  'slot_full', // el horario no tiene cupo
  'outside_business_hours', // el horario no esta en la agenda de atencion
  'past_date', // el horario ya paso o esta demasiado cerca
  'too_far_ahead', // la fecha esta mas alla del tope de agenda
  'invalid_transition', // la reserva no puede pasar a ese estado
  'high_contention', // hubo demasiadas reservas simultaneas; se puede reintentar
] as const;

export type CodigoDeError = (typeof CODIGOS_DE_ERROR)[number];

/** El cuerpo de todos los errores de la API. */
export class ErrorDto {
  /** Identificador de maquina del error. Es el que conviene usar para ramificar. */
  @ApiProperty({ enum: CODIGOS_DE_ERROR, example: 'slot_full' })
  code!: CodigoDeError;

  /** Texto en espanol, listo para mostrarle a una persona. */
  @ApiProperty({ example: 'Ese horario ya no tiene cupo. Elegi otro.' })
  message!: string;
}
