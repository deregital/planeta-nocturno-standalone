# Planeta Nocturno

## Mobile

La mayoría de las visitas son desde el celular (compradores, organizadores y la puerta). Toda
pantalla y todo modal tiene que funcionar desde **360px de ancho** y con el teclado abierto.

Reglas (cada una salió de un desborde real):

- **Anchos:** `w-full max-w-*` en vez de `min-w-*` o `w-[Npx]`. Un ancho fijo de más de 320px
  sólo con breakpoint (`sm:`, `md:`).
- **Filas de chips, botones o etiquetas:** `flex-wrap`. Un hijo de flex o grid con texto largo o
  una tabla adentro lleva `min-w-0` (y `truncate` o `break-words` según el caso).
- **Grillas:** hasta 3 columnas en el celular; más, con `sm:`/`md:grid-cols-*`. En formularios,
  un campo por fila en el celular (`FormRow` ya lo hace).
- **Tablas anchas:** dentro de `Table`, que scrollea de costado con sombra; nunca estirando la
  página.
- **Modals:** `DialogContent` ya trae 1rem de margen, `max-h` con scroll interno y una columna
  `minmax(0,1fr)` para que el contenido no lo ensanche. No le pases `w-full`, `w-screen` ni
  `max-w-none`; para el ancho usá `max-w-*` o `sm:max-w-*`.
- **Paneles y desplegables:** `SheetContent`, `PopoverContent` y `DrawerContent` ya se limitan al
  alto de la pantalla y scrollean. Una lista larga adentro va con
  `min-h-0 flex-1 overflow-y-auto`, nunca con un `min-h-[Npx]` fijo: con el teclado abierto
  queda afuera.
- **Textos en barras y botones:** nada de `whitespace-nowrap` en textos largos; que corten
  línea o usen `truncate`.
- **No esconder desbordes con `overflow-x-hidden`:** el contenido queda cortado sin aviso.

Cómo verificar:

- `npx eslint src`: la regla `mobile/no-overflowing-classes` (`eslint/rules/mobile-layout.mjs`)
  frena los patrones de arriba. Un caso legítimo va con `eslint-disable-next-line` y el motivo.
- `next dev`: `MobileOverflowWatcher` marca en rojo y avisa por consola lo que se sale de la
  pantalla. Probá con el modo celular de las devtools a 360px. Un contenedor que desborda a
  propósito lleva `data-allow-overflow`.
- `npm run test:mobile`: recorre todas las pantallas, modals y menús de fila por rol a 360×640
  contra el stack de `tests/stack` (variables en `tests/mobile/overflow.mjs`). Correrlo antes de
  un release o después de tocar layout.

## Pruebas

Detalle en [`tests/README.md`](tests/README.md). GitHub corre `rapido` y `stack` en cada PR.

- `npm test` (~30 s, sin nada levantado): lint, tipos y unitarias. Correrlo antes de dar algo
  por terminado.
- `npm run test:pr` (Docker; levanta el stack simulado solo): suma scanner, aislamiento entre
  productoras, regresiones y el golden path en un navegador. Correrlo si tocaste compra,
  invitaciones, puerta o el panel. Si cambió el código, recompila el stack solo (~4 min).
- Un flujo nuevo que se usa mucho lleva su test en `tests/e2e/golden`; un bug arreglado, una
  prueba en la suite más chica que lo cubra.
- El stack es uno por máquina (contenedor y puertos fijos): si otra sesión lo está usando, no
  lo apagues ni lo re-siembres.
