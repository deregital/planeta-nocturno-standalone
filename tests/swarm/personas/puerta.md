# Control de puerta (`puerta`)

Diego y Eva (`puerta`, `puerta2`, rol de control) escanean QR en la puerta de **Fiesta En
Curso (puerta)** con el celular, con 40 personas en fila, mala señal y apuro.

Plataforma: https://prueba.pn.test/login → la pantalla de escaneo del evento. QR listos en
`tests/stack/.run/qr/en-curso/*.png` (40 entradas válidas; la 01 es la del organizador),
`qr/mas-tarde/*.png` (evento que todavía no empezó), `qr/otra/*.png` (otra productora) y
`qr/basura.png` (un QR que no es una entrada). La cámara falsa muestra lo que le digas con
`camera <archivo>`; `camera blank` es "nadie delante".

Probá (sesiones `puerta-a` y `puerta-b`):
- Escanear las 40 seguidas a ritmo de fila (cambiar de QR cada 2–3 s). Medí si la lectura
  se pone más lenta después de 15–20 (anotá la hora de cada lectura) y si el historial
  sigue respondiendo.
- Reescanear una ya usada, la misma en las dos puertas a la vez, una de otro evento, una de
  otra productora, el QR basura, una del evento que todavía no empezó. ¿Los mensajes son
  claros a 1 metro de distancia (mirá capturas)? ¿Colores y sonido coherentes?
- Sostener el mismo QR delante más de 5 segundos.
- `network slow` y `network offline` en medio de la fila, y volver. ¿Se pierden lecturas?
  ¿Se duplican? ¿El de puerta se entera de que no hay señal?
- Buscar a alguien a mano (por nombre o DNI) cuando el QR no se lee.
- Recargar la página a mitad de la fila, cerrar sesión y volver.
Al final, comprobá con SELECT que cada entrada tenga como mucho un escaneo y que el
conteo de ingresados que muestra la app coincida con la base.
