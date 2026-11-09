// Servicios falsos del entorno de prueba, en un solo proceso:
// - HTTPS en 127.0.0.1:443 (el Chromium de los agentes resuelve ahí *.pn.test,
//   *.mock.test y el bucket de S3). Rutea por Host:
//     *.pn.test / pn.test        → Next (127.0.0.1:STACK_NEXT_PORT)
//     mercadopago.mock.test      → checkout falso de Mercado Pago
//     mail.mock.test             → bandeja de entrada (mails capturados)
//     *.amazonaws.com            → S3 falso (subidas firmadas e imágenes)
// - HTTP en 127.0.0.1:55801 para el servidor (preload.mjs y RESEND_BASE_URL).
import { createHmac, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const RUN = process.env.STACK_RUN_DIR;
const NEXT_PORT = Number(process.env.STACK_NEXT_PORT ?? 3100);
const INTERNAL_PORT = Number(process.env.STACK_MOCKS_PORT ?? 55801);
const HTTPS_PORT = Number(process.env.STACK_HTTPS_PORT ?? 443);
const SIGNING_SECRET = process.env.CREDENTIALS_SIGNING_SECRET;

const dirs = {
  mails: path.join(RUN, 'mails'),
  s3: path.join(RUN, 's3'),
  mp: path.join(RUN, 'mp'),
};
for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });

function log(message, extra = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), message, ...extra });
  appendFileSync(path.join(RUN, 'logs', 'mocks.log'), `${line}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body = '', headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const sendJson = (res, status, body) =>
  send(res, status, JSON.stringify(body), { 'content-type': 'application/json' });

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.45}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;font-size:14px}
button{font-size:16px;padding:10px 16px;margin:4px 4px 4px 0;cursor:pointer}.muted{color:#666;font-size:13px}
.box{border:1px solid #ddd;border-radius:8px;padding:16px;margin:12px 0}</style></head><body>${body}</body></html>`;
}

// ── S3 ───────────────────────────────────────────────────────────────────────
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,PUT,POST,HEAD,DELETE',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'ETag',
};

// Imagen de 1x1 para objetos que no existen (ej. portadas del seed).
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function s3Location(host, url) {
  const { pathname } = new URL(url, 'http://x');
  const virtual = host.match(/^([^.]+)\.s3[.-]/);
  const parts = decodeURIComponent(pathname).replace(/^\/+/, '').split('/');
  const bucket = virtual ? virtual[1] : parts.shift();
  const key = virtual ? parts.join('/') : parts.join('/');
  return { bucket, key };
}

async function handleS3(req, res, host) {
  if (req.method === 'OPTIONS') return send(res, 204, '', CORS);
  const { searchParams } = new URL(req.url, 'http://x');
  const { bucket, key } = s3Location(host, req.url);
  const body = await readBody(req);
  if (searchParams.has('cors') || !key) {
    return send(res, 200, '<?xml version="1.0"?><CORSConfiguration/>', {
      ...CORS,
      'content-type': 'application/xml',
    });
  }
  const file = path.join(dirs.s3, bucket, key);
  if (!file.startsWith(path.join(dirs.s3, bucket))) return send(res, 400, 'bad key', CORS);
  if (req.method === 'PUT') {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body);
    writeFileSync(`${file}.__type`, req.headers['content-type'] ?? 'application/octet-stream');
    log('s3 put', { bucket, key, bytes: body.length });
    return send(res, 200, '', { ...CORS, etag: `"${randomUUID()}"` });
  }
  if (req.method === 'DELETE') return send(res, 204, '', CORS);
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (existsSync(file)) {
      const type = existsSync(`${file}.__type`) ? readFileSync(`${file}.__type`, 'utf8') : 'application/octet-stream';
      return send(res, 200, req.method === 'HEAD' ? '' : readFileSync(file), { ...CORS, 'content-type': type });
    }
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(key)) {
      return send(res, 200, req.method === 'HEAD' ? '' : PLACEHOLDER_PNG, { ...CORS, 'content-type': 'image/png' });
    }
    return send(res, 404, '<Error><Code>NoSuchKey</Code></Error>', { ...CORS, 'content-type': 'application/xml' });
  }
  return send(res, 405, '', CORS);
}

// ── Resend ───────────────────────────────────────────────────────────────────
async function handleResend(req, res) {
  const body = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(body.toString() || '{}');
  } catch {
    return sendJson(res, 400, { message: 'invalid json' });
  }
  const mails = Array.isArray(payload) ? payload : [payload];
  const ids = mails.map((mail) => {
    const id = randomUUID();
    writeFileSync(
      path.join(dirs.mails, `${Date.now()}-${id}.json`),
      JSON.stringify({ id, receivedAt: new Date().toISOString(), ...mail }),
    );
    log('mail captured', { id, to: mail.to, subject: mail.subject });
    return { id };
  });
  return sendJson(res, 200, Array.isArray(payload) ? { data: ids } : ids[0]);
}

