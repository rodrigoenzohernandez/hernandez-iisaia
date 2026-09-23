/**
 * Los tipos de la libreria. Son chicos y estrictos a proposito: los del SDK tienen todo
 * opcional, y un proyecto que los usa directo termina con `?.` en cada linea.
 *
 * La plata va siempre en centavos enteros. La conversion a decimales vive en un solo lugar,
 * adentro de la libreria.
 */

/** Estado de un pago, normalizado. Los estados intermedios de MP se juntan en `pending`. */
export type PaymentStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'refunded'
  | 'cancelled'
  | 'charged_back'
  | 'disputed';

export type Payment = {
  id: string;
  /** El id propio que el proyecto le puso al cobro (`external_reference`). */
  reference: string | null;
  status: PaymentStatus;
  /** El detalle crudo de MP (`accredited`, `cc_rejected_insufficient_amount`...). */
  statusDetail: string | null;
  amountCents: number;
  refundedCents: number;
  /** `account_money`, `credit_card`, `debit_card`, `digital_currency`... */
  method: string | null;
  /** La cuenta de MP que cobro. */
  collectorId: string | null;
  approvedAt: Date | null;
};

export type CheckoutInput = {
  /** Id propio del cobro: vuelve en cada pago. Hasta 64 caracteres: letras, numeros, - y _. */
  reference: string;
  /** Lo que ve quien paga en la pagina de MP. */
  title: string;
  amountCents: number;
  currency?: string;
  payerEmail?: string;
  /** Despues de esto MP no acepta el pago. */
  expiresAt?: Date;
  /** Adonde vuelve quien paga. MP exige HTTPS. */
  backUrls?: { success: string; pending: string; failure: string };
  /**
   * Solo medios que se acreditan en el momento: saca Rapipago y Pago Facil, que dejarian el
   * cobro pendiente durante dias.
   */
  onlyInstantMethods?: boolean;
  /**
   * Aprobado o rechazado, sin "en proceso". Default true: sirve cuando algo queda retenido
   * esperando el pago, y MP avisa que baja un poco la tasa de aprobacion.
   */
  binaryMode?: boolean;
  /** Lo que aparece en el resumen de la tarjeta. MP corta a 13 caracteres. */
  statementDescriptor?: string;
  idempotencyKey?: string;
};

/** Un link de pago de Checkout Pro. */
export type Checkout = { id: string; url: string };

export type Refund = { id: string; status: string; amountCents: number };

export type SubscriptionStatus =
  'pending' | 'authorized' | 'paused' | 'cancelled';

export type SubscriptionInput = {
  /** Id propio de quien se suscribe: es lo que ata la suscripcion sin adivinar por email. */
  reference: string;
  /** Lo que ve quien paga, por ejemplo "Plan Profesional". */
  reason: string;
  amountCents: number;
  currency?: string;
  /** Tiene que ser el email de la cuenta de MP que paga: si no coincide, MP rechaza el cobro. */
  payerEmail: string;
  backUrl?: string;
  idempotencyKey?: string;
};

export type Subscription = {
  id: string;
  reference: string | null;
  status: SubscriptionStatus;
  amountCents: number;
  nextChargeAt: Date | null;
  /** Donde quien paga autoriza la suscripcion. null una vez autorizada. */
  url: string | null;
};

/** Un cobro mensual de una suscripcion (en MP, "authorized payment" o factura). */
export type SubscriptionCharge = {
  id: string;
  subscriptionId: string | null;
  /** `scheduled`, `processed`, `recycling` (reintentando) o `cancelled`. */
  status: string;
  /** El estado del pago de ese cobro, si ya se intento. */
  paymentStatus: PaymentStatus | null;
  chargedAt: Date | null;
};

/** Las credenciales de una cuenta que se conecto por OAuth. */
export type ConnectedAccount = {
  accessToken: string;
  /** MP lo invalida al usarlo: guardar siempre el que devuelve cada renovacion. */
  refreshToken: string;
  publicKey: string;
  userId: string;
  expiresAt: Date;
  scope: string;
  liveMode: boolean;
};

/** Lo que el proyecto le pasa a parseWebhook, sacado de su framework. */
export type WebhookRequest = {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body: unknown;
};

/**
 * Un aviso de MP ya resuelto: trae el recurso consultado a MP, no lo que venia en el body.
 * `verified` dice si la firma se pudo comprobar.
 */
export type WebhookEvent = { verified: boolean } & (
  | { type: 'payment'; payment: Payment }
  | { type: 'subscription'; subscription: Subscription }
  | { type: 'subscription_charge'; charge: SubscriptionCharge }
  | { type: 'ignored'; reason: string }
);

/**
 * Un error de MP, con lo unico que hace falta para decidir que hacer: si reintentar.
 * Reintentables: 423, 424, 429, 5xx y errores de red. El resto no mejora reintentando.
 */
export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MercadoPagoError';
  }
}

/** La firma de un webhook que la exige no se pudo comprobar. */
export class InvalidWebhookSignatureError extends Error {
  constructor(readonly reason: string) {
    super(`Firma de webhook invalida: ${reason}`);
    this.name = 'InvalidWebhookSignatureError';
  }
}
