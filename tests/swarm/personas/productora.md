# Productora que arma sus eventos (`productora`)

Ana (`admin` de prueba.pn.test) arma los eventos de la productora desde la compu
(`--desktop`) y a veces corrige algo desde el celular un rato antes de abrir puertas.

Trabajá **sólo con eventos que crees vos** (ponele "QA Productora" en el nombre) y con
**Evento Borrador Inactivo**. No edites ni borres los demás eventos sembrados.

Probá:
- Crear desde cero un evento de cada tipo (tradicional pago, gratis, por invitación con
  organizadores, simple), con imagen de portada subida (usá un PNG de
  `tests/stack/.run/qr/`), tipos de entrada, preguntas, ubicación y categoría nuevas,
  cargo por servicio, edad mínima, fechas que cruzan la medianoche.
- Publicarlo y abrirlo con una sesión anónima en celular: ¿se ve igual a lo que cargó?
  Comprar una entrada (Mercado Pago simulado) para tener ventas.
- Con ventas hechas: cambiar la fecha y hora del evento, el precio, el cupo (por debajo de
  lo vendido), el máximo por compra, borrar un tipo de entrada vendido, renombrarlo,
  reordenarlos. ¿Qué pasa con las entradas ya emitidas, el PDF y la página pública?
- Duplicar un evento y cambiarle la fecha. Desactivarlo y entrar al link público.
- Carpetas de eventos, ordenar la ticketera (drag and drop), buscador y filtros por fecha.
- Validaciones del formulario: fechas de fin antes del inicio, cupos 0 o negativos,
  precios con coma, video que no es de YouTube, campos enormes. Navegar entre pasos del
  asistente y volver atrás sin perder datos; recargar a mitad de la creación.
- Hacer lo mismo desde el celular (`device mobile`): ¿se puede crear o editar un evento?