function listMails() {
  return readdirSync(dirs.mails)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .reverse()
    .map((file) => JSON.parse(readFileSync(path.join(dirs.mails, file), 'utf8')));
}

const recipients = (mail) => [mail.to, mail.cc, mail.bcc].flat().filter(Boolean).join(', ');

function attachmentBuffer(attachment) {
  const content = attachment.content;
  if (typeof content === 'string') return Buffer.from(content, 'base64');
  if (content?.type === 'Buffer') return Buffer.from(content.data);
  if (Array.isArray(content)) return Buffer.from(content);
  return Buffer.from(JSON.stringify(content ?? ''));
}

async function handleMailViewer(req, res) {
  const url = new URL(req.url, 'https://mail.mock.test');
  const match = url.pathname.match(/^\/m\/([^/]+)(?:\/a\/(\d+))?$/);
  const mails = listMails();
  if (url.pathname === '/api/mails') {
    const to = url.searchParams.get('to')?.toLowerCase();
    return sendJson(
      res,
      200,
      mails
        .filter((mail) => !to || recipients(mail).toLowerCase().includes(to))
        .map((mail) => ({
          id: mail.id,
          receivedAt: mail.receivedAt,
          to: recipients(mail),
          subject: mail.subject,
          attachments: (mail.attachments ?? []).map((a) => a.filename),
        })),
    );
  }
  if (match) {
    const mail = mails.find((candidate) => candidate.id === match[1]);
    if (!mail) return send(res, 404, page('No encontrado', '<p>Mail no encontrado</p>'), { 'content-type': 'text/html; charset=utf-8' });
    if (match[2] !== undefined) {
      const attachment = mail.attachments?.[Number(match[2])];
      if (!attachment) return send(res, 404, 'adjunto no encontrado');
      return send(res, 200, attachmentBuffer(attachment), {
        'content-type': attachment.filename?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
        'content-disposition': `attachment; filename="${encodeURIComponent(attachment.filename ?? 'adjunto')}"`,
      });
    }
    const attachments = (mail.attachments ?? [])
      .map((a, i) => `<li><a href="/m/${mail.id}/a/${i}">${escapeHtml(a.filename ?? `adjunto ${i + 1}`)}</a></li>`)
      .join('');
    return send(
      res,
      200,
      page(
        mail.subject ?? 'Mail',
        `<p><a href="/">← Bandeja</a></p><h1>${escapeHtml(mail.subject)}</h1>
<p class="muted">De: ${escapeHtml(mail.from)}<br>Para: ${escapeHtml(recipients(mail))}<br>Recibido: ${escapeHtml(mail.receivedAt)}</p>
${attachments ? `<div class="box"><b>Adjuntos</b><ul>${attachments}</ul></div>` : ''}
<div class="box">${mail.html ?? `<pre>${escapeHtml(mail.text)}</pre>`}</div>`,
      ),
      { 'content-type': 'text/html; charset=utf-8' },
    );
  }
  const to = url.searchParams.get('to') ?? '';
  const rows = mails
    .filter((mail) => !to || recipients(mail).toLowerCase().includes(to.toLowerCase()))
    .slice(0, 200)
    .map(
      (mail) =>
        `<tr><td>${escapeHtml(mail.receivedAt?.slice(11, 19))}</td><td>${escapeHtml(recipients(mail))}</td>
<td><a href="/m/${mail.id}">${escapeHtml(mail.subject)}</a></td><td>${(mail.attachments ?? []).length}</td></tr>`,
    )
    .join('');
  return send(
    res,
    200,
    page(
      'Bandeja de prueba',
      `<h1>Bandeja de entrada (mails capturados)</h1>
<form><label>Destinatario <input name="to" value="${escapeHtml(to)}"></label> <button>Filtrar</button></form>
<table><tr><th>Hora (UTC)</th><th>Para</th><th>Asunto</th><th>Adjuntos</th></tr>${rows || '<tr><td colspan=4>Sin mails</td></tr>'}</table>`,
    ),
    { 'content-type': 'text/html; charset=utf-8' },
  );
}

// ── Mercado Pago ─────────────────────────────────────────────────────────────
const prefFile = (id) => path.join(dirs.mp, `${id}.json`);
const loadPref = (id) => (existsSync(prefFile(id)) ? JSON.parse(readFileSync(prefFile(id), 'utf8')) : null);
const savePref = (pref) => writeFileSync(prefFile(pref.id), JSON.stringify(pref, null, 2));

