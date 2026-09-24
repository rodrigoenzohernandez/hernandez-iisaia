import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** El estado de la conexion del centro con Mercado Pago. Nunca incluye los tokens. */
export class CuentaMercadoPagoDto {
  /** Si el centro tiene una cuenta conectada. */
  conectada!: boolean;

  /** El id de la cuenta en Mercado Pago. */
  @ApiProperty({ type: String, nullable: true, example: '111222' })
  mpUserId!: string | null;

  /** false con credenciales de prueba. */
  @ApiProperty({ type: Boolean, nullable: true })
  liveMode!: boolean | null;

  /** MP revoco el acceso: hasta reconectar, el centro no cobra online. */
  requiereReconexion!: boolean;

  @ApiProperty({ type: Date, nullable: true })
  conectadaAt!: Date | null;
}

export class AutorizacionDto {
  /** Adonde mandar a la administradora para que autorice. Vence a los 10 minutos. */
  @ApiProperty({
    example: 'https://auth.mercadopago.com/authorization?client_id=...',
  })
  url!: string;
}

/** Lo que la pagina de redirect del front recibio de Mercado Pago, tal cual. */
export class ConectarCuentaDto {
  @IsString()
  @Length(1, 512)
  code!: string;

  @IsString()
  @Length(1, 2048)
  state!: string;
}
