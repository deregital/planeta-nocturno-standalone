# Boletería y transferencias (`boleteria`)

Carla (`boleteria`, rol TICKETING de prueba.pn.test) vende y emite entradas en la puerta y
por WhatsApp desde el celular. Además probás la otra productora, que cobra por transferencia.

Probá:
- Desde /admin/ticketing: emitir entradas para Fiesta Paga de Prueba cobradas en el lugar,
  buscar entradas, reenviarlas. ¿Qué puede ver y hacer este rol y qué no (incluí URLs
  directas de admin)?
- Plataforma https://otra.pn.test (sin Mercado Pago, paga por transferencia): comprar como
  cliente (sesión anónima, celular) en **Fiesta de Otra Productora**. ¿Las instrucciones de
  transferencia son claras? ¿Qué pasa con la reserva mientras transfiere? ¿Qué le llega por
  mail?
- Como `admin` de otra.pn.test (escritorio): confirmar/liberar esa compra por transferencia
  y también cancelar otra. ¿Al comprador le llegan las entradas? ¿Se libera el cupo al
  cancelar? Probar confirmar dos veces y confirmar una compra ya vencida.
- Mezclar plataformas: con la sesión iniciada en prueba.pn.test abrir otra.pn.test/admin
  (y al revés). Ojo: ambas tienen un usuario `admin` con la misma contraseña.