async function handleMercadoPagoApi(req, res) {
  const url = new URL(req.url, 'https://api.mercadopago.com');
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const id = `pref-${randomUUID()}`;
    const pref = {
      ...body,
      id,
      created_at: new Date().toISOString(),
      init_point: `https://mercadopago.mock.test/checkout?pref_id=${id}`,
      sandbox_init_point: `https://mercadopago.mock.test/checkout?pref_id=${id}`,
      payments: [],
    };
    savePref(pref);
    log('mp preference created', { id, external_reference: body.external_reference, items: body.items });
    return sendJson(res, 201, pref);
  }
  const prefMatch = url.pathname.match(/^\/checkout\/preferences\/([^/]+)$/);
  if (req.method === 'GET' && prefMatch) {
    const pref = loadPref(prefMatch[1]);
    return pref ? sendJson(res, 200, pref) : sendJson(res, 404, { message: 'not found' });
  }
  log('mp api not mocked', { method: req.method, path: url.pathname });
  return sendJson(res, 404, { message: `mp mock: ${req.method} ${url.pathname} no soportado` });
}

// Lo que haría Pluto al recibir el aviso de pago: POST firmado a la plataforma.
async function sendPaymentWebhook(pref) {
  const instanceUrl = new URL(pref.metadata?.instance_url);
  const body = JSON.stringify({ ticketGroupId: pref.metadata?.ticket_group_id ?? pref.external_reference });
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', SIGNING_SECRET).update(`${timestamp}.${body}`).digest('hex');
  const result = await new Promise((resolve) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port: NEXT_PORT,
        method: 'POST',
        path: '/api/mercadopago',
        headers: {
          host: instanceUrl.host,
          'x-forwarded-host': instanceUrl.host,
          'x-forwarded-proto': 'https',
          'content-type': 'application/json',
          'x-timestamp': timestamp,
          'x-signature': `sha256=${signature}`,
        },
      },
      async (response) => resolve({ status: response.statusCode, body: (await readBody(response)).toString().slice(0, 500) }),
    );
    request.on('error', (error) => resolve({ status: 0, body: error.message }));
    request.end(body);
  });
  log('mp webhook sent', { pref: pref.id, ticketGroupId: pref.external_reference, ...result });
  return result;
}

function backUrl(pref, kind, status) {
  const target = new URL(pref.back_urls?.[kind] ?? pref.back_urls?.success);
  const paymentId = String(Math.floor(Math.random() * 1e10));
  for (const [key, value] of Object.entries({
    collection_id: paymentId,
    collection_status: status,
    payment_id: paymentId,
    status,
    external_reference: pref.external_reference ?? 'null',
    payment_type: 'credit_card',
    merchant_order_id: String(Math.floor(Math.random() * 1e10)),
    preference_id: pref.id,
    site_id: 'MLA',
    processing_mode: 'aggregator',
  })) {
    target.searchParams.set(key, value);
  }
  return target.href;
}

const ACTIONS = {
  approve: 'Pagar (aprobado)',
  'approve-late': 'Pagar, el aviso de pago llega 30 s después',
  'approve-dup': 'Pagar, el aviso de pago llega 3 veces a la vez',
  'approve-lost': 'Pagar, el aviso de pago nunca llega',
  pending: 'Pago pendiente (efectivo)',
  'pending-late': 'Efectivo: se acredita más tarde (aviso en STACK_MP_LATE_CASH_MS, 2 min por defecto)',
  reject: 'Tarjeta rechazada',
};

const LATE_CASH_MS = Number(process.env.STACK_MP_LATE_CASH_MS ?? 120_000);

/** Como el Mercado Pago real: una preferencia con expires no se cobra pasado expiration_date_to. */
function isExpired(pref) {
  return Boolean(
    pref.expires && pref.expiration_date_to && Date.now() > new Date(pref.expiration_date_to).getTime(),
  );
}

