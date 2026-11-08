# Stack simulado

La app real (multi-tenant, `next build` + `next start`) corriendo en la máquina con todo lo
externo simulado, para probarla de punta a punta sin tocar nada de producción: agentes que
la usan como personas reales (`tests/swarm`), pruebas puntuales antes de un evento,
reproducir un bug de PostHog, probar el scanner desde el celular.

| Pieza | Real | Acá |
| --- | --- | --- |
| Bases de las plataformas y control | Neon | Postgres 17 en Docker (`pn-stack-pg`, 127.0.0.1:55800) |
| API de Neon (crear, renombrar, borrar bases) | console.neon.tech | `preload.mjs` crea/borra bases en el Postgres local |
| Mercado Pago | api.mercadopago.com + Pluto | `mocks.mjs`: preferencias y un checkout falso con pago aprobado, aviso demorado, triplicado, perdido, pendiente y rechazado; el aviso llega firmado a `/api/mercadopago` como lo haría Pluto |
| Mails | Resend | `RESEND_BASE_URL` → `mocks.mjs`; bandeja en https://mail.mock.test |
| Imágenes | S3 | `mocks.mjs` guarda las subidas firmadas y las sirve |
| Dominios | `*.nuestrostickets.com` | `*.pn.test` (`ROOT_DOMAIN=pn.test`), HTTPS con certificado propio en el 443 |

## Uso

```bash
tests/stack/up.sh             # build si hace falta, servicios y seed (idempotente)
tests/stack/up.sh --reseed    # vuelve a sembrar desde cero
tests/stack/up.sh --rebuild   # después de cambiar código de la app
tests/stack/down.sh           # frena procesos (--purge borra Postgres y .run/)
```

Requisitos: Docker, `npm ci`, `pdftoppm` (poppler) y los navegadores de Playwright
(`npx playwright-core install chromium-headless-shell` la primera vez).

Todo el estado queda en `tests/stack/.run/` (ignorado por git): `env.sh` con secretos
generados al azar, `seed.json` con usuarios, contraseña, eventos, códigos de invitación y
QR, `logs/` (`next.log` con errores marcados `[ERROR <hora>]`, `mocks.log` con cada pago,
mail y subida), `mails/`, `mp/`, `s3/`, `qr/`.

## Qué siembra (`seed.ts`)

- Panel de control en https://admin.pn.test con un superadmin.
- **prueba.pn.test** (con Mercado Pago simulado): admin, admin2, boleteria, puerta,
  puerta2, jefe (jefe de organizadores) con orga1 y orga2, y orga3 independiente. Eventos:
  pago con cargo por servicio, preguntas y links de organizador; últimas 3 entradas; gratis
  con datos extra; por invitación con reparto a organizadores; uno que empezó hace una hora
  con 40 entradas emitidas (QR en `qr/en-curso/`); uno que empieza en 3 horas; uno pasado;
  un borrador inactivo y uno simple.
- **otra.pn.test** (sólo transferencia): admin, puerta y un evento en curso con 3 entradas
  (QR en `qr/otra/`). Sirve para probar el cruce entre plataformas.
- `qr/basura.png`: un QR que no es una entrada.

## Navegador para agentes (`pw`)

```bash
tests/stack/pw yo open https://prueba.pn.test    # celular Android por defecto
tests/stack/pw yo click e12                      # refs del snapshot
tests/stack/pw yo camera tests/stack/.run/qr/en-curso/05.png
tests/stack/pw yo network slow
tests/stack/pw yo help
```

Cada sesión mantiene cookies y pestañas entre comandos. Todas comparten un Chromium
headless (un contexto aislado por sesión). La cámara falsa reemplaza `getUserMedia` por un
canvas que muestra la imagen pedida, así que el scanner lee QR reales del PDF.

## Chequeo (`check`)

```bash
tests/stack/check --since 2026-11-02T03:00:00Z
```

Revisa invariantes en cada plataforma (grupos pagados sin entradas, sobreventa, reservas
sobre cupo, máximo por compra, escaneos múltiples, códigos de invitación inconsistentes,
reparto de organizadores sobre cupo), cruza cada pago aprobado en el Mercado Pago simulado
con la base, busca compras sin mail y agrupa los errores del servidor.

## Desde el celular

`STACK_ALLOW_LAN=1` deja entrar conexiones de la red local al 443. El celular necesita
resolver `*.pn.test` a la IP de la máquina (o usar `ROOT_DOMAIN=<ip-con-guiones>.sslip.io`
en `.run/env.sh` y `--rebuild`) y aceptar el certificado.
