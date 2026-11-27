# Pruebas

Todo se corre con un comando por nivel. GitHub corre `rapido` y `stack` en cada PR y en
cada push a `dev` o `master` ([`.github/workflows/tests.yml`](../.github/workflows/tests.yml)).

| Comando                | Qué corre                              | Necesita                       | Tiempo                          |
| ---------------------- | -------------------------------------- | ------------------------------ | ------------------------------- |
| `npm test`             | lint, tipos y unitarias                | nada                           | ~30 s                           |
| `npm run test:pr`      | lo anterior + todo lo que usa el stack | Docker (levanta el stack solo) | ~2 min (+5 si hay que compilar) |
| `npm run test:release` | lo anterior + desbordes en celular     | Docker                         | ~7 min más                      |

Los tres siguen aunque falle un paso y al final dicen cuáles fallaron. El stack se
recompila solo si cambió el código desde la última vez (o si un `next dev` en la misma
carpeta pisó `.next`). Si el golden path pide más códigos de invitación:
`STACK_RESEED=1 npm run test:pr`.

## Qué hay

**Rápidas** (sin nada levantado):

| Suite                           | Comando                    | Qué cuida                                                                  |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| [eslint/](eslint)               | `test:eslint-rule`         | Las reglas propias: aislamiento de bases por productora y desbordes mobile |
| `instance-resolution.test.mjs`  | `test:instance-resolution` | Qué plataforma atiende cada dominio                                        |
| `environment.test.mjs`          | `test:environment`         | Variables de entorno de single y multi-tenant                              |
| `guide-videos.test.mjs`         | `test:guide-videos`        | Qué video de ayuda corresponde a cada pantalla                             |
| `user-import-roundtrip.test.ts` | `test:user-import`         | Exportar e importar usuarios sin perder datos                              |

**Con el stack simulado** ([stack/](stack/README.md): la app real compilada, con Postgres
en Docker y Mercado Pago, mails, S3 y Neon simulados; nada sale a servicios reales):

| Suite                           | Comando              | Qué cuida                                                                                     |
| ------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| [scanner/](scanner)             | `test:scanner`       | Escaneo online y en modo rápido, sincronización y fuera de horario                            |
| [night-metrics/](night-metrics) | `test:night-metrics` | Qué cuenta como entrada, ingreso y recaudado en las métricas de la noche                      |
| [isolation/](isolation)         | `test:isolation`     | Que una productora no pueda leer datos de otra                                                |
| [stack/regressions.ts](stack)   | `test:regressions`   | Los 17 arreglos de lo que encontró el enjambre en noviembre                                   |
| [e2e/](e2e/README.md)           | `test:e2e`           | El golden path en un navegador: evento, compra paga y gratis, organizadores, puerta y gestión |
| [mobile/overflow.mjs](mobile)   | `test:mobile`        | Todas las pantallas y modals por rol a 360 px, sin desbordes                                  |

`test:scanner`, `test:night-metrics` y `test:isolation` necesitan variables del stack; `tests/run.sh` se las
pasa. Para correrlas sueltas, ver el encabezado de cada archivo.

**A mano, cuando haga falta** (no corren en los PRs):

| Suite                   | Para qué                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| [load/](load/README.md) | Carga: eventos de 5.000 personas, invitaciones masivas, escaneos simultáneos |
| [swarm/](swarm)         | El enjambre: personas simuladas que usan la app libremente (gasta tokens)    |

## Cuándo correr qué

- **Antes de abrir un PR:** `npm test`. Si tocaste compra, invitaciones, puerta o el panel,
  `npm run test:pr`.
- **Antes de un release:** `npm run test:release`.
- **Flujo nuevo que la gente usa mucho:** sumarle un test al golden path
  ([e2e/README.md](e2e/README.md#escribir-uno-nuevo)).
- **Bug arreglado:** sumarle una prueba en la suite más chica que lo cubra (unitaria, scanner,
  regresiones o e2e).

## Si falla en GitHub

El job `stack` sube como artefacto el reporte de Playwright (`test-results/e2e-report`, con
el trace de cada test que falló) y los logs del stack. Para mirarlo:
`npx playwright show-report <carpeta del artefacto>/e2e-report`.

## Un stack por máquina

El stack usa nombres y puertos fijos: el contenedor `pn-stack-pg`, los puertos 55800, 55801
y 3100, y el 443 o el siguiente libre. Dos carpetas que lo levantan a la vez se pisan: la
segunda reinicia los servicios de la primera, y apagar uno apaga el otro.