async function handleMercadoPagoUi(req, res) {
  const url = new URL(req.url, 'https://mercadopago.mock.test');
  const html = (title, body) => send(res, 200, page(title, body), { 'content-type': 'text/html; charset=utf-8' });
  if (req.method === 'GET' && url.pathname === '/checkout') {
    const pref = loadPref(url.searchParams.get('pref_id'));
    if (!pref) return html('Mercado Pago (prueba)', '<h1>Preferencia inexistente</h1>');
    if (isExpired(pref)) {
      return html(
        'Mercado Pago (prueba)',
        `<h1>Este link de pago venció</h1><p class="muted">Venció ${escapeHtml(pref.expiration_date_to)}.</p>
<p><a href="${escapeHtml(pref.back_urls?.failure ?? '#')}">Volver al sitio</a></p>`,
      );
    }
    const total = (pref.items ?? []).reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const items = (pref.items ?? [])
      .map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.quantity}</td><td>$ ${escapeHtml(item.unit_price)}</td></tr>`)
      .join('');
    const buttons = Object.entries(ACTIONS)
      .map(([action, label]) => `<button name="action" value="${action}">${escapeHtml(label)}</button><br>`)
      .join('');
    const previous = pref.payments.length
      ? `<p class="muted">Pagos anteriores sobre esta preferencia: ${pref.payments.map((p) => escapeHtml(p.action)).join(', ')}</p>`
      : '';
    return html(
      'Mercado Pago (prueba)',
      `<h1>Mercado Pago <small class="muted">(simulado)</small></h1>
<div class="box"><table><tr><th>Ítem</th><th>Cant.</th><th>Precio</th></tr>${items}</table>
<p><b>Total: $ ${escapeHtml(total)}</b></p></div>${previous}
<form method="post" action="/checkout/pay?pref_id=${encodeURIComponent(pref.id)}">${buttons}</form>
<p><a href="${escapeHtml(pref.back_urls?.failure ?? '#')}">Volver al sitio sin pagar</a></p>`,
    );
  }
  if (req.method === 'POST' && url.pathname === '/checkout/pay') {
    const pref = loadPref(url.searchParams.get('pref_id'));
    const form = new URLSearchParams((await readBody(req)).toString());
    const action = form.get('action');
    if (!pref || !ACTIONS[action]) return html('Error', '<h1>Pedido inválido</h1>');
    if (isExpired(pref)) return html('Mercado Pago (prueba)', '<h1>Este link de pago venció</h1>');
    pref.payments.push({ action, at: new Date().toISOString() });
    savePref(pref);
    log('mp checkout action', { pref: pref.id, action });
    let location;
    if (action === 'approve') {
      await sendPaymentWebhook(pref);
      location = backUrl(pref, 'success', 'approved');
    } else if (action === 'approve-late') {
      setTimeout(() => void sendPaymentWebhook(pref), 30_000);
      location = backUrl(pref, 'success', 'approved');
    } else if (action === 'approve-dup') {
      await Promise.all([sendPaymentWebhook(pref), sendPaymentWebhook(pref), sendPaymentWebhook(pref)]);
      location = backUrl(pref, 'success', 'approved');
    } else if (action === 'approve-lost') {
      location = backUrl(pref, 'success', 'approved');
    } else if (action === 'pending') {
      location = backUrl(pref, 'pending', 'pending');
    } else if (action === 'pending-late') {
      // El cupón se generó antes del vencimiento y se paga después: el aviso llega igual.
      setTimeout(() => void sendPaymentWebhook(pref), LATE_CASH_MS);
      location = backUrl(pref, 'pending', 'pending');
    } else {
      location = backUrl(pref, 'failure', 'rejected');
    }
    return send(res, 303, '', { location });
  }
  return html('Mercado Pago (prueba)', '<h1>Página inexistente</h1>');
}

// ── Next ─────────────────────────────────────────────────────────────────────
function proxyToNext(req, res, host) {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: NEXT_PORT,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        'x-forwarded-host': host,
        'x-forwarded-proto': 'https',
        'x-forwarded-for': req.socket.remoteAddress,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`proxy: ${error.message}`);
  });
  req.pipe(upstream);
}

async function route(req, res) {
  const host = (req.headers['x-stack-original-host'] ?? req.headers.host ?? '').split(':')[0].toLowerCase();
  try {
    if (req.url.startsWith('/resend/')) return await handleResend(req, res);
    if (host.endsWith('.amazonaws.com')) return await handleS3(req, res, host);
    if (host === 'api.mercadopago.com') return await handleMercadoPagoApi(req, res);
    if (host === 'mercadopago.mock.test') return await handleMercadoPagoUi(req, res);
    if (host === 'mail.mock.test') return await handleMailViewer(req, res);
    if (host === 'pn.test' || host.endsWith('.pn.test')) return proxyToNext(req, res, req.headers.host);
    return send(res, 404, `mocks: host desconocido ${host}`);
  } catch (error) {
    log('mock error', { host, url: req.url, error: error.stack });
    if (!res.headersSent) send(res, 500, `mocks: ${error.message}`);
  }
}

http.createServer(route).listen(INTERNAL_PORT, '127.0.0.1', () => console.log(`mocks http on ${INTERNAL_PORT}`));

// macOS sólo deja escuchar en el 443 sin root sobre todas las interfaces, así
// que se cortan las conexiones que no vienen de la propia máquina (salvo
// STACK_ALLOW_LAN=1, para probar desde un celular en la misma red).
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const front = https.createServer(
  {
    key: readFileSync(path.join(RUN, 'tls.key')),
    cert: readFileSync(path.join(RUN, 'tls.crt')),
  },
  route,
);
front.on('connection', (socket) => {
  if (process.env.STACK_ALLOW_LAN !== '1' && !LOOPBACK.has(socket.remoteAddress)) socket.destroy();
});
front.listen(HTTPS_PORT, '0.0.0.0', () => console.log(`mocks https on ${HTTPS_PORT}`));
