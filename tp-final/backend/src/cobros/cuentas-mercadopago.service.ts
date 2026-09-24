import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { cripto } from '../common/cripto.js';
import { aDate, ahoraEn } from '../common/horario.js';
import { env } from '../env.js';
import {
  type ConnectedAccount,
  MercadoPago,
  MercadoPagoError,
} from '../lib/mercadopago/index.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { reconectarMercadoPago } from '../notificaciones/plantillas.js';
import { suscripcionViva } from '../planes/planes.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import type { CuentaMercadoPagoDto } from './dto/cuenta-mercadopago.dto.js';

const MINUTOS_PARA_AUTORIZAR = 10;
/** Se renuevan cuando les queda menos que esto de sus 180 dias. */
const RENOVAR_ANTES_MS = 30 * 86_400_000;

/** Lo que viaja cifrado en el `state` de OAuth. Asi no hace falta una tabla. */
type Estado = { tid: string; verifier: string; exp: number };

/** MP exige HTTPS en notification_url y en las URLs de vuelta: las demas se omiten. */
export const esHttps = (url?: string): url is string =>
  !!url?.startsWith('https://');

/** Mercado Pago no respondio, o respondio con un error que no es del pedido. */
export function mpNoResponde(): never {
  throw new BadGatewayException({
    code: 'payment_provider_unavailable',
    message: 'Mercado Pago no respondio. Proba de nuevo en unos minutos.',
  });
}

/** A la plataforma le falta configurar la app o la cuenta de Mercado Pago. */
export function mpSinConfigurar(): never {
  throw new ServiceUnavailableException({
    code: 'mercadopago_not_configured',
    message: 'Mercado Pago no esta configurado en la plataforma.',
  });
}

/** Las columnas de los tokens, cifrados: las escriben la conexion y la renovacion. */
const columnasDeTokens = (c: ConnectedAccount) => ({
  accessTokenCifrado: cripto.cifrar(c.accessToken, 'tokens-de-mercado-pago'),
  refreshTokenCifrado: cripto.cifrar(c.refreshToken, 'tokens-de-mercado-pago'),
  expiraAt: c.expiresAt,
  scope: c.scope,
  liveMode: c.liveMode,
});

