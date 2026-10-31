# Pruebas de carga (eventos de 5000 personas)

Scripts que ejercitan los routers tRPC reales (`appRouter` con `createCallerFactory`)
contra un Postgres local, sin levantar Next.js. Cada escenario crea su propia base a
partir de un template migrado con `prisma/migrations` (hay un template por versión de
las migraciones, así que cambiar de rama no reusa uno viejo). Los usuarios del seed
reciben el rol de acceso de sistema que corresponde a su `role`.

Los resultados de la corrida del 22/10/2026 están en [`RESULTADOS.md`](./RESULTADOS.md).

## Requisitos

- Postgres 16 accesible (por defecto `postgres://postgres:pg@localhost:5432/postgres`,
  se cambia con `LOAD_ADMIN_DATABASE_URL`). El usuario tiene que poder crear bases.
- `npm ci`

```bash
docker run -d --name pn-pg -e POSTGRES_PASSWORD=pg -p 5432:5432 postgres:16 \
  -c max_connections=300 -c shared_buffers=512MB
```

## Correr

```bash
npm run test:load                       # todos los escenarios
npm run test:load -- purchase scan      # algunos
```

Los JSON quedan en `tests/load/results/` (o en `LOAD_RESULTS_DIR`).
`LOAD_VERBOSE=1` deja pasar los logs de la app (por defecto se silencian porque un
INSERT fallido de 5000 filas imprime todos sus parámetros).

| Escenario        | Qué mide                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `public-page`    | `getPublicBySlug`, `getTicketTypeAmounts` y `getBySlug` (admin) de 1250 a 10.000 entradas, con 100.000 de historial; 200 visitantes a la vez. |
| `purchase`       | BOOKED vencido vs. webhook de pago y throughput de checkout según la latencia app↔base.                                                      |
| `invitation`     | Colisiones del código de 6 hex al crear eventos y canje con 5000 cupos.                                                                       |
| `redistribution` | Redistribución del jefe (1000 códigos) según la latencia y desde dos pestañas a la vez.                                                       |
| `scan`           | 5000 escaneos con 12 dispositivos según la latencia.                                                                                          |
| `backoffice`     | Tabla de tickets, base de compradores, estadísticas, PDFs de presentismo, export XLSX y PDF por entrada.                                      |

Cualquier otro archivo en `scenarios/` que exporte `default async (log) => resultado`
se puede correr por nombre.

## Latencia de red

`openLoadDb(name, { rttMs })` intercala un proxy TCP que demora cada paquete
`rttMs / 2` en cada sentido. Sirve para estimar el costo de cada round trip cuando la
función de Vercel y la base de Neon no están en la misma región. El contador de
queries (`getQueryCount`) cuenta cada `client.query` de `pg`, incluidos `BEGIN`/`COMMIT`.

## Limitaciones

- Postgres local de 16 núcleos, sin el pooler de Neon ni el arranque en frío de las
  funciones. Los tiempos absolutos con `rttMs = 0` son un piso.
- Mercado Pago, Resend y S3 no se llaman: el webhook se simula con
  `updateTicketGroupStatus`, que es lo primero que hace `/api/mercadopago`.
- Las server actions (`/event/[slug]`, `/checkout`) se reproducen encadenando los
  mismos procedures que llaman, en el mismo orden.
