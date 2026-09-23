import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  Invoice,
  InvalidWebhookSignatureError as FirmaInvalidaDelSdk,
  MercadoPagoConfig,
  MercadoPagoError as ErrorDelSdk,
  MPConnectionError,
  OAuth,
  Payment,
  PaymentRefund,
  PreApproval,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';
import {
  type Checkout,
  type CheckoutInput,
  type ConnectedAccount,
  InvalidWebhookSignatureError,
  MercadoPagoError,
  type Payment as Pago,
  type PaymentStatus,
  type Refund,
  type Subscription,
  type SubscriptionCharge,
  type SubscriptionInput,
  type SubscriptionStatus,
  type WebhookEvent,
  type WebhookRequest,
} from './types.js';

export type MercadoPagoOptions = {
  accessToken: string;
  /** Adonde avisa MP de los pagos de los checkouts de esta instancia. MP exige HTTPS. */
  notificationUrl?: string;
  timeoutMs?: number;
  /** Reintentos del SDK ante 429, 5xx y red, con la misma idempotency key. */
  maxRetries?: number;
};

const aCentavos = (monto: number): number => Math.round(monto * 100);
const aMonto = (centavos: number): number => centavos / 100;

const ESTADOS_DE_PAGO: Record<string, PaymentStatus> = {
  approved: 'approved',
  authorized: 'pending',
  pending: 'pending',
  in_process: 'pending',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'charged_back',
  in_mediation: 'disputed',
};
// Un estado que MP agregue manana cae en pending: nunca confirma algo por no conocerlo.
const estadoDePago = (s?: string): PaymentStatus =>
  ESTADOS_DE_PAGO[s ?? ''] ?? 'pending';

// MP documenta `canceled` y manda `cancelled` en los avisos: se aceptan los dos.
const estadoDeSuscripcion = (s?: string): SubscriptionStatus =>
  s === 'authorized' || s === 'paused'
    ? s
    : s === 'cancelled' || s === 'canceled'
      ? 'cancelled'
      : 'pending';

/**
 * MP issue #480: desde el 2/9/2026, en Argentina, el init_point de una suscripcion sin plan
 * trae `activation=true` y abre "Esta pagina no existe". Sin el parametro funciona. Sacar
 * esto cuando MP lo arregle.
 */
const sinActivation = (url: string): string => {
  const u = new URL(url);
  u.searchParams.delete('activation');
  return u.toString();
};

/** Traduce los errores del SDK a uno solo, con la decision de reintentar ya tomada. */
async function llamar<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof MPConnectionError) {
      throw new MercadoPagoError(e.message, 0, true);
    }
    if (e instanceof ErrorDelSdk) {
      const reintentable = e.status === 429 || e.status >= 500;
      throw new MercadoPagoError(e.message, e.status, reintentable, e.causes);
    }
    throw new MercadoPagoError(String(e), 0, true);
  }
}

const primero = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/** Un valor del aviso como texto: solo string o number. Un objeto no es un id ni un tema. */
const texto = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : '';

/**
 * Una cuenta de Mercado Pago: la de un vendedor conectado por OAuth, o la propia.
 *
 * Una instancia por access token. Es sin estado: no guarda tokens, pagos ni avisos; eso lo
 * guarda cada proyecto en su base.
 */
export class MercadoPago {
  constructor(private readonly opciones: MercadoPagoOptions) {}

  /**
   * Una configuracion del SDK nueva en CADA operacion. No es derroche: el SDK (issue #481,
   * abierto) copia las requestOptions de cada llamada en la configuracion compartida, asi que
   * la idempotency key de una escritura viaja en todas las siguientes. Con una configuracion
   * compartida, un segundo reembolso volvia como el primero y no reembolsaba nada.
   */
  private config(): MercadoPagoConfig {
    return new MercadoPagoConfig({
      accessToken: this.opciones.accessToken,
      options: {
        timeout: this.opciones.timeoutMs ?? 10_000,
        maxRetries: this.opciones.maxRetries ?? 1,
      },
    });
  }

