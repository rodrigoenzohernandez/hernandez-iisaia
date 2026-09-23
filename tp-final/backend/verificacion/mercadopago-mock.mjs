#!/usr/bin/env node
// Mock de la API de Mercado Pago para verificar.sh.
//
// Implementa lo que usa la libreria de src/lib/mercadopago —preferencias, pagos, reembolsos,
// suscripciones, cobros de suscripcion y OAuth— con estado en memoria. La API se levanta con
// MP_API_URL apuntando aca (npm run start:verify) y el SDK real le habla a este servidor en vez
// de a api.mercadopago.com: lo que se prueba es el codigo de verdad, no un doble.
//
// Se parece a MP en lo que importa para la verificacion:
//   - cada recurso es de la cuenta (el token) que lo creo, y otra cuenta recibe 404;
//   - un reembolso con una idempotency key ya usada devuelve el reembolso original;
//   - el canje de OAuth exige el code_verifier de PKCE.
//
// Rutas de control, que no existen en MP:
//   POST /__test/pagos     {preferencia, status, monto?}  simula que alguien pago un checkout
//   POST /__test/facturas  {suscripcion, status}          simula un cobro mensual
//   POST /__test/fallas    {metodo, prefijo, status, veces} las proximas N llamadas fallan
//   GET  /__test/llamadas                                 cada llamada, con el token que uso
import { createServer } from 'node:http';

const PUERTO = Number(process.env.MP_MOCK_PORT ?? 3199);

const preferencias = new Map();
const pagos = new Map();
const reembolsosPorClave = new Map();
const suscripciones = new Map();
const facturas = new Map();
const refreshTokens = new Map();
const llamadas = [];
const fallas = [];
let secuencia = 7000;
const nuevoId = () => ++secuencia;

/** La cuenta de un token. El sufijo numerico es el user_id: asi el seed y OAuth lo controlan. */
const cuentaDe = (token) => Number(/-(\d+)$/.exec(token)?.[1] ?? 1);
const tokenDe = (req) => (req.headers.authorization ?? '').replace(/^Bearer /, '');

const responder = (res, status, cuerpo) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(cuerpo));
};
const error = (res, status, mensaje) =>
  responder(res, status, { message: mensaje, error: mensaje, status, cause: [] });

const leer = (req) =>
  new Promise((listo) => {
    let datos = '';
    req.on('data', (c) => (datos += c));
    req.on('end', () => {
      try {
        listo(datos ? JSON.parse(datos) : {});
      } catch {
        listo({});
      }
    });
  });

/** Una falla programada que aplica a esta llamada, si hay. */
function fallaPara(metodo, path) {
  const f = fallas.find((x) => x.metodo === metodo && path.startsWith(x.prefijo) && x.veces > 0);
  if (f) f.veces -= 1;
  return f;
}

