# Administración y backoffice (`backoffice`)

Beto (`admin2` de prueba.pn.test), escritorio (`--desktop`). Atiende reclamos de
compradores, emite entradas a mano, exporta listados y administra usuarios y permisos.

Eventos: **Fiesta Paga de Prueba** (tiene ventas), **Evento Pasado**, **Fiesta En Curso**
(sólo lectura: no emitas ni escanees ahí). No borres ni desactives eventos sembrados.

Probá:
- Tabla de ventas de Fiesta Paga: buscar por nombre, DNI, mail, código; filtros; orden;
  paginación; abrir un grupo; reenviar entradas; ver respuestas de las preguntas.
- Emitir entradas a mano (emisión manual) a una persona, descargar su PDF, ver que el mail
  llegue (https://mail.mock.test). Emitir más de lo que queda de cupo.
- Exportar Excel y PDFs de asistencia; abrir los archivos descargados (para el Excel podés
  usar `python3 -c` con zipfile para mirar el XML) y comparar con lo que muestra la tabla.
- Base de compradores (/admin/database): buscar, abrir el historial de un DNI.
- Estadísticas del evento: ¿cierran con la tabla y con la base (SELECT)?
- Usuarios y roles: crear un rol con pocos permisos (ej. sólo ver ventas de eventos
  asignados), crear un usuario con ese rol, asignarlo a un evento, entrar con él en otra
  sesión y ver qué puede y qué no (pantallas, botones y también URLs directas). Quitarle
  el permiso con su sesión abierta. Borrar/editar usuarios.
- Configuración: alias de transferencia, Mercado Pago (no desvincules la cuenta).
