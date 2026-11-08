# Problemas ya reportados antes

Sirve para que la consolidación marque lo que ya se conocía. Algunos pueden estar
arreglados en la rama que se prueba: si el enjambre los vuelve a encontrar, están vigentes.

- La limpieza de reservas BOOKED de más de 10 minutos (al visitar la página de un evento)
  también borra las de Mercado Pago: quien tarda en pagar puede quedar cobrado sin entradas.
  Mercado Pago no tiene vencimiento en la preferencia y no hay conciliación.
- Reserva vencida en el checkout: la acción devuelve un error genérico para siempre y
  /checkout se rompe si la cookie apunta a un grupo borrado.
- Compras por links `?organizer=` fallan cuando el organizador no está en el evento
  (consulta de respaldo de validateOrganizerCode sobre ticketTypeXOrganizers).
- `/api/event/[slug]/invite` responde 500 (ZodError) con códigos malformados en vez de
  redirigir a código inválido; la redirección no codifica `invite` (salto de línea → header
  inválido).
- organizer.setCodeShared: "Código de invitación no encontrado" cuando el jefe redistribuye
  con el panel del organizador abierto.
- El logger del servidor pierde `error.cause`.
- Errores de hidratación React #418 en /checkout, /organization y la home (fechas sin zona
  horaria); #419 en el panel de evento del organizador.
- La "hora de inicio" que ve el organizador usa la zona horaria del servidor (UTC).
- En el celular: el campo de teléfono no se puede vaciar; la tarjeta de la página de
  entradas desborda (min-w-96); el botón Continuar del evento ocupa 1/3 del ancho; el precio
  del evento no muestra el cargo por servicio hasta el checkout; el login usa placeholders
  como etiquetas.
- Un QR sostenido más de 5 s delante del scanner muestra verde y después rojo "ya escaneado".
