import type { TransformFnParams } from 'class-transformer';

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
