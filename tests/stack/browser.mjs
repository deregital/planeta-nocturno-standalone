#!/usr/bin/env node
// Navegador para agentes (y personas) contra el stack simulado. Cada sesión es
// un Chromium propio que queda vivo entre comandos (cookies, pestañas, login),
// así un agente usa la app paso a paso como un usuario real.
//
//   tests/stack/pw <sesión> open https://prueba.pn.test
//   tests/stack/pw <sesión> click e12
//   tests/stack/pw <sesión> help
//
// Resuelve *.pn.test, *.mock.test y el bucket de S3 a 127.0.0.1 (mocks.mjs).
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STACK = path.dirname(fileURLToPath(import.meta.url));
const RUN = path.join(STACK, '.run');
const DIR = path.join(RUN, 'browser');
const IDLE_MS = 45 * 60_000;
const SNAP_LIMIT = 14_000;
// Ruido propio del entorno local (no existe fuera de Vercel): no se reporta.
const IGNORED = [/\/_vercel\/(insights|speed-insights)\//, /Refused to execute script from .*\/_vercel\//];
const ignored = (text) => IGNORED.some((re) => re.test(text));

const HELP = `Comandos (tests/stack/pw <sesión> <comando> ...):
  open <url>                 navega y muestra la página
  snap [--full]              árbol de accesibilidad con refs [ref=eN]
  text                       texto visible de la página
  click <ref> [--double]     clic en un elemento (ref del snapshot)
  fill <ref> <texto>         reemplaza el contenido de un input
  type <texto>               tipea en el elemento con foco (tecla por tecla)
  press <tecla>              Enter, Tab, Escape, ArrowDown, Control+A...
  select <ref> <valor>...    elige opciones de un <select>
  check <ref> | uncheck <ref>
  hover <ref>
  upload <ref> <archivo>...  sube archivos a un input file
  scroll [down|up]
  back | forward | reload
  wait <segundos>            espera (máx. 120)
  waitfor <texto> [seg]      espera a que aparezca un texto
  shot [--full]              captura de pantalla (devuelve la ruta del PNG)
  console                    errores de consola acumulados (todos)
  net                        requests fallidos acumulados (todos)
  tabs | tab <n> | tab new [url] | tab close
  device mobile|instagram|desktop
                             celular Android 393×727 (por defecto), el navegador interno
                             de Instagram, o escritorio 1366×860; conserva las cookies.
                             Para elegirlo al abrir la sesión: --desktop o --instagram
  camera <png|pdf> [--zoom N] | camera blank
                             qué "ve" la cámara falsa (para el scanner QR)
  network offline|slow|normal sin conexión, 3G lenta (400 ms, 400 kbps) o normal
  dialog accept|dismiss      cómo responder el próximo confirm()/prompt()
  eval <js>                  evalúa JS en la página (sólo para inspeccionar)
  cookies | clear-cookies
  close                      cierra el navegador de la sesión
Después de cada acción se muestra la URL, errores nuevos de consola/red y el snapshot
(agregá --no-snap para omitirlo).`;

// ── Cliente ──────────────────────────────────────────────────────────────────
async function client() {
  const [session, ...args] = process.argv.slice(2);
  if (!session || session === 'help' || session === '--help') {
    console.log('Uso: tests/stack/pw <sesión> <comando> [args]\n\n' + HELP);
    return;
  }
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(session)) throw new Error('nombre de sesión inválido');
  mkdirSync(DIR, { recursive: true });
  const socket = path.join(DIR, `${session}.sock`);
  if (args[0] === 'close' && !existsSync(socket)) {
    console.log('sesión cerrada');
    return;
  }
  let connection = await connect(socket).catch(() => null);
  if (!connection) {
    rmSync(socket, { force: true });
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'daemon', session], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: {
        ...process.env,
        PW_INITIAL_DEVICE: args.includes('--instagram') ? 'instagram' : args.includes('--desktop') ? 'desktop' : 'mobile',
      },
    });
    child.unref();
    for (let i = 0; i < 100 && !connection; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      connection = await connect(socket).catch(() => null);
    }
    if (!connection) throw new Error('no arrancó el navegador (ver .run/browser/<sesión>.daemon.log)');
  }
  const reply = await new Promise((resolve, reject) => {
    let data = '';
    connection.on('data', (chunk) => (data += chunk));
    connection.on('end', () => resolve(data));
    connection.on('error', reject);
    connection.end(JSON.stringify({ args, cwd: process.cwd() }));
  });
  const { output, error } = JSON.parse(reply || '{"error":"sin respuesta"}');
  if (output) console.log(output);
  if (error) {
    console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  }
}

