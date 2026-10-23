# Prueba de carga: eventos de 5000 personas

Corrida del 22/10/2026 sobre `dev` (`1b69e4e`, ya incluye #323) y, para comparar, sobre
`master` (`96070df`). Cómo reproducirla: [`README.md`](./README.md).

## Veredicto

**Con #323, la página de compra, el escáner y el canje de invitaciones ya aguantan un
evento de 5000.** Con 5000 entradas vendidas, la página de compra responde en 4 ms (en
`master`, 24 s) y 200 visitantes simultáneos no generan errores. `master` todavía no
tiene esos cambios: conviene pasarlos antes de un evento grande.

Lo que sigue pendiente para un evento de 5000, en orden:

1. **Pago aprobado sin entradas** (P0). Cualquier visita a la página borra los BOOKED de
   más de 10 minutos, aunque el comprador esté pagando en Mercado Pago.
2. **Eventos por invitación grandes que no se pueden crear** (P0). Con 5000 invitaciones,
   2 de cada 3 creaciones fallan por colisión del código de 6 hex.
3. **Redistribución** (P1). Una query por código movido: 1000 códigos tardan 26 s con
   20 ms de RTT y 71 s con 60 ms. Dos guardados simultáneos dejan cupos inconsistentes.
4. **Checkouts y canjes en fila** (P1). El lock de `shortId` por evento los serializa;
   el techo depende de la latencia app↔base (129/s local, 10/s con 20 ms, 4/s con 60 ms).
5. **PDFs y mails** (P2). El presentismo tarda ~38 s, cada PDF de entrada cuesta 0,64 s
   de CPU, y los mails salen dentro del request (en `events.update`, con el lock tomado).
6. **Página de admin del evento** (P2). Sigue cargando todas las entradas: 6,7 MB por
   carga con 5000.

## Antes y después de #323

Mismo seed: evento de 5000 entradas en un tenant con 100.000 de historial.

| Qué                                                  | `master`                         | `dev`                     |
| ---------------------------------------------------- | -------------------------------- | ------------------------- |
| Página de compra (`getBySlug` → `getPublicBySlug`)   | 23,9 s                           | **4 ms**                  |
| Stock (`getTicketsByEvent` → `getTicketTypeAmounts`) | 2,4 s                            | **8 ms**                  |
| Página de admin/organización (`getBySlug`)           | 23,9 s                           | 166 ms                    |
| Visitantes simultáneos, pool de 10 conexiones        | 50: 20 fallaron, el resto ~123 s | 200: 0 fallas, p95 0,75 s |
| Canje de una invitación (5000 cupos, sin historial)  | 0,96 s                           | 60 ms                     |
| Estadísticas del evento                              | 26,8 s                           | 43 ms                     |
| Entradas por hora                                    | 16,7 s                           | 59 ms                     |
| Base de compradores (~60.000)                        | 9,7 s                            | 0,94 s                    |
| PDF de presentismo                                   | ~58 s                            | ~38 s                     |

Con 10.000 entradas, en `master` la página de compra tardaba 50 s; en `dev`, 3 ms.

## Cómo se probó

- Postgres 16 local (16 núcleos), una base nueva por escenario a partir de las
  migraciones de `prisma/migrations`.
- Se llaman los routers tRPC reales (`appRouter` con `createCallerFactory`) con el mismo
  contexto que arma `createTRPCContext`, incluidos los permisos del rol de acceso. Las
  server actions de `/event/[slug]` y `/checkout` y el route handler
  `/api/event/[slug]/invite` se reproducen encadenando los mismos procedures en el mismo
  orden.
- Un proxy TCP agrega latencia de red app↔base (RTT 0, 4, 20 y 60 ms) para estimar qué
  pasa si la función de Vercel y Neon no están en la misma región.
- Página del evento y backoffice corren con historial: 20 eventos anteriores, 100.000
  entradas, ~60.000 compradores.
- No se llamó a Mercado Pago, Resend ni S3. El webhook se simuló con
  `updateTicketGroupStatus`, que es lo primero que hace `/api/mercadopago`.

Los tiempos con RTT 0 son un piso: en producción se suma la red, el pooler de Neon y el
arranque en frío.

## Resultados en `dev`

### 1. Páginas del evento

| Entradas vendidas | `getPublicBySlug` | `getTicketTypeAmounts` | `getBySlug` (admin) | Resultado de `getBySlug` |
| ----------------- | ----------------- | ---------------------- | ------------------- | ------------------------ |
| 1.250             | 3,9 ms            | 5,5 ms                 | 51 ms               | 1,7 MB                   |
| 2.500             | 4,2 ms            | 5,0 ms                 | 86 ms               | 3,4 MB                   |
| 5.000             | 4,2 ms            | 8,0 ms                 | 166 ms              | 6,7 MB                   |
| 10.000            | 3,0 ms            | 5,6 ms                 | 318 ms              | 13,4 MB                  |

- 200 visitantes abriendo la página de compra a la vez (`getPublicBySlug` +
  `getTicketTypeAmounts`, pool de 10): p50 0,57 s, p95 0,75 s, sin fallas.
- 10 personas del staff recargando la página de admin a la vez: p95 0,89 s.

`getBySlug` todavía trae `ticketGroups → emittedTickets` completos para
`/admin/event/[slug]` y `/organization/event/[slug]`. La base ya no es el problema, pero
son 6,7 MB por carga que un organizador baja en el celular. La tabla de tickets ya usa
`getByEventId`.

### 2. Pago aprobado sin entradas

Un comprador entra a Mercado Pago y tarda 11 minutos. Cualquier visita a la página del
evento ejecuta `deleteExpiredBookedTicketGroups` (`src/server/routers/events.ts:113`),
que borra su grupo (sigue BOOKED; la excepción es solo para `TRANSFER`) y en cascada sus
entradas. Cuando llega el webhook, `updateTicketGroupStatus` tira
`ticketGroup no encontrado` y `/api/mercadopago` responde 500. El comprador pagó, no tiene
entradas y su cupo ya se liberó. Con volumen siempre hay alguien mirando la página, así
que el borrado ocurre puntual a los 10 minutos. Pasa igual en `master` y en `dev`.

### 3. Checkout e invitaciones en fila

`allocateEmittedTicketShortIds` (`src/server/utils/emittedTicketShortId.ts:24`) toma
`pg_advisory_xact_lock` por evento hasta el `COMMIT`, así que las emisiones de un mismo
evento van de a una. Un checkout son 11 round trips y el lock se sostiene ~4,6 de ellos.
Con 200 checkouts de 2 entradas y 100 en paralelo:

| RTT app↔base | Checkouts/s | `createMany` p50 | p99    |
| ------------- | ----------- | ---------------- | ------ |
| 0 ms          | 129         | 0,56 s           | 0,61 s |
| 4 ms          | 36          | 2,5 s            | 2,6 s  |
| 20 ms         | 10,5        | 9,1 s            | 9,3 s  |
| 60 ms         | 3,9         | 25 s             | 25,1 s |

Los canjes de invitación pasan por el mismo lock. Con 100 invitados (50 a la vez) en un
evento de 5000 cupos: p50 0,64 s con RTT 0 y 6,8 s con RTT 20 ms (21 round trips por
canje).

Con Vercel y Neon en la misma región (RTT 1-3 ms) alcanza para 5000 entradas. Si las
funciones corren en `iad1` (default de Vercel) y la base en São Paulo, el RTT ronda
100-120 ms: ~2 emisiones/s y esperas de casi un minuto en un lanzamiento. Conviene medir
el RTT real.

El slug visible de la entrada (`existingCount` en `emitted-tickets.ts`) se calcula fuera
de la transacción y con concurrencia se repite (52 slugs repetidos en 400 entradas). Solo
importa si el evento muestra el slug en el PDF.

### 4. Colisiones de códigos de invitación

`ticketXOrganizer.code` es `upper(substr(md5(random()::text), 1, 6))` con índice único
global: 16,7 M valores posibles. Al crear 5000 códigos en un solo `INSERT`, la
probabilidad de que dos coincidan es 1 − e^(−5000²/2·16,7M) ≈ 52%, y el `INSERT` (con toda
la creación del evento) falla. Crece con los códigos que ya existen en el tenant. Medido
con `events.create` real, sumando tres corridas (dos en `master`, una en `dev`; el código
es el mismo):

| Códigos existentes | Invitaciones del evento | Fallas medidas | Teórico |
| ------------------ | ----------------------- | -------------- | ------- |
| 0                  | 1.000                   | 1 de 36        | 2,9%    |
| 0                  | 2.500                   | 9 de 36        | 17%     |
| 0                  | 5.000                   | 24 de 36       | 52,5%   |
| 40.000             | 500                     | 20 de 24       | 70%     |

Lo mismo aplica cuando `events.update` o la redistribución del jefe agregan un
organizador con cupo.

### 5. Redistribución del jefe de organizadores

Evento de 5000 cupos, jefe con 20 organizadores de 250 cada uno, 40% ya canjeado.
`applyChiefOrganizerInvitationDistribution` mueve los códigos con un `UPDATE` por código
(`src/server/utils/chief-organizer-invitation-distribution.ts:107` y `:232`), todo dentro
de una transacción:

| RTT     | Quitar 100 a 10 organizadores (1000 al jefe) | Repartir 1000 desde el jefe | Quitar 10 a uno |
| ------- | -------------------------------------------- | --------------------------- | --------------- |
| 0 ms    | 1,1 s                                        | 1,0 s                       | 0,07 s          |
| 4 ms    | 6,4 s                                        | 6,4 s                       | 0,42 s          |
| 20 ms   | 25,4 s                                       | 25,7 s                      | 1,6 s           |
| 60 ms   | 71,0 s                                       | 71,6 s                      | 4,5 s           |
| Queries | 1.124                                        | 1.134                       | 71              |

Corriendo sola deja los datos consistentes. Mientras corre, la transacción tiene
bloqueados los códigos que mueve y los grupos que toca.

**Dos guardados a la vez** (dos pestañas: una quita 100 a los organizadores 1-10, otra
quita 50 a los 11-20): los dos terminan bien. El jefe queda con cupo 1000 y 1500
códigos, y 11 organizadores con cupo distinto de sus códigos. La validación
(`getChiefTeamAssignedTotal`, `validateChiefTicketPool`) corre antes de la transacción,
con datos que la otra pestaña ya cambió.

### 6. Escaneo

5000 escaneos con 12 dispositivos sin pausa (3% QRs repetidos, 1% inválidos):

| RTT   | Escaneos/s | p50    | p95    |
| ----- | ---------- | ------ | ------ |
| 0 ms  | 486        | 24 ms  | 37 ms  |
| 20 ms | 102        | 120 ms | 134 ms |
| 60 ms | 39         | 316 ms | 331 ms |

Sobra capacidad: 5 queries por escaneo. Con #323 la pantalla de escaneo ya no carga las
entradas del evento.

### 7. Backoffice

| Pantalla / acción                                | `dev`                                 | Resultado |
| ------------------------------------------------ | ------------------------------------- | --------- |
| Tabla de tickets (`emittedTickets.getByEventId`) | 0,25 s                                | 7,1 MB    |
| Base de compradores (`getAllUniqueBuyer`)        | 0,94 s                                | 10,9 MB   |
| Estadísticas del evento / último mes             | 43 ms / 80 ms                         | —         |
| Entradas por hora                                | 59 ms                                 | —         |
| PDF presentismo por nombre                       | 37,6 s                                | 8,9 MB    |
| PDF presentismo por tipo                         | 39,2 s                                | 8,9 MB    |
| Export XLSX                                      | 0,47 s                                | 7,2 MB    |
| PDF de una entrada (`generatePdf`)               | 0,64 s de CPU c/u → ~53 min para 5000 |           |

Los PDFs de presentismo tardan por la generación del PDF, no por la consulta.
`getBuyersCodeByDni` sigue recalculando una ventana sobre toda la tabla en cada llamada.

### 8. Revisión de código (no medido)

- `events.update` y `events.create` generan PDFs y mandan mails a organizadores dentro de
  la transacción. En `update` ya se tomó el lock de `shortId` del evento, así que mientras
  salen los mails todos los checkouts de ese evento esperan.
- `deliverPaidTicketGroup` (webhook) genera los PDFs y manda un mail por entrada dentro
  del request. Si el webhook se reintenta, reenvía todo.
- Resend permite 10 requests/s por equipo
  ([docs](https://resend.com/docs/api-reference/rate-limit)) y todos los tenants
  comparten `RESEND_API_KEY`. `retryWithBackoff` hace 3 intentos con 2 s.
- En multi-tenant cada instancia abre como máximo 3 conexiones por tenant
  (`get-instance-db.ts`).

## Recomendaciones

### Antes de un evento de 5000 (P0)

1. **Pasar #323 a `master`.**
2. **BOOKED con pago en curso.** No borrar grupos que ya fueron a Mercado Pago (o darles
   un vencimiento mucho mayor), mover la limpieza a un cron y, si el webhook no encuentra
   el grupo, alertar en vez de responder 500 en silencio.
3. **Códigos de invitación.** Generarlos en la app (por ejemplo 8 caracteres de un
   alfabeto de 32 ≈ 10¹² valores), insertar con `ON CONFLICT DO NOTHING` y completar los
   que falten. Ajustar el regex de 6 hex de `validateInvitationCode` para aceptar los dos
   formatos.

### Después (P1/P2)

4. **Redistribución en lote.** Un `UPDATE ... WHERE code = ANY($codes)` (o
   `WHERE code IN (SELECT ... ORDER BY "createdAt" LIMIT $n FOR UPDATE SKIP LOCKED)`) y
   recalcular `amountTickets` en una query: 1000 códigos pasan de ~1100 queries a ~10.
   Validar dentro de la transacción con un `pg_advisory_xact_lock` por evento.
5. **Checkout.** Acortar el lock (asignar `shortId` y slug en un solo `INSERT ... SELECT`
   o con un contador por evento) y verificar que las funciones de Vercel corran en la
   región de Neon.
6. **Página de admin/organización.** Pedir solo lo que muestra en vez de todas las
   entradas.
7. **Mails y PDFs fuera del request** (cola), webhook idempotente, batch de Resend y nada
   de mails dentro de transacciones. Presentismo en segundo plano.
