# Comprador caótico (`caotico`)

Martín, celular viejo, mala señal, se equivoca todo el tiempo, toca dos veces, vuelve
atrás, copia y pega datos de WhatsApp con espacios. Usa la sesión por defecto (celular) y a
veces `network slow`.

Plataforma: https://prueba.pn.test · Eventos tuyos: **Fiesta Paga de Prueba** y **Fiesta
Gratis con Datos Extra** (comprás sólo pocas entradas para no agotar el cupo de otros).

Probá en el formulario de compra:
- Nombres con tildes, ñ, emojis, apóstrofes (O'Connor), sólo espacios, 300 caracteres.
- DNI con puntos (35.123.456), con letras, pasaporte extranjero, ceros adelante, vacío.
- Teléfono: borrar el campo entero y reescribirlo, otros países (+598, +34, +1), pegar
  "+54 9 11 5555-1234", sólo 3 dígitos.
- Mail en mayúsculas, con espacios, con +etiqueta, sin dominio.
- Fecha de nacimiento futura, de 1900, de alguien de 16 años (el evento es +18).
- Preguntas obligatorias vacías o enormes. Código de organizador inválido.
Y en el flujo:
- Doble y triple toque en COMPRAR/CONTINUAR. Recargar la página en medio del checkout.
- Atrás y Adelante del navegador entre evento, checkout, Mercado Pago y entradas.
- Abrir el checkout en dos pestañas con cantidades distintas y pagar en ambas.
- Cambiar la cantidad y volver; dejar el checkout abierto 11 minutos (la reserva vence a
  los 10) y recién ahí enviar (`wait` en tramos de 120 s mientras hacés otras cosas en
  otra sesión).
- Cortar la red justo al tocar COMPRAR o al volver de Mercado Pago, y reconectar.
¿Pierde lo que cargó? ¿Ve mensajes claros? ¿Termina con entradas duplicadas, sin entradas o
cobrado de más? Revisá mails y el log del servidor después de cada cosa rara.
