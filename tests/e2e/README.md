# Tests e2e (golden path)

Recorren el producto como lo usa la gente, en un navegador real, contra el
[stack simulado](../stack/README.md): la app real con Mercado Pago, mails, S3 y Neon
simulados. Están pensados para correr en cada PR (~35 s con el stack levantado).

```bash
tests/stack/up.sh            # una vez (o --rebuild después de cambiar la app)
npm run test:e2e             # golden path + chequeo final
npm run test:e2e -- --ui     # para mirarlos paso a paso
npx playwright show-report test-results/e2e-report
```

## Qué cubren y por qué

Elegidos por uso real en PostHog (60 días al 8/11/2026, sin productoras de prueba), por
área del producto y no sólo por volumen:

| Test | Qué hace | Uso en PostHog |
| --- | --- | --- |
| `evento` | La productora crea un evento con entrada paga y gratis, lo publica, sube el precio; el público lo ve y saca entrada | 38 productoras entran a su lista de eventos, 20 editan, 15 crearon alguno |
| `compra-paga` | Evento → 2 entradas → checkout con cargo por servicio → Mercado Pago aprobado → entradas y un mail por entrada | ~490 checkouts pagos (Vita, Misa, Egresas) |
| `entrada-gratis` | 2 entradas gratis con datos de cada persona; cada una recibe la suya; se descarga el PDF | ~13.800 checkouts gratis en 12 productoras |
| `organizador` (×2) | El organizador copia su invitación desde el celular, el invitado la canjea, el link no sirve dos veces · una compra por `?organizer=` queda a su nombre | 853 organizadores en 10 productoras, 94% desde el celular |
| `puerta` (×2) | Válida, repetida, de otro evento, de otra productora, basura · 30 escaneos seguidos sin que se trabe | ~2.400 escaneos en 10 productoras |
| `gestion` (×2) | Emisión manual → mail, lista del evento, Excel y base de clientes · alta de un usuario de control, se lo suma al evento, escanea y no ve el resto | base de clientes 22 productoras, panel del evento 20, usuarios 16 |

Al final, `chequeo.teardown.ts` corre `tests/stack/check.mjs` sobre toda la corrida:
grupos pagos sin entradas, sobreventa, escaneos dobles, pagos de Mercado Pago que no
quedaron en la base, compras sin mail y errores del servidor. Sólo cuenta lo nuevo: lo
que ya estaba antes de empezar queda en una línea de base.

## Qué hace fallar un test

- Lo que el test espera (pantallas, base, mails, descargas).
- Una excepción en el navegador o una respuesta 5xx, salvo las conocidas.
- En pantallas de celular, cualquier desborde horizontal (`sinDesbordes`).

**Problemas conocidos** (se anotan como `conocido` en el reporte y no frenan):

- Error de hidratación de React #418/#419 (`KNOWN` en `support/fixtures.ts`).
- Alta de usuario: se crea, pero la ventana queda cargando y no muestra las
  credenciales (en el stack, ~4 de 5 veces; en `golden/gestion.spec.ts`).

Cuando se arreglen, se sacan de ahí y pasan a ser bloqueantes.

## Datos y repetición

Cada test usa personas nuevas (`newPerson`) y no depende de los demás, así que corren en
paralelo y se pueden repetir sin volver a sembrar. Dos excepciones:

- La entrada que se escanea como válida se deja sin escanear antes del test.
- Cada corrida gasta un código de invitación (hay ~80). Cuando se acaban, el test falla
  pidiendo `tests/stack/up.sh --reseed` (43 s).

En CI conviene `tests/stack/up.sh --reseed && npm run test:e2e`.

## Escribir uno nuevo

```ts
import { entrar, expect, test } from '@tests/e2e/support/fixtures';

test('algo', async ({ abrir }) => {
  const admin = await abrir('escritorio');   // cada persona, su navegador
  const comprador = await abrir('celular');  // Android 393×727 ('instagram' también)
  await entrar(admin, 'admin');
  // ...
});
```

Ayudas en `support/`: `entrar`, `elegirEntradas`, `completarCheckout`, `esperarMails`,
`buscar` (reintenta si la página no hidrató), `camara` (lo que ve el scanner),
`sinDesbordes`, `query` (base de la plataforma), `seedEvent`, `seedUser`, `newPerson`.

Si el 443 está ocupado por otro entorno, `up.sh` usa el siguiente puerto libre y el
navegador de los tests lo sigue solo (`.run/https-port`).