  /** Crea un link de pago de Checkout Pro. */
  async createCheckout(input: CheckoutInput): Promise<Checkout> {
    const r = await llamar(() =>
      new Preference(this.config()).create({
        body: {
          items: [
            {
              id: input.reference,
              title: input.title,
              quantity: 1,
              unit_price: aMonto(input.amountCents),
              currency_id: input.currency ?? 'ARS',
            },
          ],
          external_reference: input.reference,
          binary_mode: input.binaryMode ?? true,
          ...(this.opciones.notificationUrl
            ? { notification_url: this.opciones.notificationUrl }
            : {}),
          ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
          ...(input.backUrls
            ? { back_urls: input.backUrls, auto_return: 'approved' }
            : {}),
          ...(input.expiresAt
            ? {
                expires: true,
                expiration_date_to: input.expiresAt.toISOString(),
              }
            : {}),
          ...(input.onlyInstantMethods
            ? {
                payment_methods: {
                  excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
                },
              }
            : {}),
          ...(input.statementDescriptor
            ? { statement_descriptor: input.statementDescriptor.slice(0, 13) }
            : {}),
        },
        requestOptions: {
          idempotencyKey: input.idempotencyKey ?? randomUUID(),
        },
      }),
    );
    if (!r.id || !r.init_point) {
      throw new MercadoPagoError('MP no devolvio el link de pago', 502, true);
    }
    return { id: r.id, url: r.init_point };
  }

  async getPayment(id: string): Promise<Pago> {
    const p = await llamar(() => new Payment(this.config()).get({ id }));
    return {
      id: String(p.id),
      reference: p.external_reference ?? null,
      status: estadoDePago(p.status),
      statusDetail: p.status_detail ?? null,
      amountCents: aCentavos(p.transaction_amount ?? 0),
      refundedCents: aCentavos(p.transaction_amount_refunded ?? 0),
      method: p.payment_type_id ?? null,
      collectorId: p.collector_id == null ? null : String(p.collector_id),
      approvedAt: p.date_approved ? new Date(p.date_approved) : null,
    };
  }

  /**
   * Reembolsa un pago, total o parcial. La idempotency key es obligatoria: es lo que hace
   * seguro reintentar un reembolso que no se sabe si salio.
   */
  async refund(
    paymentId: string,
    opciones: { amountCents?: number; idempotencyKey: string },
  ): Promise<Refund> {
    const r = await llamar(() =>
      new PaymentRefund(this.config()).create({
        payment_id: paymentId,
        body:
          opciones.amountCents === undefined
            ? {}
            : { amount: aMonto(opciones.amountCents) },
        requestOptions: { idempotencyKey: opciones.idempotencyKey },
      }),
    );
    return {
      id: String(r.id),
      status: r.status ?? 'unknown',
      amountCents: aCentavos(r.amount ?? 0),
    };
  }