function connect(socket) {
  return new Promise((resolve, reject) => {
    const connection = net.createConnection(socket);
    connection.once('connect', () => resolve(connection));
    connection.once('error', reject);
  });
}

// ── Chromium compartido ──────────────────────────────────────────────────────
// Todas las sesiones usan un solo Chromium (cada una en su contexto aislado, con
// sus cookies): con muchos agentes a la vez, un Chromium por sesión agota la RAM.
const CHROMIUM_ARGS = [
  '--host-resolver-rules=MAP *.pn.test 127.0.0.1, MAP pn.test 127.0.0.1, MAP *.mock.test 127.0.0.1, MAP planeta-nocturno.s3.us-east-1.amazonaws.com 127.0.0.1',
  '--ignore-certificate-errors',
];
const WS_FILE = path.join(DIR, 'chromium.ws');
const LOCK = path.join(DIR, 'chromium.lock');

async function chromiumServer() {
  const { chromium } = await import('playwright-core');
  const server = await chromium.launchServer({ headless: true, args: CHROMIUM_ARGS });
  writeFileSync(WS_FILE, server.wsEndpoint());
  const stop = async () => {
    rmSync(WS_FILE, { force: true });
    await server.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

async function sharedBrowser(chromium) {
  const tryConnect = async () => {
    if (!existsSync(WS_FILE)) return null;
    return chromium.connect(readFileSync(WS_FILE, 'utf8'), { timeout: 5_000 }).catch(() => null);
  };
  let browser = await tryConnect();
  if (browser) return browser;
  let owner = false;
  try {
    mkdirSync(LOCK);
    owner = true;
  } catch {}
  if (owner) {
    rmSync(WS_FILE, { force: true });
    spawn(process.execPath, [fileURLToPath(import.meta.url), 'chromium-server'], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    }).unref();
  }
  for (let i = 0; i < 150 && !browser; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    browser = await tryConnect();
  }
  if (owner) rmSync(LOCK, { recursive: true, force: true });
  if (!browser) throw new Error('no arrancó el Chromium compartido');
  return browser;
}

// ── Daemon ───────────────────────────────────────────────────────────────────
const FAKE_CAMERA = `(() => {
  if (window.__fakeCam || !navigator.mediaDevices) return;
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 720;
  const ctx = canvas.getContext('2d');
  let image = null; let zoom = 1; let frame = 0;
  const draw = () => {
    frame += 1;
    ctx.fillStyle = frame % 2 ? '#202020' : '#212121';
    ctx.fillRect(0, 0, 720, 720);
    if (image) {
      const scale = Math.min(720 / image.width, 720 / image.height) * zoom;
      const w = image.width * scale; const h = image.height * scale;
      ctx.drawImage(image, (720 - w) / 2, (720 - h) / 2, w, h);
    }
  };
  setInterval(draw, 33);
  window.__fakeCam = {
    show(dataUrl, z) { const i = new Image(); i.onload = () => { image = i; zoom = z || 1; }; i.src = dataUrl; },
    blank() { image = null; },
  };
  const original = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (constraints && constraints.video) return canvas.captureStream(30);
    return original(constraints);
  };
  navigator.mediaDevices.enumerateDevices = async () => [
    { deviceId: 'fake-camera', groupId: 'fake', kind: 'videoinput', label: 'Cámara de prueba', toJSON() { return this; } },
  ];
})();`;

async function daemon(session) {
  const { chromium, devices } = await import('playwright-core');
  const socket = path.join(DIR, `${session}.sock`);
  const logFile = path.join(DIR, `${session}.log`);
  const shots = path.join(RUN, 'shots', session);
  const downloads = path.join(RUN, 'downloads', session);
  mkdirSync(shots, { recursive: true });
  mkdirSync(downloads, { recursive: true });
  const daemonLog = (line) => appendFileSync(path.join(DIR, `${session}.daemon.log`), `${new Date().toISOString()} ${line}\n`);

  const browser = await sharedBrowser(chromium);
  browser.on('disconnected', () => {
    daemonLog('chromium desconectado');
    rmSync(socket, { force: true });
    process.exit(1);
  });

  const state = {
    device: process.env.PW_INITIAL_DEVICE ?? 'mobile',
    context: null,
    pages: [],
    active: 0,
    consoleAll: [],
    netAll: [],
    consoleNew: [],
    netNew: [],
    dialogs: [],
    dialogPolicy: 'accept',
    downloads: [],
    camera: null,
    network: 'normal',
  };
  const page = () => state.pages[state.active];

  function track(p) {
    state.pages.push(p);
    p.on('console', (msg) => {
      if (!['error', 'warning'].includes(msg.type())) return;
      const text = `[${msg.type()}] ${msg.text().slice(0, 600)}`;
      if (ignored(text) || ignored(msg.location()?.url ?? '')) return;
      state.consoleAll.push(text);
      state.consoleNew.push(text);
    });
    p.on('pageerror', (error) => {
      const text = `[pageerror] ${String(error.stack ?? error).slice(0, 800)}`;
      state.consoleAll.push(text);
      state.consoleNew.push(text);
    });
    p.on('response', async (response) => {
      const status = response.status();
      const url = response.url();
      if (status < 400 || ignored(url)) return;
      let body = '';
      try {
        body = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
      } catch {}
      const text = `${response.request().method()} ${url} → ${status} ${body}`;
      state.netAll.push(text);
      state.netNew.push(text);
    });
    p.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? '';
      if (failure.includes('ERR_ABORTED')) return;
      const text = `${request.method()} ${request.url()} → FALLÓ ${failure}`;
      state.netAll.push(text);
      state.netNew.push(text);
    });
    p.on('dialog', async (dialog) => {
      state.dialogs.push(`${dialog.type()}: "${dialog.message()}" → ${state.dialogPolicy}`);
      if (state.dialogPolicy === 'accept') await dialog.accept().catch(() => {});
      else await dialog.dismiss().catch(() => {});
      state.dialogPolicy = 'accept';
    });
    p.on('download', async (download) => {
      const file = path.join(downloads, `${Date.now()}-${download.suggestedFilename()}`);
      await download.saveAs(file).catch(() => {});
      state.downloads.push(file);
    });
    p.on('close', () => {
      const index = state.pages.indexOf(p);
      if (index >= 0) state.pages.splice(index, 1);
      if (state.active >= state.pages.length) state.active = Math.max(0, state.pages.length - 1);
    });
  }

  async function newContext(storageState) {
    // Celular: Android con el viewport típico medido en PostHog (390–402 × ~720,
    // con la barra del navegador). "instagram" suma el navegador interno de
    // Instagram, por donde entra ~1 de cada 4 visitas desde el celular.
    const phone = { ...devices['Pixel 7'], viewport: { width: 393, height: 727 } };
    const base =
      state.device === 'desktop'
        ? { viewport: { width: 1366, height: 860 } }
        : state.device === 'instagram'
          ? { ...phone, userAgent: `${phone.userAgent} Instagram 350.0.0.30.97 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; tensor; es_AR; 645370941)` }
          : phone;
    const context = await browser.newContext({
      ...base,
      ignoreHTTPSErrors: true,
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Buenos_Aires',
      acceptDownloads: true,
      storageState,
    });
    await context.addInitScript(FAKE_CAMERA);
    context.on('page', track);
    state.context = context;
    state.pages = [];
    state.active = 0;
    await context.newPage();
    if (state.camera) await applyCamera();
    if (state.network !== 'normal') await applyNetwork();
  }

  // Se aplica por pestaña (CDP) y también a las que se abran después.
  async function applyNetwork() {
    await state.context.setOffline(state.network === 'offline');
    for (const p of state.pages) {
      const cdp = await state.context.newCDPSession(p).catch(() => null);
      if (!cdp) continue;
      await cdp
        .send('Network.emulateNetworkConditions', {
          offline: state.network === 'offline',
          latency: state.network === 'slow' ? 400 : 0,
          downloadThroughput: state.network === 'slow' ? 50_000 : -1,
          uploadThroughput: state.network === 'slow' ? 50_000 : -1,
        })
        .catch(() => {});
    }
  }

  async function applyCamera() {
    for (const p of state.pages) {
      await p
        .evaluate(([dataUrl, zoom]) => (dataUrl ? window.__fakeCam?.show(dataUrl, zoom) : window.__fakeCam?.blank()), [
          state.camera?.dataUrl ?? null,
          state.camera?.zoom ?? 1,
        ])
        .catch(() => {});
    }
  }

  await newContext();

  async function settle() {
    const p = page();
    if (!p) return;
    // Las server actions y router.push navegan un rato después del clic.
    await p.waitForTimeout(500);
    await p.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    await p.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => {});
    if (state.camera) await applyCamera();
  }

  async function snapshot(full) {
    const p = page();
    if (!p) return '(sin pestañas abiertas)';
    let snap;
    try {
      snap = await p.ariaSnapshot({ mode: 'ai', timeout: 10_000 });
    } catch (error) {
      return `(no se pudo sacar el snapshot: ${error.message})`;
    }
    if (!full && snap.length > SNAP_LIMIT) {
      snap = `${snap.slice(0, SNAP_LIMIT)}\n… (snapshot recortado: ${snap.length} caracteres; usá "snap --full" o "text")`;
    }
    return snap;
  }

  function ref(value) {
    if (!value) throw new Error('falta la ref (ej. e12) del snapshot');
    if (/^e\d+$/.test(value)) return page().locator(`aria-ref=${value}`);
    return page().getByText(value, { exact: false }).first();
  }

  async function report({ snap = true, full = false } = {}) {
    const p = page();
    const lines = [];
    if (p) lines.push(`URL: ${p.url()}`, `Título: ${await p.title().catch(() => '')}`);
    if (state.pages.length > 1) lines.push(`Pestañas: ${state.pages.length} (activa ${state.active})`);
    if (state.dialogs.length) lines.push(`Diálogos: ${state.dialogs.splice(0).join(' | ')}`);
    if (state.downloads.length) lines.push(`Descargas: ${state.downloads.splice(0).join(', ')}`);
    if (state.consoleNew.length) lines.push('Consola (nuevo):', ...state.consoleNew.splice(0).map((l) => `  ${l}`));
    if (state.netNew.length) lines.push('Red con error (nuevo):', ...state.netNew.splice(0).map((l) => `  ${l}`));
    if (snap) lines.push('', await snapshot(full));
    return lines.join('\n');
  }

  async function run(args) {
    const noSnap = args.includes('--no-snap');
    const clean = args.filter((a) => !['--no-snap', '--mobile', '--instagram', '--desktop'].includes(a));
    const [command, ...rest] = clean;
    const after = async () => {
      await settle();
      return report({ snap: !noSnap });
    };
    switch (command) {
      case undefined:
      case 'help':
        return HELP;
      case 'open': {
        if (!page()) await state.context.newPage();
        const url = rest[0].includes('://') ? rest[0] : `https://${rest[0]}`;
        await page().goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        return after();
      }
      case 'snap':
        return report({ snap: true, full: rest.includes('--full') });
      case 'text': {
        const text = await page().evaluate(() => document.body.innerText);
        return text.length > 20_000 ? `${text.slice(0, 20_000)}\n… (recortado)` : text;
      }
      case 'click':
        if (rest.includes('--double')) await ref(rest[0]).dblclick({ timeout: 10_000 });
        else await ref(rest[0]).click({ timeout: 10_000 });
        return after();
      case 'fill':
        await ref(rest[0]).fill(rest.slice(1).join(' '), { timeout: 10_000 });
        return report({ snap: false });
      case 'type':
        await page().keyboard.type(rest.join(' '), { delay: 30 });
        return report({ snap: false });
      case 'press':
        await page().keyboard.press(rest[0]);
        return after();
      case 'select':
        await ref(rest[0]).selectOption(rest.slice(1), { timeout: 10_000 });
        return after();
      case 'check':
        await ref(rest[0]).check({ timeout: 10_000 });
        return after();
      case 'uncheck':
        await ref(rest[0]).uncheck({ timeout: 10_000 });
        return after();
      case 'hover':
        await ref(rest[0]).hover({ timeout: 10_000 });
        return after();
      case 'upload':
        await ref(rest[0]).setInputFiles(rest.slice(1), { timeout: 10_000 });
        return after();
      case 'scroll':
        await page().mouse.wheel(0, rest[0] === 'up' ? -700 : 700);
        await page().waitForTimeout(300);
        return report({ snap: !noSnap });
      case 'back':
        await page().goBack({ timeout: 15_000 }).catch(() => {});
        return after();
      case 'forward':
        await page().goForward({ timeout: 15_000 }).catch(() => {});
        return after();
      case 'reload':
        await page().reload({ timeout: 30_000 });
        return after();
      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, Math.min(Number(rest[0]) || 1, 120) * 1000));
        return after();
      case 'waitfor':
        await page()
          .getByText(rest[0], { exact: false })
          .first()
          .waitFor({ timeout: Math.min(Number(rest[1]) || 15, 120) * 1000 });
        return after();
      case 'shot': {
        const file = path.join(shots, `${Date.now()}.png`);
        await page().screenshot({ path: file, fullPage: rest.includes('--full') });
        return `Captura: ${file}`;
      }
      case 'console':
        state.consoleNew = [];
        return state.consoleAll.length ? state.consoleAll.join('\n') : '(sin errores de consola)';
      case 'net':
        state.netNew = [];
        return state.netAll.length ? state.netAll.join('\n') : '(sin requests fallidos)';
      case 'tabs':
        return (
          await Promise.all(state.pages.map(async (p, i) => `${i === state.active ? '*' : ' '} ${i}: ${p.url()} — ${await p.title().catch(() => '')}`))
        ).join('\n');
      case 'tab': {
        if (rest[0] === 'new') {
          const p = await state.context.newPage();
          state.active = state.pages.indexOf(p);
          if (state.network !== 'normal') await applyNetwork();
          if (rest[1]) await p.goto(rest[1].includes('://') ? rest[1] : `https://${rest[1]}`, { waitUntil: 'domcontentloaded' });
          return after();
        }
        if (rest[0] === 'close') {
          await page().close();
          return report({ snap: !noSnap });
        }
        const index = Number(rest[0]);
        if (!state.pages[index]) throw new Error(`no existe la pestaña ${rest[0]}`);
        state.active = index;
        await page().bringToFront();
        return report({ snap: !noSnap });
      }
      case 'device': {
        const target = ['mobile', 'instagram'].includes(rest[0]) ? rest[0] : 'desktop';
        const url = page()?.url();
        const storage = await state.context.storageState();
        await state.context.close();
        state.device = target;
        await newContext(storage);
        if (url && url !== 'about:blank') await page().goto(url, { waitUntil: 'domcontentloaded' });
        return after();
      }
      case 'camera': {
        if (rest[0] === 'blank') {
          state.camera = { dataUrl: null };
          await applyCamera();
          return 'Cámara: imagen vacía';
        }
        let file = path.resolve(rest[0]);
        if (!existsSync(file)) throw new Error(`no existe ${file}`);
        if (file.endsWith('.pdf')) {
          const out = path.join(shots, `camera-${Date.now()}`);
          execFileSync('pdftoppm', ['-png', '-r', '110', '-singlefile', file, out]);
          file = `${out}.png`;
        }
        const zoomIndex = rest.indexOf('--zoom');
        const zoom = zoomIndex >= 0 ? Number(rest[zoomIndex + 1]) || 1 : 1;
        state.camera = { dataUrl: `data:image/png;base64,${readFileSync(file).toString('base64')}`, zoom };
        await applyCamera();
        return `Cámara mostrando ${path.basename(file)} (zoom ${zoom})`;
      }
      case 'network': {
        const mode = ['offline', 'slow'].includes(rest[0]) ? rest[0] : 'normal';
        state.network = mode;
        await applyNetwork();
        return `Red: ${mode}`;
      }
      case 'dialog':
        state.dialogPolicy = rest[0] === 'dismiss' ? 'dismiss' : 'accept';
        return `El próximo diálogo se va a responder con: ${state.dialogPolicy}`;
      case 'eval': {
        const result = await page().evaluate(rest.join(' '));
        return JSON.stringify(result, null, 2)?.slice(0, 10_000) ?? 'undefined';
      }
      case 'cookies':
        return JSON.stringify(
          (await state.context.cookies()).map(({ name, domain, path: p, expires, httpOnly, secure }) => ({ name, domain, path: p, expires, httpOnly, secure })),
          null,
          2,
        );
      case 'clear-cookies':
        await state.context.clearCookies();
        return 'Cookies borradas';
      case 'close':
        setTimeout(() => shutdown(), 50);
        return 'Navegador cerrado';
      default:
        throw new Error(`comando desconocido: ${command}\n\n${HELP}`);
    }
  }

  let idle;
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(() => shutdown(), IDLE_MS);
  };
  let queue = Promise.resolve();
  const server = net.createServer({ allowHalfOpen: true }, (connection) => {
    let data = '';
    connection.on('data', (chunk) => (data += chunk));
    connection.on('end', () => {
      queue = queue.then(async () => {
        touch();
        const { args } = JSON.parse(data);
        appendFileSync(logFile, `${new Date().toISOString()} ${JSON.stringify(args)}\n`);
        let reply;
        try {
          reply = { output: await run(args) };
        } catch (error) {
          const extra = await report({ snap: false }).catch(() => '');
          reply = { error: `${error.message.split('\n')[0]}\n${extra}` };
        }
        connection.end(JSON.stringify(reply));
      });
    });
  });

  async function shutdown() {
    server.close();
    rmSync(socket, { force: true });
    await state.context?.close().catch(() => {});
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => daemonLog(`uncaught ${error.stack}`));
  server.listen(socket, () => {
    writeFileSync(path.join(DIR, `${session}.pid`), String(process.pid));
    touch();
  });
}

if (process.argv[2] === 'chromium-server') {
  chromiumServer().catch((error) => {
    appendFileSync(path.join(DIR, 'chromium.log'), `${error.stack}\n`);
    process.exit(1);
  });
} else if (process.argv[2] === 'daemon') {
  daemon(process.argv[3]).catch((error) => {
    appendFileSync(path.join(DIR, `${process.argv[3]}.daemon.log`), `${error.stack}\n`);
    process.exit(1);
  });
} else {
  client().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
