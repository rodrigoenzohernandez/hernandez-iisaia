import { env } from '../env.js';
import { crearCripto } from './cifrado.js';

/** Las firmas y el cifrado de la API, con la ENCRYPTION_KEY del entorno. */
export const cripto = crearCripto(env.encryptionKey);