  /**
   * Crea una suscripcion mensual sin plan asociado, pendiente de que quien paga la autorice
   * en `url`. Es la unica variante que no exige tokenizar una tarjeta en el front.
   */
  async createSubscription(input: SubscriptionInput): Promise<Subscription> {
    const r = await llamar(() =>
      new PreApproval(this.config()).create({
        body: {
          reason: input.reason,
          external_reference: input.reference,
          payer_email: input.payerEmail,
          ...(input.backUrl ? { back_url: input.backUrl } : {}),
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: aMonto(input.amountCents),
            currency_id: input.currency ?? 'ARS',
          },
          status: 'pending',
        },
        requestOptions: {
          idempotencyKey: input.idempotencyKey ?? randomUUID(),
        },
      }),
    );
    return aSuscripcion(r);
  }

  async getSubscription(id: string): Promise<Subscription> {
    return aSuscripcion(
      await llamar(() => new PreApproval(this.config()).get({ id })),
    );
  }

  /** Cancela la suscripcion. En MP es irreversible. */
  async cancelSubscription(id: string): Promise<Subscription> {
    return aSuscripcion(
      await llamar(() =>
        new PreApproval(this.config()).update({
          id,
          body: { status: 'cancelled' },
        }),
      ),
    );
  }

  async getSubscriptionCharge(id: string): Promise<SubscriptionCharge> {
    const r = await llamar(() => new Invoice(this.config()).get({ id }));
    return {
      id: String(r.id),
      subscriptionId: r.preapproval_id ?? null,
      status: r.status ?? 'unknown',
      paymentStatus: r.payment?.status ? estadoDePago(r.payment.status) : null,
      chargedAt: r.debit_date ? new Date(r.debit_date) : null,
    };
  }

  /**
   * Resuelve un aviso de MP. Entiende los dos formatos que manda (webhook e IPN), verifica
   * la firma y TRAE EL RECURSO ACTUALIZADO de MP: el body del aviso no se usa nunca como
   * fuente, asi que un aviso falso solo puede hacer que se consulte algo real.
   *
   * `signature: 'required'` es para los webhooks configurados en el panel de la app, que MP
   * firma. `optional` es para los avisos por `notification_url`, donde MP no garantiza firma
   * verificable: se comprueba y se informa en `verified`, pero no se rechaza.
   */
  async parseWebhook(
    req: WebhookRequest,
    opciones: { secret?: string; signature: 'required' | 'optional' },
  ): Promise<WebhookEvent> {
    const body = (req.body ?? {}) as {
      type?: string;
      topic?: string;
      data?: { id?: unknown };
    };
    const tema = texto(
      req.query.type ?? req.query.topic ?? body.type ?? body.topic,
    );
    // El manifest de la firma usa el data.id del query string, no el del body.
    const idDelQuery = req.query['data.id'] ?? req.query.id;
    const dataId = texto(idDelQuery ?? body.data?.id);

    const verified = verificarFirma(req, idDelQuery, opciones.secret);
    if (opciones.signature === 'required' && verified !== true) {
      throw new InvalidWebhookSignatureError(
        verified || 'sin secreto configurado',
      );
    }
    const ok = verified === true;
    if (!dataId)
      return { type: 'ignored', reason: 'el aviso no trae id', verified: ok };

    try {
      switch (tema) {
        case 'payment':
          return {
            type: 'payment',
            payment: await this.getPayment(dataId),
            verified: ok,
          };
        case 'subscription_preapproval':
          return {
            type: 'subscription',
            subscription: await this.getSubscription(dataId),
            verified: ok,
          };
        case 'subscription_authorized_payment':
          return {
            type: 'subscription_charge',
            charge: await this.getSubscriptionCharge(dataId),
            verified: ok,
          };
        default:
          return {
            type: 'ignored',
            reason: `tema ${tema || 'vacio'}`,
            verified: ok,
          };
      }
    } catch (e) {
      // Un id que esta cuenta no ve no es un aviso para ella.
      if (e instanceof MercadoPagoError && e.status === 404) {
        return {
          type: 'ignored',
          reason: 'recurso inexistente para esta cuenta',
          verified: ok,
        };
      }
      throw e;
    }
  }

  /**
   * OAuth para conectar cuentas de vendedores (modelo marketplace), con PKCE.
   * `platformAccessToken` es el token de la cuenta duenia de la app: el SDK lo manda como
   * Bearer en el canje del codigo.
   */
  static oauth(opciones: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    platformAccessToken: string;
  }) {
    const config = () =>
      new MercadoPagoConfig({
        accessToken: opciones.platformAccessToken,
        options: { timeout: 10_000, maxRetries: 1 },
      });
    const credenciales = {
      client_id: opciones.clientId,
      client_secret: opciones.clientSecret,
    };
    return {
      /**
       * Un verifier de PKCE nuevo. Va aparte de la URL porque hay que guardarlo hasta el
       * canje, y lo mas comodo suele ser meterlo cifrado en el propio `state`.
       */
      newVerifier(): string {
        return randomBytes(32).toString('base64url');
      },

      /** La URL a la que se manda al vendedor para que autorice, con el challenge S256. */
      authorizationUrl(state: string, verifier: string): string {
        const challenge = createHash('sha256')
          .update(verifier)
          .digest('base64url');
        // Los tipos del SDK no tienen los campos de PKCE, pero los pasa tal cual a la URL.
        return new OAuth(config()).getAuthorizationURL({
          options: {
            client_id: opciones.clientId,
            redirect_uri: opciones.redirectUri,
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
          } as { client_id: string; redirect_uri: string; state: string },
        });
      },

      /** Canjea el codigo que vuelve en la redirect por las credenciales del vendedor. */
      async connect(code: string, verifier: string): Promise<ConnectedAccount> {
        return aCuenta(
          await llamar(() =>
            new OAuth(config()).create({
              body: {
                ...credenciales,
                code,
                redirect_uri: opciones.redirectUri,
                code_verifier: verifier,
              } as { client_id: string; client_secret: string; code: string },
            }),
          ),
        );
      },

      /** Renueva el token. El refresh token viejo deja de servir: guardar el nuevo. */
      async refresh(refreshToken: string): Promise<ConnectedAccount> {
        return aCuenta(
          await llamar(() =>
            new OAuth(config()).refresh({
              body: { ...credenciales, refresh_token: refreshToken },
            }),
          ),
        );
      },
    };
  }
}