@Injectable()
export class CuentasMercadoPagoService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /**
   * La cuenta de MP del centro en contexto para COBRAR, o null si hoy no puede cobrar online:
   * sin cuenta conectada, o esperando que la reconecten.
   */
  async delCentro(slug: string): Promise<MercadoPago | null> {
    const cuenta = await this.db.cuentaMercadoPago.findFirst({
      select: { accessTokenCifrado: true, requiereReconexion: true },
    });
    return cuenta && !cuenta.requiereReconexion
      ? this.cliente(cuenta.accessTokenCifrado, slug)
      : null;
  }

  /**
   * La cuenta del centro para SALDAR lo ya cobrado: los avisos de pago y los reembolsos.
   * Tambien cuando espera reconexion, porque el token puede seguir sirviendo aunque la
   * renovacion haya fallado. null solo si no hay cuenta.
   */
  async paraSaldar(slug: string): Promise<MercadoPago | null> {
    const cuenta = await this.db.cuentaMercadoPago.findFirst({
      select: { accessTokenCifrado: true },
    });
    return cuenta ? this.cliente(cuenta.accessTokenCifrado, slug) : null;
  }

  private cliente(accessTokenCifrado: string, slug: string): MercadoPago {
    return new MercadoPago({
      accessToken: cripto.descifrar(
        accessTokenCifrado,
        'tokens-de-mercado-pago',
      ),
      // MP exige HTTPS: sin una URL publica, en desarrollo el aviso no llega y se usa un
      // tunel, o la verificacion lo simula.
      notificationUrl: esHttps(env.publicApiUrl)
        ? `${env.publicApiUrl}/api/v1/tenants/${slug}/webhooks/mercadopago`
        : undefined,
    });
  }

  /** La cuenta de la plataforma, la que cobra las suscripciones. null si no esta configurada. */
  dePlataforma(): MercadoPago | null {
    const accessToken = env.mercadoPago.platformAccessToken;
    return accessToken ? new MercadoPago({ accessToken }) : null;
  }

  /** Adonde vuelve quien paga. MP exige HTTPS: si el front no lo tiene, no hay vuelta automatica. */
  urlsDeVuelta(slug: string, reservaId: string) {
    if (!esHttps(env.frontendUrl)) return undefined;
    const url = `${env.frontendUrl}/${slug}/reservas/${reservaId}/pago`;
    return { success: url, pending: url, failure: url };
  }

  async estado(): Promise<CuentaMercadoPagoDto> {
    const cuenta = await this.db.cuentaMercadoPago.findFirst({
      select: {
        mpUserId: true,
        liveMode: true,
        requiereReconexion: true,
        createdAt: true,
      },
    });
    return {
      conectada: !!cuenta,
      mpUserId: cuenta?.mpUserId ?? null,
      liveMode: cuenta?.liveMode ?? null,
      requiereReconexion: cuenta?.requiereReconexion ?? false,
      conectadaAt: cuenta?.createdAt ?? null,
    };
  }

  /**
   * La URL para que la administradora autorice. El `state` lleva, cifrados, el centro, el
   * verifier de PKCE y un vencimiento: no hace falta guardar nada, el verifier nunca viaja
   * legible, y un state robado no sirve en otro centro.
   */
  urlDeAutorizacion(): { url: string } {
    const oauth = this.oauth();
    const verifier = oauth.newVerifier();
    const estado: Estado = {
      tid: TenantContext.require(),
      verifier,
      exp: Date.now() + MINUTOS_PARA_AUTORIZAR * 60_000,
    };
    const state = cripto.cifrar(JSON.stringify(estado), 'estado-oauth');
    return { url: oauth.authorizationUrl(state, verifier) };
  }

  async conectar(
    code: string,
    state: string,
    zonaHoraria: string,
  ): Promise<CuentaMercadoPagoDto> {
    const oauth = this.oauth();
    const estado = this.leerEstado(state);
    let cuenta: ConnectedAccount;
    try {
      cuenta = await oauth.connect(code, estado.verifier);
    } catch (e) {
      if (e instanceof MercadoPagoError && !e.retryable) {
        throw new BadRequestException({
          code: 'invalid_state',
          message:
            'Mercado Pago rechazo la conexion. Volve a conectar desde el panel.',
        });
      }
      mpNoResponde();
    }

    const actual = await this.db.cuentaMercadoPago.findFirst({
      select: { mpUserId: true },
    });
    if (actual && actual.mpUserId !== cuenta.userId) {
      await this.exigirSinPagosEnCurso(zonaHoraria);
    }

    const datos = {
      ...columnasDeTokens(cuenta),
      mpUserId: cuenta.userId,
      publicKey: cuenta.publicKey,
      requiereReconexion: false,
    };
    await this.db.cuentaMercadoPago.upsert({
      where: { tenantId: TenantContext.require() },
      create: datos as Prisma.CuentaMercadoPagoUncheckedCreateInput,
      update: datos,
    });
    return this.estado();
  }

  async desconectar(zonaHoraria: string): Promise<CuentaMercadoPagoDto> {
    // Tenant es la raiz y la extension no lo filtra: el where va explicito.
    const t = await this.db.tenant.findFirstOrThrow({
      where: { id: TenantContext.require() },
      select: { suscripcionMpId: true, suscripcionEstado: true },
    });
    // El Profesional existe para cobrar online: mientras se paga, la cuenta no se va.
    if (suscripcionViva(t)) {
      throw new ConflictException({
        code: 'mp_account_change_blocked',
        message:
          'Tu plan cobra con esta cuenta: para desconectarla, primero pasate al plan Básico.',
      });
    }
    await this.exigirSinPagosEnCurso(zonaHoraria);
    await this.db.cuentaMercadoPago.deleteMany();
    return this.estado();
  }

  /**
   * Renueva el token del centro si le falta poco para vencer. MP invalida el refresh token al
   * usarlo, asi que el nuevo se guarda con un UPDATE condicional sobre el viejo: si dos
   * procesos renuevan a la vez, gana uno y el otro no pisa nada, ni marca la cuenta.
   */
  async renovarToken(centro: { nombre: string }): Promise<void> {
    const cuenta = await this.db.cuentaMercadoPago.findFirst({
      where: {
        requiereReconexion: false,
        refreshTokenCifrado: { not: null },
        expiraAt: { lt: new Date(Date.now() + RENOVAR_ANTES_MS) },
      },
      select: { id: true, refreshTokenCifrado: true },
    });
    if (!cuenta?.refreshTokenCifrado) return;

    let nueva: ConnectedAccount;
    try {
      nueva = await this.oauth().refresh(
        cripto.descifrar(cuenta.refreshTokenCifrado, 'tokens-de-mercado-pago'),
      );
    } catch (e) {
      // Un error reintentable se reintenta en la proxima corrida. Uno definitivo es que MP
      // revoco el acceso: el centro tiene que reconectar, y se le avisa. Salvo que otro
      // proceso la haya renovado recien: entonces el refresh token que se uso ya no existia,
      // y la cuenta esta bien.
      if (e instanceof MercadoPagoError && !e.retryable) {
        await this.marcarReconexion(centro, {
          refreshTokenCifrado: cuenta.refreshTokenCifrado,
        });
        return;
      }
      throw e;
    }
    await this.db.cuentaMercadoPago.updateMany({
      where: { id: cuenta.id, refreshTokenCifrado: cuenta.refreshTokenCifrado },
      // requiereReconexion en false: si otro proceso la marco con un refresh token viejo, la
      // renovacion que gano la deja bien.
      data: { ...columnasDeTokens(nueva), requiereReconexion: false },
    });
  }

  /**
   * MP ya no acepta los tokens del centro: se deja de cobrar online y se le avisa. `soloSi` es
   * la condicion de la marca, en el mismo UPDATE: la renovacion marca solo si nadie la renovo
   * mientras tanto.
   */
  async marcarReconexion(
    centro: { nombre: string },
    soloSi: Prisma.CuentaMercadoPagoWhereInput = {},
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const { count } = await tx.cuentaMercadoPago.updateMany({
        where: { requiereReconexion: false, ...soloSi },
        data: { requiereReconexion: true },
      });
      if (count > 0) {
        await this.notificaciones.encolarAlCentro(
          tx,
          reconectarMercadoPago({ centro: centro.nombre }),
        );
      }
    });
    this.notificaciones.despacharAhora();
  }

  private oauth() {
    const mp = env.mercadoPago;
    if (
      !mp.clientId ||
      !mp.clientSecret ||
      !mp.redirectUri ||
      !mp.platformAccessToken
    ) {
      mpSinConfigurar();
    }
    return MercadoPago.oauth({
      clientId: mp.clientId,
      clientSecret: mp.clientSecret,
      redirectUri: mp.redirectUri,
      platformAccessToken: mp.platformAccessToken,
      testToken: mp.oauthTestToken,
    });
  }

  private leerEstado(state: string): Estado {
    let estado: Partial<Estado> = {};
    try {
      estado = JSON.parse(cripto.descifrar(state, 'estado-oauth')) as Estado;
    } catch {
      // Un state que no se descifra lo toco alguien, o no lo emitio esta API.
    }
    if (
      estado.tid !== TenantContext.require() ||
      !estado.verifier ||
      !estado.exp ||
      estado.exp < Date.now()
    ) {
      throw new BadRequestException({
        code: 'invalid_state',
        message:
          'El pedido de conexion vencio o no es valido. Volve a conectar.',
      });
    }
    return estado as Estado;
  }

  /**
   * Un pago solo lo puede leer y devolver la cuenta que lo cobro. Mientras la cuenta tenga algo
   * en curso, cambiarla o desconectarla lo dejaria sin forma de saldarse: turnos por venir con
   * pagos aprobados, cobros abiertos que la clienta todavia puede pagar, y reembolsos que no
   * salieron.
   */
  private async exigirSinPagosEnCurso(zonaHoraria: string): Promise<void> {
    const hoy = ahoraEn(zonaHoraria).fecha;
    const [pagos, cobrosAbiertos, reembolsos] = await Promise.all([
      this.db.pago.count({
        where: {
          estado: 'aprobado',
          reserva: {
            estado: { in: ['pendiente', 'confirmada'] },
            fecha: { gte: aDate(hoy) },
          },
        },
      }),
      this.db.reserva.count({
        where: { estado: 'pendiente', pagoVenceAt: { gt: new Date() } },
      }),
      this.db.reembolso.count({ where: { estado: 'pendiente' } }),
    ]);
    if (pagos + cobrosAbiertos + reembolsos > 0) {
      throw new ConflictException({
        code: 'mp_account_change_blocked',
        message:
          'Esta cuenta tiene pagos en curso o turnos pagos por venir: si se cambia, no se podrian saldar.',
      });
    }
  }
}
