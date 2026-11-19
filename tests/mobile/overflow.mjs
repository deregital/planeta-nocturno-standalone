#!/usr/bin/env node
// Recorre la app con un celular de 360×640 por cada rol (todas las rutas de
// src/app más los links que encuentra), abre modals, popovers y menús de fila,
// y falla si algo se sale de la pantalla, queda cortado por un overflow-hidden,
// se sale de su propia caja o si un modal no entra a lo alto y no tiene scroll.
//
// Usa la misma detección que el aviso de desarrollo (src/lib/mobile-overflow.ts).
//
//   npm run test:mobile                       # contra el stack (tests/stack)
//   MOBILE_BASE_URL=http://prueba.localhost:3000 MOBILE_USERS='[...]' npm run test:mobile
//
// Variables:
//   MOBILE_BASE_URL     plataforma a recorrer (por defecto https://prueba.pn.test)
//   MOBILE_CONTROL_URL  panel central (por defecto https://admin.pn.test; "" para saltearlo)
//   MOBILE_SEED         seed.json del stack con usuarios y contraseña
//                       (por defecto tests/stack/.run/seed.json)
//   MOBILE_USERS        JSON [{ "username", "password", "control"?: true }] en vez del seed
//   MOBILE_PATHS        rutas extra sin login, separadas por coma (p. ej. /tickets/<id>)
//   MOBILE_ROLES        sólo estos usuarios (coma), "anon" para el visitante
//   MOBILE_WIDTH/HEIGHT tamaño de pantalla (360 × 640)
//   MOBILE_OUT          carpeta de capturas (test-results/mobile-overflow)
//
// Ojo: el visitante llega hasta /checkout (deja una reserva que vence sola) y los
// menús de fila se prueban salteando acciones que cambian datos.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { chromium, devices } from 'playwright-core';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const env = process.env;
const BASE = (env.MOBILE_BASE_URL ?? 'https://prueba.pn.test').replace(
  /\/$/,
  '',
);
const CONTROL = (env.MOBILE_CONTROL_URL ?? 'https://admin.pn.test').replace(
  /\/$/,
  '',
);
const WIDTH = Number(env.MOBILE_WIDTH ?? 360);
const HEIGHT = Number(env.MOBILE_HEIGHT ?? 640);
const OUT = path.resolve(
  ROOT,
  env.MOBILE_OUT ?? 'test-results/mobile-overflow',
);
const MAX_PAGES = 60;
const MAX_PER_PATTERN = 2;
const MAX_TRIGGERS = 30;

// Nunca tocar lo que cambia datos o sale del sitio.
const SKIP_LINK =
  /logout|signout|\/api\/|unlink|\.pdf$|^mailto:|^tel:|wa\.me|instagram\.com|mercadopago/i;
const DANGER =
  /eliminar|borrar|desvincular|desactivar|activar|archivar|restaurar|enviar|reenviar|confirmar|guardar|pagar|comprar|cancelar|liberar|sortear|escane|scan|manual|ingres|marcar|aprobar|rechazar|descargar|copiar|duplicar|cerrar sesi|salir|publicar/i;
// En un menú de fila, "Emitir" emite directo; como botón abre el formulario.
const MENU_DANGER = new RegExp(`${DANGER.source}|emitir`, 'i');
const LIKELY =
  /crear|nuev|agregar|editar|ver |^ver$|link|credencial|etiquet|contraseñ|carpeta|emitir|sorteo|qr|importar|columnas|campos|exportar|distribu|asignar|organizador|fecha|categor|locaci|historial|comentario|opciones|menú|menu/i;
const LIKELY_ICON =
  /pencil|user-pen|tag|eye|qr|calendar|clock|history|settings|ellipsis|more|menu/;

function loadUsers() {
  if (env.MOBILE_USERS) return JSON.parse(env.MOBILE_USERS);
  const seedPath = path.resolve(
    ROOT,
    env.MOBILE_SEED ?? 'tests/stack/.run/seed.json',
  );
  if (!existsSync(seedPath)) return [];
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const tenant =
    Object.values(seed.tenants ?? {}).find((t) =>
      BASE.includes(new URL(t.url).host),
    ) ?? Object.values(seed.tenants ?? {})[0];
  // Un usuario por rol alcanza: las pantallas dependen del rol.
  const byRole = new Map();
  for (const user of tenant?.users ?? [])
    if (!byRole.has(user.role)) byRole.set(user.role, user);
  const users = [...byRole.values()].map((user) => ({
    username: user.username,
    password: seed.password,
  }));
  if (CONTROL && seed.control)
    users.push({
      username: seed.control.username,
      password: seed.control.password,
      control: true,
    });
  return users;
}