function aSuscripcion(r: {
  id?: string;
  // El SDK lo tipa como string al crear y como number al actualizar: se normaliza aca.
  external_reference?: string | number;
  status?: string;
  init_point?: string;
  // Idem: string al crear, number al actualizar. new Date() acepta los dos.
  next_payment_date?: string | number;
  auto_recurring?: { transaction_amount?: number };
}): Subscription {
  if (!r.id)
    throw new MercadoPagoError('MP no devolvio la suscripcion', 502, true);
  return {
    id: r.id,
    reference:
      r.external_reference == null ? null : String(r.external_reference),
    status: estadoDeSuscripcion(r.status),
    amountCents: aCentavos(r.auto_recurring?.transaction_amount ?? 0),
    nextChargeAt: r.next_payment_date ? new Date(r.next_payment_date) : null,
    url: r.init_point ? sinActivation(r.init_point) : null,
  };
}

function aCuenta(r: {
  access_token?: string;
  refresh_token?: string;
  public_key?: string;
  user_id?: number;
  expires_in?: number;
  scope?: string;
  live_mode?: boolean;
}): ConnectedAccount {
  if (!r.access_token || !r.refresh_token || !r.user_id) {
    throw new MercadoPagoError(
      'MP no devolvio las credenciales completas',
      502,
      false,
    );
  }
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    publicKey: r.public_key ?? '',
    userId: String(r.user_id),
    // 180 dias es el default documentado de MP.
    expiresAt: new Date(Date.now() + (r.expires_in ?? 15_552_000) * 1000),
    scope: r.scope ?? '',
    liveMode: r.live_mode ?? false,
  };
}

/**
 * true si la firma es valida, o el motivo por el que no. Sin ventana de tiempo sobre `ts`: el
 * procesamiento trae el estado actual del recurso, asi que un aviso reenviado no cambia nada,
 * y una ventana mal calibrada rechazaria los reintentos legitimos de MP.
 */
function verificarFirma(
  req: WebhookRequest,
  dataId: unknown,
  secret: string | undefined,
): true | string {
  if (!secret) return 'sin secreto configurado';
  try {
    WebhookSignatureValidator.validate({
      xSignature: primero(req.headers['x-signature']),
      xRequestId: primero(req.headers['x-request-id']),
      dataId: texto(dataId) || undefined,
      secret,
    });
    return true;
  } catch (e) {
    if (e instanceof FirmaInvalidaDelSdk) return e.reason;
    throw e;
  }
}