const tokensOAuth = (userId) => {
  const refresh = `TG-${nuevoId()}-${userId}`;
  refreshTokens.set(refresh, userId);
  return {
    access_token: `APP_USR-vendedor-${nuevoId()}-${userId}`,
    refresh_token: refresh,
    public_key: `APP_USR-pk-${userId}`,
    user_id: userId,
    token_type: 'bearer',
    expires_in: 15_552_000,
    scope: 'offline_access read write',
    live_mode: false,
  };
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://mock');
  // El SDK agrega una barra final en algunas rutas (/checkout/preferences/): se ignora.
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const cuerpo = await leer(req);
  const token = tokenDe(req);
  let m;

  // ----- control
  if (path === '/__test/llamadas') return responder(res, 200, llamadas);
  if (path === '/__test/fallas' && req.method === 'POST') {
    fallas.push({ ...cuerpo, veces: cuerpo.veces ?? 1 });
    return responder(res, 201, { ok: true });
  }
  if (path === '/__test/pagos' && req.method === 'POST') {
    const pref = preferencias.get(cuerpo.preferencia);
    if (!pref) return error(res, 404, 'preferencia inexistente');
    const id = nuevoId();
    const aprobado = cuerpo.status === 'approved';
    pagos.set(String(id), {
      token: pref.token,
      datos: {
        id,
        status: cuerpo.status,
        status_detail: aprobado ? 'accredited' : 'cc_rejected_other_reason',
        transaction_amount: cuerpo.monto ?? pref.body.items[0].unit_price,
        transaction_amount_refunded: 0,
        external_reference: pref.body.external_reference,
        collector_id: cuentaDe(pref.token),
        payment_type_id: 'account_money',
        date_approved: aprobado ? new Date().toISOString() : null,
      },
    });
    return responder(res, 201, { id });
  }
  if (path === '/__test/facturas' && req.method === 'POST') {
    const s = suscripciones.get(cuerpo.suscripcion);
    if (!s) return error(res, 404, 'suscripcion inexistente');
    s.datos.status = 'authorized';
    const id = nuevoId();
    facturas.set(String(id), {
      token: s.token,
      datos: {
        id,
        type: 'scheduled',
        preapproval_id: s.datos.id,
        status: 'processed',
        debit_date: cuerpo.fecha ?? new Date().toISOString(),
        payment: { id: nuevoId(), status: cuerpo.status, status_detail: 'accredited' },
      },
    });
    return responder(res, 201, { id });
  }

  // ----- API de MP
  llamadas.push({
    metodo: req.method,
    path,
    token,
    idempotencyKey: req.headers['x-idempotency-key'] ?? null,
    cuerpo,
  });
  const falla = fallaPara(req.method, path);
  if (falla) return error(res, falla.status, 'falla programada del mock');
  if (!token) return error(res, 401, 'unauthorized');

  if (path === '/checkout/preferences' && req.method === 'POST') {
    const id = `pref-${nuevoId()}`;
    preferencias.set(id, { token, body: cuerpo });
    return responder(res, 201, {
      id,
      init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${id}`,
      external_reference: cuerpo.external_reference,
      items: cuerpo.items,
    });
  }

  if ((m = /^\/v1\/payments\/(\d+)$/.exec(path)) && req.method === 'GET') {
    const p = pagos.get(m[1]);
    // Un pago de otra cuenta no existe para este token, como en MP.
    if (!p || p.token !== token) return error(res, 404, 'Payment not found');
    return responder(res, 200, p.datos);
  }

  if ((m = /^\/v1\/payments\/(\d+)\/refunds$/.exec(path)) && req.method === 'POST') {
    const p = pagos.get(m[1]);
    if (!p || p.token !== token) return error(res, 404, 'Payment not found');
    const clave = req.headers['x-idempotency-key'];
    if (clave && reembolsosPorClave.has(clave)) {
      return responder(res, 201, reembolsosPorClave.get(clave));
    }
    const disponible = p.datos.transaction_amount - p.datos.transaction_amount_refunded;
    const monto = cuerpo.amount ?? disponible;
    if (p.datos.status !== 'approved' || monto <= 0 || monto > disponible + 1e-9) {
      return error(res, 400, 'refund not allowed');
    }
    p.datos.transaction_amount_refunded += monto;
    const total = p.datos.transaction_amount_refunded >= p.datos.transaction_amount - 1e-9;
    if (total) p.datos.status = 'refunded';
    p.datos.status_detail = total ? 'refunded' : 'partially_refunded';
    const reembolso = { id: nuevoId(), payment_id: Number(m[1]), amount: monto, status: 'approved' };
    if (clave) reembolsosPorClave.set(clave, reembolso);
    return responder(res, 201, reembolso);
  }

  if (path === '/preapproval' && req.method === 'POST') {
    const id = `preap-${nuevoId()}`;
    const datos = {
      id,
      reason: cuerpo.reason,
      external_reference: cuerpo.external_reference,
      payer_email: cuerpo.payer_email,
      status: 'pending',
      auto_recurring: cuerpo.auto_recurring,
      // Con el parametro que rompe el link en Argentina (issue #480): la libreria lo tiene
      // que sacar.
      init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}&activation=true`,
    };
    suscripciones.set(id, { token, datos });
    return responder(res, 201, datos);
  }

  if ((m = /^\/preapproval\/([\w-]+)$/.exec(path))) {
    const s = suscripciones.get(m[1]);
    if (!s || s.token !== token) return error(res, 404, 'preapproval not found');
    if (req.method === 'PUT') Object.assign(s.datos, cuerpo);
    return responder(res, 200, s.datos);
  }

  if ((m = /^\/authorized_payments\/(\d+)$/.exec(path)) && req.method === 'GET') {
    const f = facturas.get(m[1]);
    if (!f || f.token !== token) return error(res, 404, 'authorized payment not found');
    return responder(res, 200, f.datos);
  }

  if (path === '/oauth/token' && req.method === 'POST') {
    if (cuerpo.grant_type === 'authorization_code') {
      // El codigo de prueba es "codigo-<user_id>". Sin code_verifier no hay canje: es PKCE.
      const userId = Number(/^codigo-(\d+)$/.exec(cuerpo.code ?? '')?.[1]);
      if (!userId || !cuerpo.code_verifier || cuerpo.code_verifier.length < 43) {
        return error(res, 400, 'invalid_grant');
      }
      return responder(res, 200, tokensOAuth(userId));
    }
    if (cuerpo.grant_type === 'refresh_token') {
      const userId = refreshTokens.get(cuerpo.refresh_token);
      if (!userId) return error(res, 400, 'invalid_grant');
      // El refresh token se usa una sola vez, como en MP.
      refreshTokens.delete(cuerpo.refresh_token);
      return responder(res, 200, tokensOAuth(userId));
    }
    return error(res, 400, 'unsupported_grant_type');
  }

  return error(res, 404, `mock sin ruta para ${req.method} ${path}`);
}).listen(PUERTO, () => console.log(`Mock de Mercado Pago en http://localhost:${PUERTO}`));