function detectorSource() {
  const source = readFileSync(
    path.join(ROOT, 'src/lib/mobile-overflow.ts'),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  return `${js.replace(/^export /gm, '')}\nwindow.__findMobileOverflows = () => findMobileOverflows().map(({ kind, amount, description }) => ({ kind, amount, description }));`;
}

// Rutas de la app (src/app/**/page.tsx): así se recorren también las pantallas
// a las que se entra con un botón (editar evento, crear evento) y las nuevas
// entran solas, sin tener que sumarlas acá.
function loadRoutes() {
  const routes = { tenant: [], control: [] };
  const walk = (dir, segments, isProtected) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (/^[@_]/.test(entry.name)) continue;
        const group = /^\(.*\)$/.test(entry.name);
        walk(
          path.join(dir, entry.name),
          group ? segments : [...segments, entry.name],
          isProtected ||
            entry.name === '(backoffice)' ||
            entry.name === '(protected)',
        );
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        const [first, ...rest] = segments;
        if (first === 'api' || first === 'landing') continue;
        if (first === 'control') {
          routes.control.push({ template: `/${rest.join('/')}`, isProtected });
        } else {
          routes.tenant.push({
            template: `/${segments.join('/')}`,
            isProtected,
          });
        }
      }
    }
  };
  walk(path.join(ROOT, 'src/app'), [], false);
  return routes;
}
const ROUTES = loadRoutes();

const isDynamic = (template) => template.includes('[');

/** Parámetros de una ruta (`/admin/event/[slug]`) para una URL, o null. */
function matchRoute(template, pathname) {
  const t = template.split('/').filter(Boolean);
  const p = pathname.split('/').filter(Boolean);
  if (t.length !== p.length) return null;
  const params = {};
  for (let i = 0; i < t.length; i += 1) {
    const param = t[i].match(/^\[([^\].]+)\]$/);
    if (param) params[param[1]] = decodeURIComponent(p[i]);
    else if (t[i] !== p[i]) return null;
  }
  return params;
}

/** La entidad de un parámetro: el segmento anterior que no es un verbo. */
function paramKey(template, name) {
  const segments = template.split('/').filter(Boolean);
  const index = segments.indexOf(`[${name}]`);
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!/^(edit|new|create)$/.test(segments[i]))
      return `${segments[i]}:${name}`;
  }
  return name;
}

function routeFor(routes, pathname) {
  return (
    routes.find((r) => !isDynamic(r.template) && r.template === pathname) ??
    routes.find(
      (r) => isDynamic(r.template) && matchRoute(r.template, pathname),
    )
  );
}

const problems = [];
let shotCount = 0;

async function record(page, role, context, found) {
  if (!found.length) return;
  const file = path.join(
    OUT,
    `${String(++shotCount).padStart(3, '0')}-${role}.png`,
  );
  await page.screenshot({ path: file }).catch(() => {});
  for (const problem of found)
    problems.push({
      role,
      url: new URL(page.url()).pathname,
      context,
      ...problem,
      shot: path.relative(ROOT, file),
    });
}

async function measure(page, role, context) {
  await page.waitForTimeout(500);
  const found = await page
    .evaluate(() => window.__findMobileOverflows())
    .catch(() => []);
  await record(page, role, context, found);
}

async function settle(page) {
  await page
    .waitForLoadState('networkidle', { timeout: 12000 })
    .catch(() => {});
  await page.waitForTimeout(500);
}

async function tagTriggers(page) {
  return page.$$eval('button, [role=button], [aria-haspopup]', (elements) =>
    elements.map((element, index) => {
      element.setAttribute('data-mobile-i', String(index));
      const rect = element.getBoundingClientRect();
      const icon =
        [...(element.querySelector('svg')?.classList ?? [])].find(
          (c) => c.startsWith('lucide-') && c !== 'lucide',
        ) ?? '';
      return {
        index,
        icon,
        text: (
          element.innerText ||
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          ''
        )
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 50),
        popup: element.getAttribute('aria-haspopup'),
        submit: element.getAttribute('type') === 'submit',
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          !element.closest('[role=dialog],[role=alertdialog],a[href]'),
      };
    }),
  );
}

