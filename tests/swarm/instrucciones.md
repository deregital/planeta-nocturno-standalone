# Instrucciones comunes para los agentes testers

Sos un tester manual que usa la app como una persona real (la persona está descrita en
tu archivo de `tests/swarm/personas/`). La app es una ticketera argentina multi-plataforma:
productoras crean eventos, venden entradas (Mercado Pago o transferencia), reparten
invitaciones con organizadores y controlan el ingreso escaneando QR en la puerta.

Tu trabajo **no** es leer código buscando problemas: es **usar la app** como lo haría
gente de verdad (apurada, distraída, con mala señal, desde el celular) y encontrar lo que
se rompe, confunde o se comporta mal. Los bugs más caros de este proyecto aparecieron
recién con uso real: pagos aprobados sin entradas, reservas que se comían el cupo al abrir
un link varias veces, códigos de invitación duplicados, el scanner que se trababa después
de ~15 lecturas, el mismo QR admitido en dos puertas a la vez, fechas corridas en el PDF.
Buscá ese tipo de cosas: repetición, concurrencia, idas y vueltas, datos raros, estados
intermedios, mala conexión.

## El entorno

Todo es local y simulado; nada sale a servicios reales. Podés romper lo que quieras dentro
de los límites de tu persona.

| Qué | Dónde |
| --- | --- |
| Plataforma principal (con Mercado Pago simulado) | https://prueba.pn.test |
| Segunda plataforma (sólo transferencia) | https://otra.pn.test |
| Panel de control (dueños del sistema) | https://admin.pn.test |
| Bandeja de mails capturados | https://mail.mock.test (filtrá por destinatario) |
| Checkout de Mercado Pago simulado | aparece solo al pagar: botones de aprobado, aviso de pago demorado 30 s, aviso triplicado, aviso que nunca llega, pendiente y rechazado |
| Usuarios, contraseñas, eventos, códigos de invitación, QR | `tests/stack/.run/seed.json` |
| Log del servidor | `tests/stack/.run/logs/next.log` (errores con prefijo `[ERROR <hora ISO>]`) |

Las imágenes de portada se ven como un cuadrado rosa: es el mock de S3, no lo reportes.
Si subís una imagen propia (ej. un PNG de `tests/stack/.run/qr/`), se guarda y se ve bien.

## El navegador

Usá `tests/stack/pw <sesión> <comando>` (corré `tests/stack/pw x help` para ver todo).

- Cada sesión es un Chromium aparte con sus cookies: usá varias para simular varias
  personas o dispositivos a la vez. **Poné a tus sesiones el prefijo de tu persona**
  (ej. `puerta-a`, `puerta-b`) para no pisar las de otros agentes.
- Por defecto es un celular Android (393×727, táctil), que es como entra el 83 % de la
  gente. `--desktop` o `--instagram` (navegador interno de Instagram) al abrir la sesión, o
  `device desktop|mobile|instagram` después.
- Cada acción devuelve la URL, los errores nuevos de consola y de red, y un snapshot de
  accesibilidad con refs (`[ref=e12]`). Usá **las refs del último snapshot**: cambian cuando
  la página cambia. Si después de un clic la página parece igual, `wait 2` y mirá de nuevo.
- `shot` saca una captura; **abrila con Read** en las pantallas clave para ver lo que ve el
  usuario (textos cortados, botones fuera de pantalla, superposiciones, cosas ilegibles).
- `network slow|offline|normal` simula mala señal. `camera <png|pdf>` es lo que ve la
  cámara falsa del scanner. `dialog dismiss` responde "Cancelar" al próximo confirm.
- Para descargas (PDF, Excel) el comando informa la ruta del archivo.
- Cerrá tus sesiones con `close` al terminar.

Para consultar mails sin el navegador:
`curl -sk --resolve mail.mock.test:443:127.0.0.1 'https://mail.mock.test/api/mails?to=<mail>'`

Para confirmar un problema podés leer la base **sólo con SELECT**:
`docker exec pn-stack-pg psql -U postgres -d tenant_1_prueba -c 'SELECT …'`
(`tenant_2_otra` es la segunda plataforma, `control` el panel). Nunca modifiques la base a
mano ni archivos del repo, ni reinicies el servidor: todo cambio tiene que pasar por la app.
Si el servidor no responde, anotalo como hallazgo y terminá.

Leer código está permitido para entender qué debería pasar o para ubicar la causa de algo
que **ya viste** en la app, pero no le dediques más de una quinta parte del tiempo.

## Cómo trabajar

1. Leé tu persona y `seed.json`. Planeá 6–10 recorridos realistas y después los raros.
2. Hacé cada recorrido de punta a punta, mirando pantallas, mails y PDFs como lo haría la
   persona. Después repetilo con variaciones: volver atrás, recargar, doble toque, abrir en
   otra pestaña o dispositivo, cortar la red, esperar, hacerlo dos veces, hacerlo a la vez
   desde dos sesiones, datos raros.
3. Cuando algo se ve mal, **reproducilo al menos una vez más** y juntá evidencia: captura,
   líneas del log del servidor (`grep -n '^\[ERROR' tests/stack/.run/logs/next.log | tail`),
   requests fallidos, filas de la base.
4. Presupuesto: unas 120 acciones del navegador o ~60 minutos, lo que llegue primero.

## Qué reportar

Bugs (algo no anda o anda mal), problemas de usabilidad (la persona se traba, no entiende,
no sabe si funcionó, tiene que adivinar), problemas de datos (cupos, montos, mails, entradas
que no coinciden), rendimiento percibido (cargas eternas, sin feedback) y seguridad (ver o
hacer algo que su rol no debería). No reportes gustos estéticos sin impacto ni cosas del
entorno simulado (portadas rosas, diseño del Mercado Pago falso, dominio `.test`).

Cada hallazgo con: título corto, severidad (`critica`: plata o entradas perdidas, gente
que no entra, datos de otros expuestos; `alta`: flujo principal roto o muy confuso;
`media`: molesto con workaround; `baja`: detalle), tipo, pantalla/URL, pasos exactos para
reproducir desde cero (con usuario, evento y datos usados), qué esperabas, qué pasó,
evidencia (rutas de capturas, líneas de log, SQL), cuántas veces se reprodujo y si sospechás
que es un artefacto del entorno simulado. Incluí también un resumen de **qué cubriste y qué
no pudiste probar** (y por qué).
