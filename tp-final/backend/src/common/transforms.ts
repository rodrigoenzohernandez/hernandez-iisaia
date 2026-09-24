import type { TransformFnParams } from 'class-transformer';
import { ValidateIf } from 'class-validator';

/**
 * Email en minuscula y sin espacios. No es cosmetico: es la clave con la que se identifica a
 * una clienta y se detecta el doble submit, y sin esto "Ana@Example.com " y
 * "ana@example.com" pasan como dos personas distintas.
 */
export const aEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Texto sin los espacios de las puntas. */
export const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Un booleano de la query string: llega como texto, y cualquier string no vacio seria true. */
export const aBooleano = ({ value }: TransformFnParams): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

/**
 * Valida el campo solo si vino. Es IsOptional sin su agujero: IsOptional tambien deja pasar
 * null, y en una columna que no lo acepta un null es un 500, o en una reserva, un estado null
 * que cae en confirmar.
 */
export const SiVino = () =>
  ValidateIf((_: unknown, valor: unknown) => valor !== undefined);