async function closeAll(page, url) {
  for (let i = 0; i < 2; i += 1) {
    if (
      !(await page.$(
        '[role=dialog], [role=alertdialog], [role=menu], [data-radix-popper-content-wrapper]',
      ))
    )
      return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  if (await page.$('[role=dialog], [role=alertdialog]')) {
    await page.goto(url);
    await settle(page);
  }
}

async function exploreTriggers(page, role) {
  const url = page.url();
  const seen = new Set();
  const picked = (await tagTriggers(page)).filter((t) => {
    if (!t.visible || t.submit || DANGER.test(t.text)) return false;
    if (
      !(
        t.popup === 'dialog' ||
        t.popup === 'menu' ||
        LIKELY.test(t.text) ||
        LIKELY_ICON.test(t.icon)
      )
    )
      return false;
    const key = `${t.popup}|${t.text}|${t.icon}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const trigger of picked.slice(0, MAX_TRIGGERS)) {
    try {
      if (page.url() !== url) {
        await page.goto(url);
        await settle(page);
        await tagTriggers(page);
      }
      const handle = await page.$(`[data-mobile-i="${trigger.index}"]`);
      if (!handle) continue;
      await handle.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(600);
      if (page.url() !== url) continue;
      const label = trigger.text || trigger.icon;
      await measure(page, role, `abrir «${label}»`);

      if (trigger.popup === 'menu') {
        const items = await page.$$eval('[role=menuitem]', (els) =>
          els.map((e) =>
            (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50),
          ),
        );
        for (const item of items) {
          if (!item || MENU_DANGER.test(item)) continue;
          await closeAll(page, url);
          await (await page.$(`[data-mobile-i="${trigger.index}"]`))
            ?.click({ timeout: 4000 })
            .catch(() => {});
          await page.waitForTimeout(400);
          const menuItem = page
            .locator('[role=menuitem]', { hasText: item })
            .first();
          if (!(await menuItem.count())) continue;
          await menuItem.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(700);
          if (page.url() !== url) {
            await page.goto(url);
            await settle(page);
            await tagTriggers(page);
            continue;
          }
          if (await page.$('[role=dialog], [role=alertdialog]'))
            await measure(page, role, `«${label}» → «${item}»`);
        }
      }
      await closeAll(page, url);
    } catch (error) {
      console.error(
        `  [${role}] ${trigger.text || trigger.icon}: ${String(error.message).slice(0, 100)}`,
      );
    }
  }
}

async function checkout(page, role) {
  await page.goto(`${BASE}/`);
  await settle(page);
  const events = [
    ...new Set(
      await page.$$eval('a[href*="/event/"]', (as) =>
        as.map((a) => new URL(a.href).pathname),
      ),
    ),
  ].slice(0, 3);
  for (const eventPath of events) {
    try {
      await page.goto(BASE + eventPath);
      await settle(page);
      const combo = await page.$('[role=combobox]');
      if (!combo) continue;
      await combo.click();
      await page.waitForTimeout(300);
      await page.click('[role=option]:has-text("1")', { timeout: 3000 });
      await Promise.all([
        page.waitForURL(/checkout/, { timeout: 15000 }),
        page.click('button:has-text("CONTINUAR")'),
      ]);
      await settle(page);
      await measure(page, role, `checkout de ${eventPath}`);
      await exploreTriggers(page, role);
    } catch {
      // Evento agotado, sin fecha o por invitación: no llega al checkout.
    }
  }
}

async function crawl(browser, user, detector) {
  const role = user ? user.username : 'anon';
  const base = user?.control ? CONTROL : BASE;
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: { width: WIDTH, height: HEIGHT },
    screen: { width: WIDTH, height: HEIGHT },
    ignoreHTTPSErrors: true,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });
  await context.addInitScript(detector);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  if (user) {
    await page.goto(`${base}/login`);
    await page.fill('input[name=username]', user.username);
    await page.fill('input[name=password]', user.password);
    await Promise.all([
      page
        .waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
        .catch(() => {}),
      page.click('button[type=submit]'),
    ]);
    await settle(page);
    if (new URL(page.url()).pathname.startsWith('/login')) {
      problems.push({
        role,
        url: '/login',
        context: 'login',
        kind: 'login',
        amount: 0,
        description: 'no pudo entrar',
        shot: '',
      });
      await context.close();
      return;
    }
  } else {
    await checkout(page, role);
  }

  const routes = user?.control
    ? ROUTES.control
    : ROUTES.tenant.filter((r) => user || !r.isProtected);
  const queue = [
    page.url(),
    `${base}/`,
    ...routes
      .filter((r) => !isDynamic(r.template) && r.template !== '/login')
      .map((r) => base + r.template),
    ...(user
      ? []
      : (env.MOBILE_PATHS ?? '')
          .split(',')
          .filter(Boolean)
          .map((p) => base + p)),
  ];
  const visited = new Set();
  const perRoute = new Map();
  const values = new Map();
  let pages = 0;
  while (queue.length && pages < MAX_PAGES) {
    let url;
    try {
      url = new URL(queue.shift());
    } catch {
      continue;
    }
    if (url.origin !== new URL(base).origin || SKIP_LINK.test(url.href))
      continue;
    url.hash = '';
    if (visited.has(url.pathname)) continue;
    visited.add(url.pathname);
    const key = routeFor(routes, url.pathname)?.template ?? url.pathname;
    if ((perRoute.get(key) ?? 0) >= MAX_PER_PATTERN) continue;
    await page.goto(url.href).catch(() => {});
    await settle(page);
    // Una ruta sin permiso redirige: no medir dos veces la misma pantalla.
    const finalPath = new URL(page.url()).pathname;
    if (finalPath !== url.pathname) {
      if (visited.has(finalPath)) continue;
      visited.add(finalPath);
    }
    const finalKey = routeFor(routes, finalPath)?.template ?? finalPath;
    if ((perRoute.get(finalKey) ?? 0) >= MAX_PER_PATTERN) continue;
    perRoute.set(finalKey, (perRoute.get(finalKey) ?? 0) + 1);
    pages += 1;
    await measure(page, role, 'página');

    // Guardar los [slug]/[id] vistos y completar con ellos las otras rutas de
    // la misma entidad (de /admin/event/x sale /admin/event/edit/x).
    const route = routeFor(routes, finalPath);
    if (route && isDynamic(route.template)) {
      for (const [name, value] of Object.entries(
        matchRoute(route.template, finalPath),
      )) {
        const k = paramKey(route.template, name);
        const list = values.get(k) ?? [];
        if (!list.includes(value) && list.length < MAX_PER_PATTERN)
          list.push(value);
        values.set(k, list);
      }
      for (const other of routes.filter((r) => isDynamic(r.template))) {
        const names = [...other.template.matchAll(/\[([^\].]+)\]/g)].map(
          (m) => m[1],
        );
        const lists = names.map((n) => values.get(paramKey(other.template, n)));
        if (lists.some((l) => !l?.length)) continue;
        for (let i = 0; i < MAX_PER_PATTERN; i += 1) {
          let filled = other.template;
          names.forEach((n, j) => {
            filled = filled.replace(
              `[${n}]`,
              encodeURIComponent(lists[j][i % lists[j].length]),
            );
          });
          queue.push(base + filled);
        }
      }
    }

    for (const href of await page.$$eval('a[href]', (as) =>
      as.map((a) => a.href),
    ))
      queue.push(href);
    await exploreTriggers(page, role);
    console.error(`  [${role}] ${finalPath}`);
  }
  await context.close();
}

const users = loadUsers();
const only = env.MOBILE_ROLES?.split(',').map((r) => r.trim());
const runs = [null, ...users].filter(
  (user) => !only || only.includes(user ? user.username : 'anon'),
);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--host-resolver-rules=MAP *.pn.test 127.0.0.1, MAP pn.test 127.0.0.1, MAP *.mock.test 127.0.0.1, MAP planeta-nocturno.s3.us-east-1.amazonaws.com 127.0.0.1',
  ],
});
const detector = detectorSource();
console.error(
  `Recorriendo ${BASE} a ${WIDTH}×${HEIGHT} como: ${runs.map((u) => (u ? u.username : 'anon')).join(', ')}`,
);
// De a tres roles a la vez: cada uno es un contexto aislado.
for (let i = 0; i < runs.length; i += 3) {
  await Promise.all(
    runs.slice(i, i + 3).map((user) => crawl(browser, user, detector)),
  );
}
await browser.close();

const unique = new Map();
for (const problem of problems) {
  const key = `${problem.kind}|${problem.url.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')}|${problem.description.replace(/«.*/, '')}`;
  if (!unique.has(key)) unique.set(key, problem);
}
writeFileSync(
  path.join(OUT, 'report.json'),
  JSON.stringify([...unique.values()], null, 2),
);

if (unique.size === 0) {
  console.log(`Sin desbordes a ${WIDTH}×${HEIGHT}.`);
} else {
  console.log(`${unique.size} desbordes a ${WIDTH}×${HEIGHT}:`);
  for (const p of unique.values()) {
    console.log(
      `- [${p.role}] ${p.url} (${p.context}): ${p.kind} ${p.amount}px — ${p.description}${p.shot ? `\n    ${p.shot}` : ''}`,
    );
  }
  process.exitCode = 1;
}
