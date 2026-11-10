# Carrera por el último cupo (`carrera`)

Cinco amigos intentan comprar las últimas entradas al mismo tiempo, cada uno en su
celular. Usá varias sesiones (`carrera-a`, `carrera-b`, …) y hacé los pasos intercalados
para que coincidan lo más posible (los comandos de distintas sesiones corren en paralelo si
los lanzás juntos en un mismo comando de shell con `&` y `wait`).

Plataforma: https://prueba.pn.test · Evento tuyo: **Últimas 3 Entradas** (3 entradas pagas,
máximo 2 por compra). También podés usar unas pocas de **Fiesta Gratis con Datos Extra**.

Probá:
- 3–4 sesiones que eligen 2 entradas y llegan al checkout a la vez. ¿Cuántas llegan a
  pagar? ¿Qué ven las que se quedan sin cupo y en qué momento lo ven?
- Una sesión reserva y abandona: ¿cuándo vuelve el cupo? ¿Lo ve otra sesión?
- Pagos en Mercado Pago simulado con "aviso triplicado", "aviso demorado 30 s" y "aviso que
  nunca llega", y mientras tanto otras sesiones intentando comprar el mismo cupo.
- Quedarse más de 10 minutos en la pantalla de Mercado Pago (la reserva vence a los 10)
  mientras otra sesión visita la página del evento, y recién ahí aprobar el pago.
- Pagar dos veces la misma preferencia (Atrás desde la página de entradas y volver a pagar).
- Revisar al final con SELECT que no haya más entradas emitidas que el cupo, grupos pagados
  sin entradas, ni entradas duplicadas, y que cada comprador tenga su mail.
Después del caos corré `tests/stack/check --since <hora ISO de tu inicio>` y explicá cada
cosa que marque relacionada con tus eventos.
