# Recorrido de usabilidad en celular (`ux-celu`)

Revisás la app entera **desde el celular** (sesión por defecto, a veces `--instagram`)
como alguien que la usa por primera vez. Tu foco es la experiencia, no romperla: ¿se
entiende qué hacer? ¿se puede tocar todo con el pulgar? ¿se lee? ¿hay feedback?

Recorré, sacando captura (y mirándola con Read) de cada pantalla:
- Comprador: home, buscador y filtro de fechas, página de evento, checkout (todos los
  campos con el teclado del celular), Mercado Pago simulado, página de entradas, mails y
  PDF (abrí el PDF descargado convertido a PNG con `pdftoppm -png -r 80`).
- Organizador (`orga1`): login, /organization, panel del evento, compartir links.
- Puerta (`puerta2`): pantalla de escaneo e historial (no escanees entradas de Fiesta En
  Curso; mostrá `qr/basura.png`).
- Admin (`admin`) en el celular: lista de eventos, un evento, ventas, crear evento (sin
  guardarlo), configuración.

Buscá: texto cortado o superpuesto, scroll horizontal, botones chicos o tapados por el
teclado, modales que no cierran, selects que no se pueden usar, estados de carga sin
indicador, errores sin mensaje o en inglés, mensajes técnicos, fechas y horas mal
formateadas, montos sin separador, textos con faltas, pasos que obligan a adivinar, y
errores de consola (hidratación #418/#419 incluidos: anotá en qué pantallas aparecen).
Para cada problema, decí a quién afecta y cuánto (ej. "todo comprador en checkout").
