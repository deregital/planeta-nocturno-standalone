# Catálogo funcional de casos de uso — Planeta Nocturno (Standalone)

> **Estado:** relevamiento completo del producto tal como está implementado hoy en el repositorio
> `deregital/planeta-nocturno-standalone` (rama `master`).
>
> **Propósito:** insumo único para la definición del corte **Light / Pro**. Este documento **no
> propone la separación**: describe todo lo que el sistema hace hoy, en formato de caso de uso /
> historia de usuario, con el detalle suficiente para que el equipo funcional pueda ir marcando,
> caso por caso, qué entra en Light, qué entra en Pro y qué entra en ambos.
>
> **Fecha de relevamiento:** julio 2026.

---

## 1. Cómo usar este documento

1. Cada caso de uso tiene un **ID estable** (`CU-<MÓDULO>-<NN>`). Usar ese ID para referenciarlo en
   cualquier planilla, ticket de Jira/Linear o discusión posterior.
2. Cada caso de uso termina con una línea de **Clasificación** con cuatro casilleros vacíos:

   `Clasificación: Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐`

   Los casilleros están **deliberadamente vacíos**. La asignación es decisión del funcional.
3. Al inicio de cada módulo hay una **tabla resumen** con una fila por caso de uso y columnas
   vacías, pensada para completar rápido (o para volcar a planilla).
4. Los **anexos** (al final del documento, A a I) no son casos de uso: son matrices de apoyo para
   tomar la decisión — matriz de roles, parámetros configurables, integraciones externas,
   dependencias entre casos, ejes de corte candidatos, huecos funcionales detectados, trazabilidad
   al código y una planilla plana con los 184 casos para clasificar de corrido (Anexo G).
5. Cada caso incluye una **referencia técnica** (archivo + procedimiento) para que, cuando se decida
   "esto no va en Light", se sepa exactamente qué hay que apagar, esconder o no construir.

### Convenciones

| Elemento | Significado |
| --- | --- |
| **Actor** | Rol que ejecuta el caso. Ver §4. |
| **Historia** | Redacción en formato historia de usuario (como… quiero… para…). |
| **Precondición** | Estado requerido para que el caso sea posible. |
| **Flujo** | Pasos principales del camino feliz. |
| **Reglas** | Reglas de negocio y validaciones que aplican. |
| **Excepciones** | Caminos alternativos y errores contemplados por el sistema. |
| **Referencia** | Punto de entrada en el código. |
| ⚙️ | El caso es **configuración por evento** (un flag/parámetro), no una pantalla nueva. |
| 🔌 | El caso depende de una **integración externa** (MercadoPago, Resend, S3, Pluto). |
| 🧩 | El caso existe hoy **sólo por la existencia de otro** (dependencia dura, ver Anexo D). |

---

## 2. Contexto del producto

Planeta Nocturno Standalone es una plataforma de **ticketing y control de acceso para eventos
nocturnos**, desplegada como **una instancia por cliente** (multi-instancia, no multi-tenant: cada
cliente tiene su propia base de datos, su propio dominio y su propio branding por variables de
entorno). Cubre la cadena completa:

```
Configuración de instancia
        └── Alta de evento (wizard de 4 pasos)
                 ├── Tipos de ticket (precio, cupo, horarios, visibilidad)
                 ├── Organizadores / RRPP (comisión o cupo de invitaciones)
                 └── Formulario de preguntas al comprador
        └── Publicación → landing pública
                 └── Compra (carrito → checkout → MercadoPago o gratuito)
                          └── Emisión de ticket (PDF con QR cifrado) + envío por mail
                                   └── Acreditación en puerta (escaneo QR / manual)
                                            └── Reportes, estadísticas y base de datos de compradores
```

**Tres modos de comercialización** conviven y cambian sustancialmente el comportamiento del
producto (ver módulo MOD):

- **TRADITIONAL** — venta abierta al público, con RRPP que reparten link/código propio y cobran
  comisión vía descuento.
- **INVITATION** — evento cerrado: no hay venta pública; se reparten códigos de invitación
  individuales entre organizadores, con cupo asignado por organizador.
- **SIMPLE** — variante liviana: venta/registro abierto donde el "invita" es texto libre escrito por
  el propio asistente, sin necesidad de dar de alta al RRPP como usuario.

---

## 3. Modelo de dominio (glosario)

| Entidad | Descripción | Notas relevantes para el corte |
| --- | --- | --- |
| **Instancia** | El deploy completo para un cliente. Nombre, descripción, color (hue/saturation), logo y dominio vienen de variables de entorno. | No hay UI para cambiarlo; se configura en el deploy. |
| **User** | Usuario del backoffice. Tiene rol, DNI, datos personales, código propio de 6 dígitos, alias de MercadoPago y URL de Google Drive. | El mismo modelo sirve para admin, boletería y RRPP. |
| **Tag** | Grupo/etiqueta de usuarios, propiedad del jefe de organizadores que lo creó. | Usado para agrupar RRPP e importaciones masivas. |
| **Location** | Salón/venue: nombre, dirección, link de Google Maps, capacidad. | Catálogo reutilizable entre eventos. |
| **EventCategory** | Categoría de evento (ej. "Fiesta", "Show"), con orden y visibilidad en la landing. | Alimenta el navbar público. |
| **EventFolder** | Carpeta con color para agrupar eventos en el backoffice. | Organización interna, no visible al público. |
| **Event** | El evento. Fecha inicio/fin, portada, video, descripción, edad mínima, ubicación, categoría, modo de invitación, y ~7 flags de configuración. | Núcleo del sistema. |
| **EventQuestion** | Pregunta libre del formulario de compra, con orden y borrado lógico. | Encuesta por evento. |
| **TicketType** | Tipo de entrada: nombre, descripción, precio, categoría (FREE/PAID/TABLE), cupo, máximo por compra, fecha de inicio de validez, límite de venta, límite de escaneo, escaneo múltiple, visibilidad web, umbral de "últimos lugares", orden, slug propio y organizadores asignados. | La entidad con más parámetros del sistema. |
| **TicketGroup** | Carrito / orden de compra. Estados: `BOOKED` (reservado), `PAID`, `FREE`. Guarda monto total, cantidad, quién invitó (organizador o texto libre) y si es el grupo de tickets de organizadores. | Los `BOOKED` con más de 10 minutos se borran automáticamente. |
| **TicketTypePerGroup** | Cantidad de cada tipo dentro de un carrito. | — |
| **TicketGroupAnswer** | Respuesta a una pregunta del formulario. | — |
| **EmittedTicket** | Ticket emitido a nombre de una persona: datos personales, slug, si fue pagado en puerta, estado de escaneo. | Es la unidad de acreditación. |
| **EmittedTicketScan** | Registro individual de cada escaneo (fecha + quién escaneó). | Habilita el historial y el escaneo múltiple. |
| **TicketXOrganizer** | Código de invitación individual (6 dígitos hex) asignado a un organizador para un evento. Se "consume" cuando se asocia a un ticket emitido. | Sólo en modo INVITATION. |
| **EventXOrganizer** | Vínculo organizador–evento. Guarda `discountPercentage` (modo tradicional) o `ticketAmount` (modo invitación). | — |
| **Feature** | Feature flag por clave, con `enabled` y `value` opcional. | Infraestructura lista, **sin flags definidos hoy**. |

---

## 4. Actores y roles

El sistema define 5 roles en una **jerarquía lineal descendente**: quien está más arriba puede
ejecutar todo lo de los de abajo.

```
ADMIN  >  CHIEF_ORGANIZER  >  ORGANIZER  >  TICKETING  >  CONTROL_TICKETING
```

| Rol | Persona real | Alcance |
| --- | --- | --- |
| **ADMIN** | Dueño / productor de la instancia | Todo: configuración, eventos, usuarios, estadísticas, base de datos. |
| **CHIEF_ORGANIZER** | Jefe de RRPP | Su equipo de organizadores, distribución de cupos, ventas del equipo, alta e importación de RRPP, grupos/tags. |
| **ORGANIZER** | RRPP / relacionista | Sus eventos, su link y código, sus ventas, sus códigos de invitación, sus compradores. |
| **TICKETING** | Boletería / puerta | Eventos autorizados, emisión manual de tickets, reenvío, escaneo, listados de presentismo. |
| **CONTROL_TICKETING** | Personal de control de acceso | Sólo escaneo de tickets de los eventos que le fueron asignados. |

**Actor adicional no autenticado:**

| Actor | Descripción |
| --- | --- |
| **Público / Comprador** | Cualquier persona que entra a la landing, compra o descarga sus tickets. No tiene cuenta. |

> ⚠️ **Observación para el corte (no es una decisión):** la jerarquía es lineal, no por permisos
> granulares. Un `ORGANIZER` hereda las capacidades de `TICKETING` (puede emitir tickets, reenviar
> mails y descargar PDFs vía API). Ver Anexo F.

### 4.1 Punto de entrada por rol

| Rol | Ruta por defecto tras login | Navegación disponible |
| --- | --- | --- |
| ADMIN | `/admin` | Eventos, Base de Datos, Organizadores, Escanear, Mis Datos, Configuración |
| CHIEF_ORGANIZER | `/organization` | Eventos, Base de Datos, Organizadores, Mis Datos |
| ORGANIZER | `/organization` | Eventos, Base de Datos, Mis Datos |
| TICKETING | `/admin/event` | Eventos, Escanear |
| CONTROL_TICKETING | `/admin/ticketing` | Escanear |

---

## 5. Mapa de módulos

| # | Módulo | Código | Casos | Foco |
| --- | --- | --- | --- | --- |
| 6 | Acceso, sesión y onboarding | `ACC` | 6 | Login, roles, alta de credenciales de cobro |
| 7 | Configuración de la instancia | `CFG` | 12 | Branding, locaciones, categorías, carpetas, feature flags |
| 8 | Usuarios, roles y equipo | `USR` | 16 | Alta/baja de usuarios internos y RRPP, tags, importación |
| 9 | Gestión de eventos | `EVT` | 24 | Wizard, edición, publicación, duplicación, carpetas |
| 10 | Tipos de ticket | `TKT` | 16 | Precio, cupo, horarios, visibilidad, escaneo |
| 11 | Modos de comercialización | `MOD` | 9 | TRADITIONAL / INVITATION / SIMPLE |
| 12 | Organizadores / RRPP | `ORG` | 13 | Link propio, código, comisión, cupo, ventas |
| 13 | Jefe de organizadores | `JEF` | 9 | Equipo, distribución de cupos, métricas |
| 14 | Venta pública | `VTA` | 20 | Landing, ficha, carrito, checkout, pago, descarga |
| 15 | Emisión y entrega de tickets | `EMI` | 10 | PDF con QR, mail, emisión manual, reenvío |
| 16 | Acreditación y control de acceso | `ACR` | 13 | Escaneo QR, validaciones, historial, presentismo |
| 17 | Operación del evento | `OPE` | 12 | Tablas, búsqueda, filtros, exportación, formularios |
| 18 | Base de datos de compradores | `CRM` | 6 | Padrón único, ficha, contacto |
| 19 | Estadísticas y reportes | `EST` | 8 | Dashboard, comparativas, métricas por organizador |
| 20 | Integraciones y plataforma | `INT` | 10 | MercadoPago, Resend, S3, Pluto, multi-instancia |
| | **Total** | | **184** | |

---

## 6. Módulo ACC — Acceso, sesión y onboarding

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-ACC-01 | Iniciar sesión con usuario y contraseña | Todos los roles | ☐ | ☐ | ☐ | ☐ |
| CU-ACC-02 | Redirección automática al panel según rol | Todos los roles | ☐ | ☐ | ☐ | ☐ |
| CU-ACC-03 | Cerrar sesión | Todos los roles | ☐ | ☐ | ☐ | ☐ |
| CU-ACC-04 | Bloqueo de acceso por rol a secciones del backoffice | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ACC-05 | Onboarding: cargar credenciales de cobro de la instancia 🔌 | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ACC-06 | Esperar el redeploy tras cargar credenciales 🔌 | Admin | ☐ | ☐ | ☐ | ☐ |

#### CU-ACC-01 — Iniciar sesión con usuario y contraseña
- **Actor:** Todos los roles del backoffice.
- **Historia:** Como usuario del backoffice quiero ingresar con mi nombre de usuario y contraseña para acceder a las funciones que me corresponden.
- **Precondición:** El usuario existe y tiene contraseña asignada.
- **Flujo:** 1) Abre `/login`. 2) Ingresa usuario y contraseña. 3) El sistema valida contra hash bcrypt. 4) Crea sesión y redirige.
- **Reglas:** Usuario y contraseña obligatorios; contraseña mínimo 4 caracteres. El login es por **nombre de usuario**, no por email. Se hace `trim()` del usuario.
- **Excepciones:** Credenciales inválidas → mensaje de error genérico en el formulario, sin revelar si el usuario existe.
- **Referencia:** `src/app/login/action.ts`, `src/server/auth.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACC-02 — Redirección automática al panel según rol
- **Actor:** Todos los roles.
- **Historia:** Como usuario quiero que, al entrar, me lleve directo a la pantalla que uso, para no navegar de más.
- **Flujo:** Tras login exitoso el sistema resuelve la ruta por rol: ADMIN → `/admin`; TICKETING → `/admin/event`; CONTROL_TICKETING → `/admin/ticketing`; ORGANIZER y CHIEF_ORGANIZER → `/organization`.
- **Reglas:** Si la instancia todavía no tiene credenciales de cobro cargadas, la redirección va antes a `/credentials` (ver CU-ACC-05).
- **Referencia:** `src/server/utils/authRedirect.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACC-03 — Cerrar sesión
- **Actor:** Todos los roles.
- **Historia:** Como usuario quiero cerrar sesión para dejar libre el dispositivo, sobre todo en la puerta del evento.
- **Referencia:** `src/components/admin/TopBar.tsx`, NextAuth.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACC-04 — Bloqueo de acceso por rol a secciones del backoffice
- **Actor:** Sistema.
- **Historia:** Como dueño de la instancia quiero que cada rol vea solamente lo suyo, para no exponer datos ni acciones sensibles.
- **Reglas:** Doble control — (a) el layout de `/admin` redirige a `/organization` a quien no sea ADMIN, TICKETING o CONTROL_TICKETING; (b) cada procedimiento del API valida el nivel jerárquico del rol. La sidebar además esconde los ítems que no corresponden al rol.
- **Excepciones:** Un ORGANIZER que intenta entrar a `/organization/organizers` sin ser jefe es redirigido; un organizador que abre el evento de otro es redirigido a `/organization`.
- **Referencia:** `src/app/(backoffice)/admin/layout.tsx`, `src/server/trpc.ts`, `src/components/admin/SideBar.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACC-05 — Onboarding: cargar credenciales de cobro de la instancia 🔌
- **Actor:** Admin.
- **Historia:** Como admin de una instancia nueva quiero cargar mis credenciales de MercadoPago para poder empezar a cobrar entradas.
- **Precondición:** La instancia no tiene credenciales cargadas.
- **Flujo:** 1) Al iniciar sesión el sistema detecta la falta de credenciales y fuerza `/credentials`. 2) El admin pega Access Token y Clave Secreta desde su panel de MercadoPago. 3) El sistema valida formato, firma el payload y lo envía al orquestador externo (Pluto). 4) Pluto guarda las credenciales y dispara un redeploy de la instancia.
- **Reglas:** El Access Token debe matchear `APP_USR-<n>-<n>-<alfa>-<n>`; la clave secreta debe ser un hex de 64 caracteres. La request se firma con HMAC y timestamp.
- **Excepciones:** Formato inválido, campo vacío, falta de variables de entorno, fallo del orquestador → mensajes de error específicos en pantalla.
- **Referencia:** `src/app/credentials/page.tsx`, `src/app/credentials/action.ts`, `src/server/security/signed-request.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACC-06 — Esperar el redeploy tras cargar credenciales 🔌
- **Actor:** Admin.
- **Historia:** Como admin quiero ver que el sistema está aplicando mis credenciales para saber cuándo puedo empezar a operar.
- **Flujo:** Tras guardar, el sistema muestra una pantalla de espera que consulta periódicamente el estado del redeploy contra el orquestador, y al terminar redirige al panel según el rol.
- **Referencia:** `src/app/credentials/wait/page.tsx`, `src/app/api/credentials/status/route.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 7. Módulo CFG — Configuración de la instancia

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-CFG-01 | Definir identidad de la instancia (nombre, descripción, dominio) | Deploy | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-02 | Definir paleta de color de la instancia | Deploy | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-03 | Mostrar logo/marca de la instancia | Deploy | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-04 | Crear locación (salón/venue) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-05 | Editar locación | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-06 | Eliminar locación | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-07 | Listar locaciones con sus eventos | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-08 | Crear categoría de evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-09 | Editar categoría de evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-10 | Activar/desactivar categoría en la landing | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-11 | Reordenar categorías de la landing (drag & drop) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CFG-12 | Administrar feature flags de la instancia | Admin | ☐ | ☐ | ☐ | ☐ |

#### CU-CFG-01 — Definir identidad de la instancia
- **Actor:** Responsable del deploy (no hay UI).
- **Historia:** Como cliente quiero que la plataforma lleve mi nombre y mi dominio para que el comprador perciba mi marca y no la de un tercero.
- **Reglas:** Se configura por variables de entorno: `NEXT_PUBLIC_INSTANCE_NAME`, `NEXT_PUBLIC_INSTANCE_DESCRIPTION`, `INSTANCE_WEB_URL`, `INSTANCE_CONTACT_EMAIL`. El nombre se usa en el remitente de los mails, en el nombre de los PDF y en el path de las imágenes en S3.
- **Referencia:** `.env.example`, `src/app/layout.tsx`, `src/server/services/mail.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-02 — Definir paleta de color de la instancia
- **Actor:** Responsable del deploy.
- **Historia:** Como cliente quiero que la plataforma use los colores de mi marca.
- **Reglas:** Se define un **hue** y una **saturación** (`NEXT_PUBLIC_HUE`, `NEXT_PUBLIC_SATURATION`) y el sistema deriva toda la escala (accent dark, accent, botón, brand, light, ultra light) y calcula automáticamente el color de texto legible sobre el acento.
- **Referencia:** `src/lib/get-colors.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-03 — Mostrar logo/marca de la instancia
- **Actor:** Responsable del deploy.
- **Historia:** Como cliente quiero mi logo en el header público y del backoffice.
- **Referencia:** `src/components/header/InstanceLogo.tsx`, `public/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-04 — Crear locación (salón/venue)
- **Actor:** Admin.
- **Historia:** Como admin quiero cargar los datos del salón donde hago los eventos, para reutilizarlos en cada fecha y que el comprador sepa dónde ir.
- **Flujo:** 1) Va a Configuración (o `/admin/locations`). 2) Abre el modal de nueva locación. 3) Carga nombre, dirección, link de Google Maps y capacidad. 4) Guarda.
- **Reglas:** Todos los campos son obligatorios; la capacidad debe ser mayor a 0; el link de Google Maps debe ser una URL válida (el formulario sugiere usar el botón "Compartir" de Maps).
- **Referencia:** `src/server/routers/location.ts` (`location.create`), `src/components/location/LocationModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-05 — Editar locación
- **Actor:** Admin.
- **Historia:** Como admin quiero corregir los datos de un salón (se mudó, cambió la capacidad) sin tener que recrearlo.
- **Referencia:** `src/server/routers/location.ts` (`location.update`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-06 — Eliminar locación
- **Actor:** Admin.
- **Historia:** Como admin quiero eliminar un salón que ya no uso para no ensuciar el listado.
- **Excepciones:** El borrado es físico; si la locación tiene eventos asociados la operación falla por integridad referencial.
- **Referencia:** `src/server/routers/location.ts` (`location.delete`), `src/components/location/DeleteLocationModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-07 — Listar locaciones con sus eventos
- **Actor:** Admin.
- **Historia:** Como admin quiero ver mis salones y qué eventos hice en cada uno.
- **Referencia:** `src/components/location/LocationList.tsx`, `src/components/location/LocationAccordion.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-08 — Crear categoría de evento
- **Actor:** Admin.
- **Historia:** Como admin quiero clasificar mis eventos (ej. "Fiestas", "Shows", "After") para que el público pueda filtrarlos en la home.
- **Reglas:** El nombre es obligatorio. La categoría se crea al final del orden existente. **Todo evento requiere una categoría** — es un campo obligatorio del evento.
- **Referencia:** `src/server/routers/event-categories.ts` (`eventCategories.create`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-09 — Editar categoría de evento
- **Actor:** Admin.
- **Referencia:** `src/server/routers/event-categories.ts` (`eventCategories.edit`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-10 — Activar/desactivar categoría en la landing
- **Actor:** Admin.
- **Historia:** Como admin quiero decidir qué categorías aparecen en el navbar público sin borrarlas.
- **Reglas:** Sólo las categorías con `isActive = true` se muestran en el filtro público.
- **Referencia:** `src/server/routers/event-categories.ts` (`eventCategories.toggleActive`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-11 — Reordenar categorías de la landing (drag & drop)
- **Actor:** Admin.
- **Historia:** Como admin quiero controlar el orden en que aparecen las categorías en la home para destacar la que más me interesa.
- **Referencia:** `src/server/routers/event-categories.ts` (`eventCategories.reorder`), `src/components/admin/category/CategoryList.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CFG-12 — Administrar feature flags de la instancia
- **Actor:** Admin.
- **Historia:** Como admin quiero activar o desactivar funcionalidades opcionales de mi instancia.
- **Estado:** **Infraestructura implementada, sin flags definidos.** Existen tabla, API (`feature.getAll`, `getByKey`, `isEnabledByKey`, `update`), pantalla de administración y componente envoltorio para condicionar UI, pero el catálogo `FEATURE_KEYS` está vacío.
- **Nota para el corte:** este es el mecanismo natural para implementar diferencias Light/Pro dentro de un mismo código base.
- **Referencia:** `src/server/routers/feature.ts`, `src/server/constants/feature-keys.ts`, `src/components/admin/config/UpdateFeatures.tsx`, `FeatureWrapper.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 8. Módulo USR — Usuarios, roles y equipo

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-USR-01 | Crear usuario interno (admin, boletería, control) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-USR-02 | Confirmar explícitamente la creación de un usuario ADMIN | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-USR-03 | Listar usuarios internos | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-USR-04 | Crear organizador / RRPP | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-05 | Listar organizadores con filtros y grupos | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-06 | Ver ficha de un organizador | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-07 | Editar datos de un usuario | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-08 | Editar mis propios datos (perfil) | Admin, Jefe, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-USR-09 | Resetear la contraseña de un usuario | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-10 | Compartir credenciales generadas | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-11 | Eliminar usuario | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-12 | Importar organizadores masivamente desde planilla | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-13 | Crear y administrar grupos (tags) de organizadores | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-14 | Asignar / quitar organizadores de un grupo | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-15 | Cargar alias de cobro y carpeta de Drive de un organizador | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-USR-16 | Asignar un organizador a un jefe de organizadores | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |

#### CU-USR-01 — Crear usuario interno (admin, boletería, control)
- **Actor:** Admin.
- **Historia:** Como admin quiero dar de alta a la gente de boletería y de puerta para que puedan operar el evento sin ver todo el sistema.
- **Flujo:** Configuración → Usuarios → Crear usuario → completa nombre de usuario, nombre completo, email, DNI, fecha de nacimiento, teléfono, género, Instagram, rol y contraseña.
- **Reglas:** Email, DNI y nombre de usuario deben ser **únicos** en el sistema; DNI sin puntos ni comas; contraseña mínimo 4 caracteres; fecha de nacimiento posterior a 1900; Instagram máximo 30 caracteres (se le saca el `@` inicial automáticamente).
- **Excepciones:** Duplicado de email / DNI / usuario → error explícito por campo.
- **Referencia:** `src/server/routers/user.ts` (`user.create`), `src/components/admin/config/CreateUserForm.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-02 — Confirmar explícitamente la creación de un usuario ADMIN
- **Actor:** Admin.
- **Historia:** Como admin quiero un paso extra de confirmación antes de crear otro admin, para no dar acceso total por error.
- **Referencia:** `src/components/admin/users/ConfirmAdminCreationModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-03 — Listar usuarios internos
- **Actor:** Admin.
- **Historia:** Como admin quiero ver quién tiene acceso al sistema y con qué rol.
- **Reglas:** La tabla de Configuración muestra sólo usuarios que **no** son ORGANIZER ni CHIEF_ORGANIZER (esos viven en su propia sección).
- **Referencia:** `src/app/(backoffice)/admin/settings/page.tsx`, `src/components/admin/config/UsersTable.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-04 — Crear organizador / RRPP
- **Actor:** Admin, Jefe de organizadores.
- **Historia:** Como jefe de RRPP quiero dar de alta a un relacionista para poder asignarle eventos, cupos y comisiones.
- **Reglas:** Mismas validaciones de unicidad que CU-USR-01. Si el alta la hace un CHIEF_ORGANIZER, el nuevo organizador queda automáticamente bajo su jefatura.
- **Referencia:** `src/server/routers/user.ts` (`user.create`), `src/components/admin/users/CreateOrganizerForm.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-05 — Listar organizadores con filtros y grupos
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero ver todo mi equipo, filtrarlo y agruparlo para gestionarlo.
- **Reglas:** El admin ve todos los ORGANIZER y CHIEF_ORGANIZER; el jefe ve sólo los suyos. Cada fila muestra los grupos (tags) que el usuario que consulta creó.
- **Referencia:** `src/server/routers/user.ts` (`user.getOrganizers`, `user.getOrganizersByChiefOrganizer`), `src/components/admin/users/UsersTableWithFilters.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-06 — Ver ficha de un organizador
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero abrir la ficha de un RRPP y ver sus datos de contacto, sus links de cobro y a qué eventos asistió.
- **Reglas:** Muestra datos personales, alias de MercadoPago, Google Drive, y los últimos eventos (de los últimos 20 activos) donde su ticket fue escaneado.
- **Referencia:** `src/server/routers/organizer.ts` (`organizer.getInfoById`), `src/app/(backoffice)/organization/organizers/[id]/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-07 — Editar datos de un usuario
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero corregir los datos de un integrante del equipo.
- **Reglas:** No se edita la contraseña por esta vía (ver CU-USR-09). Existe también una edición parcial que no toca email, DNI ni nombre de usuario.
- **Referencia:** `src/server/routers/user.ts` (`user.update`, `user.partialUpdate`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-08 — Editar mis propios datos (perfil)
- **Actor:** Admin, Jefe, Organizador.
- **Historia:** Como usuario quiero mantener mis datos y mi alias de cobro actualizados sin depender de otro.
- **Reglas:** El propio usuario **no puede cambiar su rol** ni su jefe; el rol aparece bloqueado en el formulario.
- **Referencia:** `src/server/routers/user.ts` (`user.updateOwnProfile`), `src/app/(backoffice)/profile/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-09 — Resetear la contraseña de un usuario
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero generar una contraseña nueva para un RRPP que la perdió, y poder pasársela.
- **Flujo:** Abre la ficha → Resetear contraseña → el sistema hashea la nueva clave y devuelve los datos de contacto del usuario para poder comunicársela.
- **Referencia:** `src/server/routers/user.ts` (`user.resetPassword`), `src/components/admin/users/ResetPasswordForm.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-10 — Compartir credenciales generadas
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero copiar o enviar por WhatsApp las credenciales recién generadas al RRPP.
- **Referencia:** `src/components/admin/users/CredentialsModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-11 — Eliminar usuario
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero dar de baja a alguien que ya no trabaja conmigo.
- **Reglas:** Borrado físico. Por diseño de la base, los tickets escaneados por ese usuario y los grupos que invitó quedan con la referencia en null (no se pierden los tickets); los códigos de invitación asignados a ese organizador **sí se eliminan en cascada**.
- **Referencia:** `src/server/routers/user.ts` (`user.delete`), `src/components/admin/users/DeleteUserModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-12 — Importar organizadores masivamente desde planilla
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero subir una planilla con 50 RRPP y que el sistema los cree a todos, les genere usuario y contraseña y les mande el mail de bienvenida.
- **Flujo:** 1) Sube el archivo con columnas nombre, apellido, email, DNI, fecha de nacimiento, teléfono, Instagram. 2) Da un nombre al lote. 3) El sistema valida duplicados dentro del archivo y contra la base. 4) Crea cada usuario con rol ORGANIZER, username derivado del email (resolviendo colisiones con sufijo numérico) y contraseña aleatoria. 5) Envía mail de bienvenida con las credenciales. 6) Agrupa a todos bajo un tag con el nombre del lote.
- **Reglas:** Si hay **cualquier** error de validación no se importa nada y se devuelve el listado de errores por número de fila. Si el importador es un jefe, todos quedan bajo su jefatura.
- **Excepciones:** Email o DNI duplicado en el archivo; email o DNI ya existente en el sistema.
- **Referencia:** `src/server/routers/user.ts` (`user.importUsers`), `src/components/admin/users/ImportUsersModal.tsx`, `src/lib/userImportUtils.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-13 — Crear y administrar grupos (tags) de organizadores
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero agrupar a mis RRPP (por equipo, por lote de importación, por zona) para trabajarlos en bloque.
- **Reglas:** Cada tag **pertenece al usuario que lo creó**; sólo su dueño lo ve, edita o borra. No puede haber dos tags con el mismo nombre (case-insensitive) del mismo dueño. Máximo 20 caracteres.
- **Referencia:** `src/server/routers/tag.ts`, `src/components/admin/users/TagModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-14 — Asignar / quitar organizadores de un grupo
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero mover gente entre grupos.
- **Reglas:** Sólo sobre tags propios. Agregar un usuario ya presente es idempotente.
- **Referencia:** `src/server/routers/tag.ts` (`tag.addUserToTag`, `tag.removeUserFromTag`), `src/components/admin/users/AddTag.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-15 — Cargar alias de cobro y carpeta de Drive de un organizador
- **Actor:** Admin, Jefe.
- **Historia:** Como jefe quiero tener a mano el CVU/alias de cada RRPP para liquidarle, y el link a su carpeta de material.
- **Reglas:** Alias/CVU máximo 24 caracteres; Drive debe ser URL válida. Ambos opcionales. Desde la ficha se puede copiar el alias al portapapeles con un click y abrir el Drive.
- **Nota:** El sistema **guarda y muestra** el alias, pero **no liquida ni transfiere**. Ver Anexo F.
- **Referencia:** `src/components/admin/organizer/LinksModal.tsx`, `OrganizerLinks.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-USR-16 — Asignar un organizador a un jefe de organizadores
- **Actor:** Admin, Jefe.
- **Historia:** Como admin quiero armar la estructura jerárquica de RRPP (jefe → equipo) para delegar la gestión de cupos y comisiones.
- **Reglas:** Un usuario tiene un único jefe (`chiefOrganizerId`). Al eliminar el jefe, sus organizadores quedan sin jefe (no se borran).
- **Referencia:** `prisma/schema.prisma` (`USER_X_CHIEF_ORGANIZER`), formularios de organizador.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 9. Módulo EVT — Gestión de eventos

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-EVT-01 | Crear evento con asistente de 4 pasos | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-02 | Cargar información general del evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-03 | Subir y recortar la imagen de portada 🔌 | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-04 | Adjuntar video de YouTube al evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-05 | Escribir la descripción con formato enriquecido | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-06 | Definir edad mínima de ingreso ⚙️ | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-07 | Elegir modo de invitación del evento ⚙️ | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-08 | Definir si se piden datos de cada asistente ⚙️ | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-09 | Configurar cargo por servicio ⚙️ | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-10 | Configurar mail de notificación de ventas ⚙️ | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-11 | Mostrar el código del ticket en el PDF ⚙️ | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-12 | Habilitar campo "invita" de texto libre ⚙️ | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-13 | Configurar preguntas del formulario de compra | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-14 | Asignar usuarios de boletería autorizados al evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-15 | Previsualizar el evento antes de publicar | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-16 | Publicar / despublicar evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-17 | Editar un evento existente | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-18 | Duplicar un evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-19 | Eliminar un evento (baja lógica) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-20 | Listar eventos próximos y pasados | Admin, Boletería | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-21 | Crear carpetas de eventos con color | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-22 | Mover un evento a una carpeta | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-23 | Ver el panel individual de un evento | Admin, Boletería | ☐ | ☐ | ☐ | ☐ |
| CU-EVT-24 | Ver contador de tickets emitidos sobre cupo total | Admin, Boletería, Organizador | ☐ | ☐ | ☐ | ☐ |

#### CU-EVT-01 — Crear evento con asistente de 4 pasos
- **Actor:** Admin.
- **Historia:** Como productor quiero cargar un evento nuevo guiado paso a paso, para no olvidarme de nada.
- **Flujo:** Paso 1 **Información general** → Paso 2 **Organizadores** (incluye elegir el modo de invitación) → Paso 3 **Tickets** → Paso 4 **Revisión y publicación**.
- **Reglas:** El estado del asistente se mantiene en memoria (store) hasta confirmar; recién en el último paso se crea todo en una única transacción (evento + tipos de ticket + organizadores + preguntas + tickets de organizador).
- **Excepciones:** Si algo falla, la transacción hace rollback completo y no queda un evento a medias.
- **Referencia:** `src/app/(backoffice)/admin/event/create/`, `src/components/event/create/steps.tsx`, `src/server/routers/events.ts` (`events.create`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-02 — Cargar información general del evento
- **Actor:** Admin.
- **Historia:** Como productor quiero cargar el nombre, la fecha, el lugar y la descripción de mi fiesta.
- **Reglas:** Obligatorios: nombre, descripción, portada, fecha/hora de inicio, fecha/hora de fin, locación y categoría. El sistema genera un **slug único** a partir del nombre (si se repite, agrega sufijo) que es la URL pública del evento.
- **Referencia:** `src/components/event/create/EventGeneralInformation.tsx`, `src/server/schemas/event.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-03 — Subir y recortar la imagen de portada 🔌
- **Actor:** Admin.
- **Historia:** Como productor quiero subir el flyer de la fiesta y encuadrarlo bien para que se vea prolijo en la home.
- **Flujo:** Arrastra o selecciona la imagen → recorta en formato cuadrado con un diálogo dedicado → se sube a S3 bajo el path de la instancia → la URL queda guardada en el evento.
- **Reglas:** Sólo tipos `image/*`. Requiere sesión activa para subir.
- **Referencia:** `src/app/api/upload/route.ts`, `src/components/event/create/ImageUploader.tsx`, `EventCoverSquareCropDialog.tsx`, `src/lib/image-crop.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-04 — Adjuntar video de YouTube al evento
- **Actor:** Admin.
- **Historia:** Como productor quiero mostrar el aftermovie o el trailer del line-up en la página del evento.
- **Reglas:** **Sólo se admiten URLs de YouTube**; el campo vacío se guarda como nulo. Se embebe en la ficha pública.
- **Referencia:** `src/lib/event-video-url.ts`, `src/components/event/create/EventVideoField.tsx`, `src/components/event/buyPage/EventVideoEmbed.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-05 — Escribir la descripción con formato enriquecido
- **Actor:** Admin.
- **Historia:** Como productor quiero poner el line-up, los horarios y las condiciones con negritas, listas y links, y ver cómo va a quedar.
- **Reglas:** Editor tipo markdown con **vista previa en vivo** del resultado renderizado.
- **Referencia:** `src/components/common/MarkdownTextareaWithLabel.tsx`, `src/lib/markdown-textarea.ts`, `src/components/event/buyPage/EventDescriptionContent.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-06 — Definir edad mínima de ingreso ⚙️
- **Actor:** Admin.
- **Historia:** Como productor quiero que el sistema no me deje vender entradas a menores de determinada edad.
- **Reglas:** Si el evento tiene edad mínima, el checkout valida la fecha de nacimiento de **cada** asistente y rechaza la compra indicando el campo exacto.
- **Referencia:** `src/app/(client)/checkout/action.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-07 — Elegir modo de invitación del evento ⚙️
- **Actor:** Admin.
- **Historia:** Como productor quiero definir si el evento es de venta abierta, por invitación cerrada o con "invita" libre.
- **Reglas:** Tres valores: `TRADITIONAL`, `INVITATION`, `SIMPLE`. **El modo no se puede cambiar en la edición** (el update no lo toca). Determina qué pantallas, botones y flujos existen para ese evento. Ver módulo MOD.
- **Referencia:** `src/components/event/create/EventInvitationTypeAction.tsx`, `prisma/schema.prisma` (`InviteCondition`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-08 — Definir si se piden datos de cada asistente ⚙️
- **Actor:** Admin.
- **Historia:** Como productor quiero decidir si le pido los datos a cada persona de la compra o alcanza con los del comprador.
- **Reglas:** Con `extraTicketData = true` el checkout pide nombre, DNI, mail, fecha de nacimiento, teléfono, género e Instagram **por cada entrada**, y cada ticket se manda al mail de su titular. Con `false` se cargan datos una sola vez, se replican a todas las entradas (numeradas `#2`, `#3`…) y **se envía un único mail con todos los PDF adjuntos**.
- **Referencia:** `src/app/(client)/checkout/action.ts`, `src/app/api/mercadopago/route.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-09 — Configurar cargo por servicio ⚙️
- **Actor:** Admin.
- **Historia:** Como productor quiero cobrar un cargo por servicio sobre el precio de la entrada.
- **Reglas:** Valor numérico ≥ 0 por evento; se aplica sobre el subtotal en el checkout y se muestra desagregado antes de pagar.
- **Referencia:** `src/lib/utils.ts` (`calculateTotalPriceFromData`), `src/server/services/ticketGroup.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-10 — Configurar mail de notificación de ventas ⚙️
- **Actor:** Admin.
- **Historia:** Como productor quiero que me llegue un mail cada vez que se vende una entrada de este evento.
- **Reglas:** Si el evento tiene mail de notificación, al concretarse una compra (gratuita o pagada) se envía un aviso con evento, cantidad y tipo de tickets y monto total recaudado. Con reintentos automáticos ante fallas.
- **Referencia:** `src/server/services/notification.ts`, `src/server/utils/retry.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-11 — Mostrar el código del ticket en el PDF ⚙️
- **Actor:** Admin.
- **Historia:** Como productor quiero que el PDF muestre el código legible del ticket, para poder buscarlo manualmente si falla el escáner.
- **Referencia:** `src/server/utils/ticket-template.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-12 — Habilitar campo "invita" de texto libre ⚙️
- **Actor:** Admin.
- **Historia:** Como productor quiero que el comprador escriba quién lo invitó, sin tener que dar de alta a cada RRPP como usuario del sistema.
- **Reglas:** Flag `hasSimpleInvitation`. Habilita un campo de texto libre en el checkout que se guarda en la orden y aparece como columna "Invita" en las tablas y exportaciones.
- **Referencia:** `src/server/routers/ticket-group.ts` (`ticketGroup.updateInvitedBySimple`), `src/components/event/individual/ticketsTable/columns.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-13 — Configurar preguntas del formulario de compra
- **Actor:** Admin.
- **Historia:** Como productor quiero hacerle preguntas al comprador (¿cómo te enteraste?, ¿venís con auto?) para tener información del público.
- **Reglas:** Lista ordenada de preguntas de texto libre. **Todas son obligatorias** en el checkout. Al borrarlas se usa baja lógica para no perder las respuestas ya cargadas.
- **Referencia:** `src/components/event/create/EventQuestions.tsx`, `src/server/routers/ticket-group.ts` (`ticketGroup.saveAnswers`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-14 — Asignar usuarios de boletería autorizados al evento
- **Actor:** Admin.
- **Historia:** Como productor quiero elegir qué gente de boletería/puerta puede operar este evento en particular.
- **Reglas:** Los roles TICKETING y CONTROL_TICKETING **sólo ven los eventos donde fueron autorizados**. Se pueden crear usuarios de boletería desde el mismo paso del asistente.
- **Referencia:** `src/components/event/create/TicketingUserModal.tsx`, `EditTicketingUserModal.tsx`, `src/server/routers/events.ts` (`events.getAllForTicketing`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-15 — Previsualizar el evento antes de publicar
- **Actor:** Admin.
- **Historia:** Como productor quiero ver cómo va a quedar la página del evento antes de publicarla.
- **Referencia:** `src/components/event/create/PreviewEvent.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-16 — Publicar / despublicar evento
- **Actor:** Admin.
- **Historia:** Como productor quiero decidir cuándo el evento se hace visible al público y poder bajarlo si hace falta.
- **Reglas:** Sólo los eventos con `isActive = true`, no eliminados y con fecha de fin futura aparecen en la landing pública. En modo INVITATION el botón de publicar no se muestra (el evento no tiene venta pública).
- **Referencia:** `src/server/routers/events.ts` (`events.toggleActivate`, `events.getActive`), `src/components/event/individual/ToggleActivateButton.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-17 — Editar un evento existente
- **Actor:** Admin.
- **Historia:** Como productor quiero corregir datos, agregar tipos de ticket, sumar o sacar RRPP y ajustar cupos después de haber creado el evento.
- **Reglas:** Reutiliza el mismo asistente en modo edición. Permite: cambiar datos generales y flags, **agregar/editar/eliminar tipos de ticket**, agregar/eliminar organizadores (recalculando códigos de invitación y tickets de organizador), y editar preguntas. **No** permite cambiar el modo de invitación. En modo INVITATION exige al menos un organizador.
- **Excepciones:** Al eliminar organizadores en modo invitación se borran sus códigos no usados y se ajustan los contadores de las órdenes; los códigos ya usados se conservan.
- **Referencia:** `src/server/routers/events.ts` (`events.update`), `src/app/(backoffice)/admin/event/edit/[slug]/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-18 — Duplicar un evento
- **Actor:** Admin.
- **Historia:** Como productor con fiesta semanal quiero clonar la fecha anterior en un click en vez de recargar todo.
- **Reglas:** Copia el evento y **todos sus tipos de ticket** (con slugs nuevos). El nuevo evento se llama "<nombre> (copia)" y queda **despublicado**. **No** copia organizadores, preguntas, usuarios de boletería ni tickets.
- **Referencia:** `src/server/routers/events.ts` (`events.duplicate`), `src/components/events/admin/DuplicateEventModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-19 — Eliminar un evento (baja lógica)
- **Actor:** Admin.
- **Historia:** Como productor quiero sacar del sistema un evento que se cayó.
- **Reglas:** **No se puede eliminar un evento activo** — primero hay que despublicarlo. El borrado es lógico (`isDeleted`), de modo que los datos históricos se conservan.
- **Referencia:** `src/server/routers/events.ts` (`events.delete`), `src/components/event/individual/DeleteEventModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-20 — Listar eventos próximos y pasados
- **Actor:** Admin, Boletería.
- **Historia:** Como productor quiero ver de un vistazo qué tengo por delante y poder revisar lo que ya pasó.
- **Reglas:** Se separan por fecha de finalización. Se agrupan por carpeta y, aparte, los que no tienen carpeta. Boletería ve sólo los eventos autorizados.
- **Referencia:** `src/server/routers/events.ts` (`events.getAll`, `events.getAuthorized`), `src/components/events/admin/EventList.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-21 — Crear carpetas de eventos con color
- **Actor:** Admin.
- **Historia:** Como productor con varios ciclos quiero agrupar mis eventos por marca/ciclo y distinguirlos por color.
- **Referencia:** `src/server/routers/event-folder.ts`, `src/components/events/admin/EventFolderModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-22 — Mover un evento a una carpeta
- **Actor:** Admin.
- **Referencia:** `src/server/routers/event-folder.ts` (`eventFolder.changeFolder`), `src/components/events/admin/ChangeEventFolder.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-23 — Ver el panel individual de un evento
- **Actor:** Admin, Boletería.
- **Historia:** Como productor quiero una pantalla única del evento con los datos, los números y todas las acciones operativas.
- **Reglas:** Reúne: datos básicos, contador de emitidos, botones de escanear / emitir ticket / QR imprimible / publicar / eliminar / distribuir invitaciones (según modo y rol), listado de ventas y respuestas del formulario.
- **Referencia:** `src/app/(backoffice)/admin/event/[slug]/page.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EVT-24 — Ver contador de tickets emitidos sobre cupo total
- **Actor:** Admin, Boletería, Organizador.
- **Historia:** Como productor quiero saber cuántas entradas llevo emitidas sobre el total disponible.
- **Reglas:** El total se calcula distinto según el modo: en TRADITIONAL/SIMPLE es la suma de cupos de los tipos de ticket (excluyendo el tipo "Organizador"); en INVITATION es la suma de invitaciones asignadas a los organizadores. Los tickets de organizadores se contabilizan aparte. El organizador ve el contador **de su propio cupo**.
- **Referencia:** `src/components/event/individual/QuantityTicketsEmitted.tsx`, `src/lib/event-organizers.ts`, `src/lib/chief-organizer-event.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 10. Módulo TKT — Tipos de ticket

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-TKT-01 | Crear tipo de ticket | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-02 | Definir precio y categoría (gratis / pago / mesa) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-03 | Definir cupo máximo del tipo de ticket | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-04 | Definir máximo de entradas por compra | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-05 | Definir fecha límite de venta | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-06 | Definir horario de validez propio del ticket | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-07 | Definir límite horario de escaneo | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-08 | Permitir múltiples escaneos del mismo ticket | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-09 | Ocultar un tipo de ticket de la web | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-10 | Configurar aviso de "últimos lugares" | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-11 | Reordenar los tipos de ticket (drag & drop) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-12 | Asignar organizadores a un tipo de ticket específico | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-13 | Obtener el link directo a un tipo de ticket | Admin, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-14 | Editar un tipo de ticket | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-15 | Eliminar un tipo de ticket | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-TKT-16 | Tipo de ticket especial "Organizador" 🧩 | Sistema | ☐ | ☐ | ☐ | ☐ |

#### CU-TKT-01 — Crear tipo de ticket
- **Actor:** Admin.
- **Historia:** Como productor quiero definir las distintas entradas de mi fiesta (early bird, general, VIP, mesa) con su precio y su cupo.
- **Reglas:** Obligatorios nombre y descripción. Se genera un **slug propio por tipo** derivado del nombre, único dentro del evento, que permite linkear directo a ese tipo.
- **Referencia:** `src/components/event/create/ticketType/TicketTypeModal.tsx`, `src/server/schemas/ticket-type.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-02 — Definir precio y categoría (gratis / pago / mesa)
- **Actor:** Admin.
- **Historia:** Como productor quiero tener entradas gratuitas, pagas y mesas en el mismo evento.
- **Reglas:** Categorías `FREE`, `PAID`, `TABLE`. El precio puede ser nulo (gratis). Un carrito cuyo total sea 0 **no pasa por la pasarela de pago**: se confirma directamente y se emiten los tickets.
- **Referencia:** `prisma/schema.prisma` (`TicketTypeCategory`), `src/app/(client)/checkout/action.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-03 — Definir cupo máximo del tipo de ticket
- **Actor:** Admin.
- **Historia:** Como productor quiero limitar cuántas entradas de cada tipo se pueden vender.
- **Reglas:** Mínimo 1. La disponibilidad se calcula descontando lo ya reservado/vendido; al agotarse, el tipo se muestra como "¡Agotados!" y no se puede seleccionar.
- **Referencia:** `src/hooks/useEventTickets.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-04 — Definir máximo de entradas por compra
- **Actor:** Admin.
- **Historia:** Como productor quiero evitar que una sola persona se lleve todo el cupo.
- **Reglas:** Mínimo 1. El selector del checkout se limita al menor entre el máximo por compra y el remanente disponible.
- **Referencia:** `src/hooks/useEventTickets.ts`, `src/components/event/buyPage/TicketPurchase.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-05 — Definir fecha límite de venta
- **Actor:** Admin.
- **Historia:** Como productor quiero cortar la venta anticipada a determinada hora.
- **Reglas:** Los tipos cuya fecha límite ya pasó **dejan de mostrarse** en la ficha pública del evento.
- **Referencia:** `src/app/(client)/event/[slug]/page.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-06 — Definir horario de validez propio del ticket
- **Actor:** Admin.
- **Historia:** Como productor quiero vender entradas con horarios distintos (ej. "hasta la 1 AM", "after 4 AM") dentro del mismo evento.
- **Reglas:** Cada tipo tiene su propia fecha/hora de inicio, que se imprime en el PDF y se muestra en la ficha pública si difiere de la del evento. Al escanear antes de esa hora, el sistema avisa la hora de inicio.
- **Referencia:** `prisma/schema.prisma` (`TicketType.startingDate`), `src/server/routers/emitted-tickets.ts` (`emittedTickets.scan`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-07 — Definir límite horario de escaneo
- **Actor:** Admin.
- **Historia:** Como productor quiero que las entradas promocionales sólo sirvan hasta cierta hora.
- **Reglas:** Si se escanea después del límite, el escaneo **se registra igual** pero el sistema muestra el aviso "Ticket expirado, límite de horario era …" para que la puerta decida.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.scan`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-08 — Permitir múltiples escaneos del mismo ticket
- **Actor:** Admin.
- **Historia:** Como productor quiero que ciertas entradas (staff, prensa, abono de varios días) puedan entrar y salir varias veces.
- **Reglas:** Con `allowMultipleScans = true` el ticket nunca da "ya escaneado": cada pasada queda registrada como un escaneo más y el sistema informa el número de escaneo.
- **Referencia:** `src/server/utils/register-ticket-scan.ts` (`canRegisterScan`), tabla `emittedTicketScan`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-09 — Ocultar un tipo de ticket de la web
- **Actor:** Admin.
- **Historia:** Como productor quiero tener entradas que no se muestren públicamente y sólo se vendan por link directo o por boletería.
- **Reglas:** Con `visibleInWeb = false` el tipo no aparece en la ficha pública, pero **sí es accesible entrando con el link del tipo** (`?ticket=<slug>`).
- **Referencia:** `src/app/(client)/event/[slug]/page.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-10 — Configurar aviso de "últimos lugares"
- **Actor:** Admin.
- **Historia:** Como productor quiero generar urgencia mostrando "¡Quedan N tickets!" cuando el stock baja.
- **Reglas:** Se define un umbral por tipo; cuando el remanente es menor o igual, se muestra la leyenda con la cantidad exacta.
- **Referencia:** `src/hooks/useEventTickets.ts`, `src/components/event/buyPage/TicketPurchase.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-11 — Reordenar los tipos de ticket (drag & drop)
- **Actor:** Admin.
- **Historia:** Como productor quiero controlar el orden en que se muestran las entradas al comprador.
- **Reglas:** Orden persistido por evento; se respeta tanto en la ficha pública como en las solapas del backoffice.
- **Referencia:** `src/hooks/useSortableList.ts`, `src/components/event/create/ticketType/TicketTypeList.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-12 — Asignar organizadores a un tipo de ticket específico
- **Actor:** Admin.
- **Historia:** Como productor quiero que ciertos RRPP vendan solamente determinadas entradas (ej. sólo mesas, sólo lista gratis).
- **Reglas:** Un organizador asignado a un tipo de ticket puede usar su código aunque no esté asignado al evento — en ese caso valida pero **sin descuento**.
- **Referencia:** `src/components/event/create/ticketType/TicketTypeOrganizersModal.tsx`, `src/server/routers/events.ts` (`events.validateOrganizerCode`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-13 — Obtener el link directo a un tipo de ticket
- **Actor:** Admin, Organizador.
- **Historia:** Como RRPP quiero un link que abra el evento con mi entrada ya filtrada y mi código aplicado, para mandarlo por WhatsApp.
- **Reglas:** Formato `…/event/<slug>?codigo=<código del organizador>&ticket=<slug del tipo>`. Se copia al portapapeles desde la solapa del tipo. Admite varios tipos separados por coma. **El tipo "Organizador" nunca es accesible por esta vía.**
- **Referencia:** `src/components/event/individual/TicketTableWithTabs.tsx`, `src/server/utils/constants.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-14 — Editar un tipo de ticket
- **Actor:** Admin.
- **Historia:** Como productor quiero cambiar el precio o el cupo de una entrada mientras el evento está en venta.
- **Referencia:** `src/server/routers/events.ts` (`events.update`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-15 — Eliminar un tipo de ticket
- **Actor:** Admin.
- **Historia:** Como productor quiero eliminar una entrada que ya no ofrezco.
- **Reglas:** Se elimina al guardar la edición del evento si el tipo dejó de estar en la lista. **El tipo "Organizador" está protegido** y nunca se elimina automáticamente. Eliminar un tipo borra en cascada sus tickets emitidos.
- **Referencia:** `src/server/routers/events.ts` (`events.update`), `src/components/event/create/ticketType/DeleteTicketTypeModal.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-TKT-16 — Tipo de ticket especial "Organizador" 🧩
- **Actor:** Sistema.
- **Historia:** Como productor quiero que cada RRPP asignado al evento tenga su propia entrada para poder ingresar.
- **Reglas:** Es un tipo de ticket con nombre reservado. Al crear el evento con organizadores, el sistema emite **un ticket por organizador** dentro de un grupo marcado como "de organizadores", excluido de los contadores de venta y del listado público. Opcionalmente envía ese ticket por mail.
- **Referencia:** `src/server/utils/constants.ts` (`ORGANIZER_TICKET_TYPE_NAME`), `src/server/routers/events.ts` (`events.create`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 11. Módulo MOD — Modos de comercialización (invite condition)

> Este módulo no agrega pantallas nuevas: **modula el comportamiento de todo el resto del sistema**.
> Es probablemente el eje más determinante para el corte Light/Pro, por eso se documenta aparte.

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-MOD-01 | Operar un evento en modo TRADICIONAL (venta abierta) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-02 | Asignar comisión (% de descuento) por organizador | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-03 | Operar un evento en modo INVITACIÓN (cerrado) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-04 | Asignar cupo de invitaciones por organizador | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-05 | Generar códigos de invitación individuales | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-06 | Canjear un código de invitación | Público | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-07 | Operar un evento en modo SIMPLE ("invita" libre) | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-08 | Repartir cupos "robando" tickets a otros organizadores | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-MOD-09 | Ver la distribución de invitaciones entregadas | Admin, Jefe | ☐ | ☐ | ☐ | ☐ |

#### CU-MOD-01 — Operar un evento en modo TRADICIONAL (venta abierta)
- **Actor:** Admin.
- **Historia:** Como productor quiero vender entradas online al público general y que mis RRPP sumen ventas con su código.
- **Reglas:** El evento aparece en la landing si está publicado. Hay carrito, checkout, pago, tipos de ticket múltiples, códigos de organizador con descuento, links por tipo de ticket y QR público del evento.
- **Referencia:** `src/app/(client)/event/[slug]/page.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-02 — Asignar comisión (% de descuento) por organizador
- **Actor:** Admin.
- **Historia:** Como productor quiero que cada RRPP tenga su porcentaje de descuento para incentivar la venta por su canal.
- **Reglas:** Valor entre 0 y 100 por organizador y por evento. Se aplica al calcular el precio en la pasarela de pago y se muestra desglosado en el checkout.
- **Referencia:** `src/server/routers/mercado-pago.ts`, `src/components/event/create/inviteCondition/OrganizerTableWithAction.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-03 — Operar un evento en modo INVITACIÓN (cerrado)
- **Actor:** Admin.
- **Historia:** Como productor quiero un evento privado donde sólo entra quien recibió una invitación nominal de un RRPP.
- **Reglas:** No hay venta pública ni publicación; el evento **exige un código válido en la URL** para poder acceder. El evento debe tener **exactamente un tipo de ticket** (además del de organizador) para que el canje funcione. La capacidad total es la suma de invitaciones asignadas.
- **Excepciones:** Sin código → error "código requerido"; código inexistente → "código inválido"; código ya usado → "código ya utilizado"; más de un tipo de ticket → "error en la configuración del evento".
- **Referencia:** `src/app/(client)/event/[slug]/page.tsx`, `src/app/api/event/[slug]/invite/route.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-04 — Asignar cupo de invitaciones por organizador
- **Actor:** Admin, Jefe de organizadores.
- **Historia:** Como productor quiero darle 20 invitaciones a un RRPP y 50 a otro.
- **Reglas:** Cantidad ≥ 0 por organizador. Al asignarla, el sistema **crea físicamente esa cantidad de códigos** de invitación. Se puede aplicar la misma cantidad a todos de una vez.
- **Referencia:** `src/server/routers/events.ts` (`events.create`, `events.update`), `src/server/utils/ticketXOrganizerInvite.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-05 — Generar códigos de invitación individuales
- **Actor:** Sistema.
- **Historia:** Como productor quiero que cada invitación sea un código único e irrepetible, para controlar quién la usó.
- **Reglas:** Código de 6 dígitos hexadecimales, único por evento, más un número corto correlativo por evento (para nombrarlo humanamente: "invitación #34"). Un código se considera consumido cuando queda asociado a un ticket emitido.
- **Referencia:** `prisma/schema.prisma` (`TicketXOrganizer`), `src/server/utils/ticketXOrganizerInvite.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-06 — Canjear un código de invitación
- **Actor:** Público / invitado.
- **Historia:** Como invitado quiero entrar al link que me pasaron y cargar mis datos para recibir mi entrada.
- **Flujo:** 1) Abre `…/event/<slug>?invite=<código>`. 2) El sistema valida el código. 3) Crea automáticamente una orden con 1 entrada del único tipo disponible. 4) Vincula el código a la orden. 5) Deja la orden en la cookie de carrito y redirige al checkout. 6) Al completar los datos se emite el ticket y el código queda consumido.
- **Excepciones:** Código inválido, código ya usado, evento inexistente, configuración inválida.
- **Referencia:** `src/app/api/event/[slug]/invite/route.ts`, `src/server/routers/events.ts` (`events.validateInvitationCode`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-07 — Operar un evento en modo SIMPLE ("invita" libre)
- **Actor:** Admin.
- **Historia:** Como organizador de fiestas quiero saber quién trajo a cada persona **sin tener que dar de alta a mis RRPP como usuarios** del sistema.
- **Reglas:** Funciona como el modo tradicional (venta/registro abierto, publicación, emisión manual, QR del evento) pero el "invita" es un texto libre que escribe el propio comprador. Se muestra como columna en tablas y exportaciones.
- **Referencia:** `prisma/schema.prisma` (`InviteCondition.SIMPLE`), `ticketGroup.invitedBySimple`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-08 — Repartir cupos "robando" tickets a otros organizadores
- **Actor:** Admin.
- **Historia:** Como productor quiero sumar un RRPP nuevo a un evento ya armado y que el sistema le saque cupo a los demás en vez de aumentar la capacidad total.
- **Reglas:** Al agregar organizadores en modo invitación se puede optar por mantener la capacidad total fija, redistribuyendo los cupos no usados de los demás.
- **Referencia:** `src/lib/event-organizers.ts` (`applyAddInvitationOrganizersStealingTickets`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-MOD-09 — Ver la distribución de invitaciones entregadas
- **Actor:** Admin, Jefe.
- **Historia:** Como productor quiero ver cuántas invitaciones repartió y cuántas usó cada RRPP.
- **Referencia:** `src/server/routers/events.ts` (`events.getOrganizerDeliveredTicketCounts`), `src/components/event/individual/OrganizerDistribution.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 12. Módulo ORG — Organizadores / RRPP

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-ORG-01 | Asignar organizadores a un evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-02 | Enviar por mail el ticket de organizador al asignarlo | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-03 | Ver mis eventos como organizador | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-04 | Consultar mi código personal de organizador | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-05 | Copiar mi link de venta personalizado | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-06 | Imprimir/descargar mi QR personalizado del evento | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-07 | Ver mis ventas del evento | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-08 | Ver mis códigos de invitación no usados | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-09 | Compartir un código de invitación individual | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-10 | Ver mi base de compradores | Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-11 | Validar un código de organizador en el checkout | Público | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-12 | Atribuir automáticamente la venta al organizador del link | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ORG-13 | Reasignar manualmente el organizador de un ticket | Admin, Boletería | ☐ | ☐ | ☐ | ☐ |

#### CU-ORG-01 — Asignar organizadores a un evento
- **Actor:** Admin.
- **Historia:** Como productor quiero elegir qué RRPP trabajan esta fecha y con qué condiciones.
- **Flujo:** En el paso 2 del asistente selecciona el modo de invitación y luego busca y agrega organizadores, cargando el porcentaje de descuento (tradicional) o la cantidad de invitaciones (invitación).
- **Reglas:** Se pueden agregar de a uno o en bloque, y aplicar la misma cantidad/porcentaje a todos. En modo invitación el evento **debe** tener al menos un organizador.
- **Referencia:** `src/components/event/create/inviteCondition/EventOrganizers.tsx`, `src/hooks/organizers/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-02 — Enviar por mail el ticket de organizador al asignarlo
- **Actor:** Admin.
- **Historia:** Como productor quiero que a cada RRPP le llegue su propia entrada apenas lo sumo al evento.
- **Reglas:** Es un check opcional en el asistente. Genera el PDF y lo manda al mail del organizador.
- **Referencia:** `src/components/event/create/inviteCondition/SendOrganizerTicketEmailOption.tsx`, `src/server/routers/events.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-03 — Ver mis eventos como organizador
- **Actor:** Organizador.
- **Historia:** Como RRPP quiero ver los eventos donde estoy trabajando, separados entre próximos y pasados.
- **Reglas:** Sólo eventos donde está asignado y que no estén eliminados.
- **Referencia:** `src/server/routers/organizer.ts` (`organizer.getMyEvents`), `src/app/(backoffice)/organization/page.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-04 — Consultar mi código personal de organizador
- **Actor:** Organizador.
- **Historia:** Como RRPP quiero mi código para dárselo a la gente y que mis ventas queden atribuidas a mí.
- **Reglas:** Código de 6 caracteres, único por usuario, generado automáticamente al crearse la cuenta. Es el mismo para todos los eventos.
- **Referencia:** `src/server/routers/organizer.ts` (`organizer.getMyCode`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-05 — Copiar mi link de venta personalizado
- **Actor:** Organizador.
- **Historia:** Como RRPP quiero copiar un link con mi código ya cargado para mandarlo por WhatsApp e Instagram.
- **Reglas:** El link incluye el código del organizador y, si tiene tipos de ticket asignados, también el filtro de esos tipos. Sólo se muestra en eventos de modo tradicional.
- **Referencia:** `src/app/(backoffice)/organization/event/[slug]/page.tsx`, `src/components/organization/event/CopyUrl.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-06 — Imprimir/descargar mi QR personalizado del evento
- **Actor:** Organizador.
- **Historia:** Como RRPP quiero un QR con mi link para pegarlo en un flyer o mostrarlo en la puerta.
- **Reglas:** Genera un PDF con el QR y el nombre del evento.
- **Referencia:** `src/lib/event-qr-pdf.ts`, `src/components/event/individual/PrintEventQr.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-07 — Ver mis ventas del evento
- **Actor:** Organizador.
- **Historia:** Como RRPP quiero ver la lista de la gente que compró con mi código y si ya entró.
- **Reglas:** El organizador ve **solamente** los tickets de las órdenes que él invitó. La tabla excluye el tipo de ticket "Organizador".
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.getByEventId`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-08 — Ver mis códigos de invitación no usados
- **Actor:** Organizador.
- **Historia:** Como RRPP de un evento cerrado quiero ver cuántas invitaciones me quedan por repartir.
- **Reglas:** Lista sólo los códigos sin ticket asociado, ordenados por su número corto.
- **Referencia:** `src/server/routers/organizer.ts` (`organizer.getMyCodesNotUsed`), `src/components/organization/event/InvitationTicketTable.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-09 — Compartir un código de invitación individual
- **Actor:** Organizador.
- **Historia:** Como RRPP quiero copiar el link de una invitación puntual y mandárselo a una persona.
- **Reglas:** El link es `…/event/<slug>?invite=<código>`.
- **Referencia:** `src/components/organization/event/InvitationTicketTable.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-10 — Ver mi base de compradores
- **Actor:** Organizador.
- **Historia:** Como RRPP quiero mi propia base de contactos con la gente que compró conmigo.
- **Reglas:** Devuelve un registro único por DNI, sólo de las órdenes que el organizador invitó, con edad calculada y código de comprador.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.getAllUniqueBuyerByOrganizer`), `src/app/(backoffice)/organization/database/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-11 — Validar un código de organizador en el checkout
- **Actor:** Público.
- **Historia:** Como comprador quiero poner el código que me pasó el RRPP y que se aplique su beneficio.
- **Flujo:** Ingresa 6 caracteres en un campo tipo OTP → validación automática con debounce → si es válido muestra el nombre del organizador y aplica el descuento.
- **Reglas:** El código vale si el organizador está asignado al evento (con su descuento) o si está asignado a alguno de los tipos de ticket que se están comprando (sin descuento).
- **Excepciones:** Código inexistente o no asociado → mensaje de error, sin bloquear la compra.
- **Referencia:** `src/server/routers/events.ts` (`events.validateOrganizerCode`), `src/components/checkout/OrganizerCodeOTP.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-12 — Atribuir automáticamente la venta al organizador del link
- **Actor:** Sistema.
- **Historia:** Como RRPP quiero que si la persona entra por mi link, la venta quede a mi nombre sin que tenga que tipear nada.
- **Reglas:** El código viene por query param, se precarga en el checkout y se persiste en la orden.
- **Referencia:** `src/server/utils/constants.ts` (`ORGANIZER_CODE_QUERY_PARAM`), `src/app/(client)/checkout/client.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ORG-13 — Reasignar manualmente el organizador de un ticket
- **Actor:** Admin, Boletería.
- **Historia:** Como productor quiero corregir a quién se le atribuye una venta cuando la persona se olvidó de poner el código.
- **Flujo:** Desde el menú de acciones de la fila del ticket, elige el organizador de una lista buscable y confirma.
- **Referencia:** `src/components/event/individual/ticketsTable/columns.tsx`, `src/server/routers/ticket-group.ts` (`ticketGroup.updateInvitedBy`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 13. Módulo JEF — Jefe de organizadores

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-JEF-01 | Ver y administrar mi equipo de organizadores | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-02 | Distribuir mi pozo de invitaciones entre mi equipo | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-03 | Recuperar invitaciones no usadas de un organizador | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-04 | Sumar un organizador propio a un evento en curso | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-05 | Quitar un organizador propio de un evento | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-06 | Ver las ventas consolidadas de mi equipo en un evento | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-07 | Filtrar las ventas del evento por organizador de mi equipo | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-08 | Ver métricas de rendimiento de un organizador | Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-JEF-09 | Ver el detalle de un organizador de mi equipo | Jefe | ☐ | ☐ | ☐ | ☐ |

#### CU-JEF-01 — Ver y administrar mi equipo de organizadores
- **Actor:** Jefe de organizadores.
- **Historia:** Como jefe de RRPP quiero ver a toda mi gente, darla de alta, importarla y agruparla.
- **Reglas:** Ve únicamente los usuarios cuyo `chiefOrganizerId` es él.
- **Referencia:** `src/app/(backoffice)/organization/organizers/`, `src/server/routers/user.ts` (`user.getOrganizersByChiefOrganizer`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-02 — Distribuir mi pozo de invitaciones entre mi equipo
- **Actor:** Jefe.
- **Historia:** Como jefe de RRPP quiero repartir entre mis chicos las 200 invitaciones que me dio la producción, sin depender del admin.
- **Flujo:** Abre la distribución desde el evento → asigna cantidades por organizador → guarda.
- **Reglas:** El total asignado **no puede superar** el pozo disponible del jefe. Al asignar, los códigos se transfieren desde el pozo del jefe al organizador; al reducir, vuelven al jefe. Sólo se mueven códigos **no usados**. Toda la operación es transaccional.
- **Excepciones:** Exceso sobre el pozo → error; sólo un CHIEF_ORGANIZER puede ejecutarla.
- **Referencia:** `src/server/routers/events.ts` (`events.updateChiefOrganizerTicketDistribution`), `src/server/utils/chief-organizer-invitation-distribution.ts`, `src/lib/chief-organizer-event.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-03 — Recuperar invitaciones no usadas de un organizador
- **Actor:** Jefe.
- **Historia:** Como jefe quiero sacarle invitaciones a alguien que no las está usando y dárselas a otro.
- **Reglas:** Se transfieren al pozo del jefe ajustando los contadores de las órdenes involucradas. Las ya canjeadas quedan donde están.
- **Referencia:** `src/server/utils/chief-organizer-invitation-distribution.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-04 — Sumar un organizador propio a un evento en curso
- **Actor:** Jefe.
- **Historia:** Como jefe quiero sumar un RRPP nuevo a la fecha y darle cupo de mi pozo.
- **Reglas:** Al agregarlo se crea también su ticket personal de organizador. El cupo sale del pozo del jefe.
- **Referencia:** `src/server/utils/chief-organizer-invitation-distribution.ts` (`addChiefOrganizerToEvent`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-05 — Quitar un organizador propio de un evento
- **Actor:** Jefe.
- **Reglas:** Devuelve sus códigos no usados al pozo del jefe y elimina su ticket de organizador.
- **Referencia:** `src/server/utils/chief-organizer-invitation-distribution.ts` (`deleteChiefOrganizersFromEvent`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-06 — Ver las ventas consolidadas de mi equipo en un evento
- **Actor:** Jefe.
- **Historia:** Como jefe quiero ver todo lo que vendió mi equipo en esta fecha, en una sola tabla.
- **Reglas:** Incluye las órdenes invitadas por él y por cualquiera de sus organizadores, más los tickets de organizador de su gente.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.getByEventId`), `src/components/organization/event/ChiefOrganizerEventView.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-07 — Filtrar las ventas del evento por organizador de mi equipo
- **Actor:** Jefe.
- **Historia:** Como jefe quiero clickear una tarjeta de un RRPP y ver sólo sus ventas.
- **Referencia:** `src/components/organization/event/OrganizerCards.tsx`, `src/lib/organizer-cards.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-08 — Ver métricas de rendimiento de un organizador
- **Actor:** Jefe.
- **Historia:** Como jefe quiero saber cuánto vendió, cuánta gente le entró efectivamente y cuánta plata generó cada RRPP en un período.
- **Reglas:** Combina las dos mecánicas: tickets vendidos por invitaciones canjeadas (modo invitación) y tickets de órdenes atribuidas (modo tradicional). Devuelve tickets vendidos, porcentaje de asistencia y total generado. Si el consultado es a su vez un jefe, agrega los números de su equipo.
- **Referencia:** `src/server/routers/organizer.ts` (`organizer.getStatsById`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-JEF-09 — Ver el detalle de un organizador de mi equipo
- **Actor:** Jefe.
- **Historia:** Como jefe quiero abrir la ficha del RRPP con sus datos, sus links de cobro y su historial.
- **Referencia:** `src/app/(backoffice)/organization/organizers/[id]/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 14. Módulo VTA — Venta pública (experiencia del comprador)

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-VTA-01 | Ver la cartelera de eventos de la instancia | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-02 | Buscar un evento por nombre | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-03 | Filtrar eventos por rango de fecha | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-04 | Filtrar eventos por categoría | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-05 | Ver la ficha de un evento | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-06 | Ver el video del evento | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-07 | Ver ubicación y cómo llegar | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-08 | Seleccionar tipos y cantidad de entradas | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-09 | Ver disponibilidad y aviso de últimos lugares | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-10 | Reservar el carrito con expiración | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-11 | Completar los datos de los asistentes | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-12 | Reutilizar los datos de mi compra anterior | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-13 | Aplicar código de organizador y ver el descuento | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-14 | Declarar quién me invitó (texto libre) | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-15 | Responder el formulario del evento | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-16 | Ver el detalle de precios antes de pagar | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-17 | Pagar con MercadoPago 🔌 | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-18 | Obtener entradas gratuitas sin pasar por pago | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-19 | Ver y descargar mis entradas | Público | ☐ | ☐ | ☐ | ☐ |
| CU-VTA-20 | Retomar o reintentar un pago pendiente | Público | ☐ | ☐ | ☐ | ☐ |

#### CU-VTA-01 — Ver la cartelera de eventos de la instancia
- **Actor:** Público.
- **Historia:** Como interesado quiero ver qué fiestas hay próximamente para elegir a cuál ir.
- **Reglas:** Sólo eventos publicados, no eliminados y con fecha de fin futura, ordenados por fecha de inicio ascendente.
- **Referencia:** `src/app/(client)/page.tsx`, `src/server/routers/events.ts` (`events.getActive`), `src/components/events/buyPage/GridEvents.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-02 — Buscar un evento por nombre
- **Actor:** Público.
- **Referencia:** `src/components/events/buyPage/EventFilter.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-03 — Filtrar eventos por rango de fecha
- **Actor:** Público.
- **Reglas:** Presets "Esta semana" y "Este mes".
- **Referencia:** `src/components/events/buyPage/EventFilter.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-04 — Filtrar eventos por categoría
- **Actor:** Público.
- **Reglas:** Navbar con las categorías activas, en el orden definido por el admin.
- **Referencia:** `src/components/events/buyPage/CategoryFilter.tsx`, `eventCategories.getActive`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-05 — Ver la ficha de un evento
- **Actor:** Público.
- **Historia:** Como interesado quiero ver toda la info de la fiesta: flyer, fecha, horario, lugar, descripción y precios.
- **Reglas:** URL amigable `…/event/<slug>`. Muestra sólo los tipos de ticket vigentes y visibles (ver CU-TKT-05 y CU-TKT-09).
- **Referencia:** `src/app/(client)/event/[slug]/`, `src/components/event/buyPage/InformationEvent.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-06 — Ver el video del evento
- **Actor:** Público.
- **Referencia:** `src/components/event/buyPage/EventVideoEmbed.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-07 — Ver ubicación y cómo llegar
- **Actor:** Público.
- **Reglas:** Muestra nombre y dirección del salón y enlaza al Google Maps cargado en la locación.
- **Referencia:** `src/components/event/buyPage/InformationEvent.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-08 — Seleccionar tipos y cantidad de entradas
- **Actor:** Público.
- **Historia:** Como comprador quiero elegir cuántas entradas de cada tipo llevo.
- **Reglas:** Un selector por tipo, limitado por el máximo por compra y el remanente. No se puede avanzar con cantidad total 0.
- **Referencia:** `src/components/event/buyPage/TicketPurchase.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-09 — Ver disponibilidad y aviso de últimos lugares
- **Actor:** Público.
- **Reglas:** Tipos agotados aparecen deshabilitados con "¡Agotados!"; por debajo del umbral configurado se muestra "¡Quedan N tickets!".
- **Referencia:** `src/hooks/useEventTickets.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-10 — Reservar el carrito con expiración
- **Actor:** Sistema.
- **Historia:** Como productor quiero que las entradas que alguien dejó a medio comprar vuelvan a estar disponibles.
- **Reglas:** Al seleccionar entradas se crea una orden en estado `BOOKED` y se guarda su id en una cookie (`carrito`). Las órdenes `BOOKED` con más de **10 minutos** se eliminan automáticamente cada vez que alguien consulta la ficha de ese evento, liberando el cupo.
- **Referencia:** `src/server/routers/ticket-group.ts` (`ticketGroup.create`), `src/server/routers/events.ts` (`events.getBySlug`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-11 — Completar los datos de los asistentes
- **Actor:** Público.
- **Historia:** Como comprador quiero cargar los datos de quienes van a entrar.
- **Reglas:** Según el flag del evento, un formulario por entrada o uno solo para todas (ver CU-EVT-08). Campos: nombre completo, DNI/pasaporte, email, fecha de nacimiento, teléfono (con selector de país), género e Instagram. Validaciones: nombre mínimo 2 caracteres, DNI mínimo 4 y sin puntos ni comas, email válido, fecha de nacimiento anterior a hoy, teléfono válido internacional. Los errores se muestran campo por campo.
- **Referencia:** `src/app/(client)/checkout/client.tsx`, `src/server/schemas/emitted-tickets.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-12 — Reutilizar los datos de mi compra anterior
- **Actor:** Público.
- **Historia:** Como comprador recurrente no quiero volver a tipear mis datos en cada fiesta.
- **Reglas:** Los datos del primer ticket de la última compra se guardan en una cookie por un año y se precargan en el próximo checkout.
- **Referencia:** `src/app/(client)/checkout/action.ts` (cookie `lastPurchase`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-13 — Aplicar código de organizador y ver el descuento
- **Actor:** Público.
- **Ver:** CU-ORG-11.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-14 — Declarar quién me invitó (texto libre)
- **Actor:** Público.
- **Historia:** Como invitado quiero poner el nombre de quien me invitó aunque no tenga un código.
- **Reglas:** Sólo si el evento tiene habilitado el campo (ver CU-EVT-12).
- **Referencia:** `src/app/(client)/checkout/action.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-15 — Responder el formulario del evento
- **Actor:** Público.
- **Reglas:** Todas las preguntas configuradas son obligatorias; si falta alguna la compra no avanza y se marca el campo.
- **Referencia:** `src/app/(client)/checkout/action.ts`, `ticketGroup.saveAnswers`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-16 — Ver el detalle de precios antes de pagar
- **Actor:** Público.
- **Reglas:** Muestra subtotal por tipo, descuento por código de organizador y cargo por servicio, y el total final.
- **Referencia:** `src/components/checkout/TicketGroupTable.tsx`, `src/lib/utils.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-17 — Pagar con MercadoPago 🔌
- **Actor:** Público.
- **Flujo:** 1) Confirma la compra. 2) El sistema calcula el total con descuento y cargo por servicio, lo guarda en la orden y crea una preferencia de pago. 3) Redirige a MercadoPago. 4) Al aprobarse, MercadoPago notifica por webhook. 5) El sistema marca la orden como pagada, genera los PDF y los envía por mail.
- **Reglas:** El webhook valida la **firma HMAC** de MercadoPago con comparación segura contra timing attacks; las notificaciones no firmadas se rechazan.
- **Excepciones:** URLs de retorno diferenciadas para éxito, pendiente y error.
- **Referencia:** `src/server/routers/mercado-pago.ts`, `src/app/api/mercadopago/route.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-18 — Obtener entradas gratuitas sin pasar por pago
- **Actor:** Público.
- **Reglas:** Si el total es 0 la orden pasa directo a estado `FREE`, se emiten los tickets y se mandan los mails sin tocar la pasarela.
- **Referencia:** `src/app/(client)/checkout/action.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-19 — Ver y descargar mis entradas
- **Actor:** Público.
- **Historia:** Como comprador quiero descargar mis entradas desde el navegador aunque no me haya llegado el mail.
- **Reglas:** Página `…/tickets/<id de la orden>` con la lista de tickets emitidos y descarga individual del PDF. Sólo funciona si la orden está pagada o es gratuita; si sigue reservada devuelve error.
- **Referencia:** `src/app/(client)/tickets/[slug]/`, `ticketGroup.getTicketsForDownloadPage`, `ticketGroup.getPdfByEmittedTicketId`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-VTA-20 — Retomar o reintentar un pago pendiente
- **Actor:** Público.
- **Reglas:** La URL de pago pendiente queda en una cookie; la página de tickets muestra el estado pendiente y permite volver a la pasarela. Existe una pantalla de error de pago dedicada.
- **Referencia:** `src/app/(client)/tickets/[slug]/pending.tsx`, `src/app/(client)/tickets/error/page.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 15. Módulo EMI — Emisión y entrega de tickets

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-EMI-01 | Emitir tickets al confirmarse una compra | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-02 | Generar el PDF del ticket con QR cifrado | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-03 | Enviar el ticket por mail al comprador 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-04 | Enviar un único mail con todos los tickets de la compra 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-05 | Emitir un ticket manualmente desde boletería | Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-06 | Registrar un ticket como pagado en puerta | Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-07 | Acreditar automáticamente el ticket emitido en boletería | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-08 | Reenviar un ticket por mail 🔌 | Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-09 | Descargar el PDF de un ticket desde el backoffice | Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EMI-10 | Eliminar un ticket emitido | Admin | ☐ | ☐ | ☐ | ☐ |

#### CU-EMI-01 — Emitir tickets al confirmarse una compra
- **Actor:** Sistema.
- **Reglas:** Se crea un `EmittedTicket` por entrada, con los datos de su titular y un **slug legible** derivado del nombre del tipo más un correlativo (ej. `general-27`). En modo invitación, además, el código de invitación queda vinculado al primer ticket creado, marcándolo como consumido.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.createMany`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-02 — Generar el PDF del ticket con QR cifrado
- **Actor:** Sistema.
- **Historia:** Como productor quiero que cada entrada tenga un QR único e infalsificable.
- **Reglas:** El PDF incluye nombre del evento, fecha/hora de inicio del **tipo de ticket**, dirección, nombre y DNI del titular, tipo de entrada, quién lo invitó, fecha de emisión y el QR. El contenido del QR es el id del ticket **cifrado con una clave secreta de la instancia** (`BARCODE_SECRET`), de modo que no se puede generar un QR válido desde afuera. Opcionalmente muestra el código legible del ticket.
- **Referencia:** `src/server/utils/ticket-template.ts`, `src/server/utils/utils.ts` (cifrado/descifrado).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-03 — Enviar el ticket por mail al comprador 🔌
- **Actor:** Sistema.
- **Reglas:** Un mail por ticket, al mail de cada titular, con el PDF adjunto, desde `ticket@<dominio de la instancia>` y con el nombre de la instancia como remitente. Se envían **secuencialmente** para no chocar con los límites de tasa del proveedor.
- **Referencia:** `src/server/services/mail.ts` (Resend).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-04 — Enviar un único mail con todos los tickets de la compra 🔌
- **Actor:** Sistema.
- **Reglas:** Cuando el evento no pide datos por asistente, se manda un solo mail al comprador con todos los PDF adjuntos.
- **Referencia:** `src/app/(client)/checkout/action.ts`, `src/app/api/mercadopago/route.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-05 — Emitir un ticket manualmente desde boletería
- **Actor:** Boletería, Admin.
- **Historia:** Como boletero quiero cargar a mano la entrada de alguien que llegó a la puerta sin comprar online.
- **Flujo:** Desde el panel del evento → "Emitir ticket" → elige tipo de ticket, carga los datos de la persona, marca si pagó en puerta → confirma. El sistema crea la orden y el ticket, genera el PDF y lo envía por mail.
- **Reglas:** Disponible sólo en modos TRADITIONAL y SIMPLE. El estado de la orden queda `FREE` si el tipo es gratuito, `PAID` si se marcó pago en puerta, o `BOOKED` en caso contrario.
- **Referencia:** `src/components/event/individual/EmitTicketModal.tsx`, `src/server/routers/emitted-tickets.ts` (`emittedTickets.create`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-06 — Registrar un ticket como pagado en puerta
- **Actor:** Boletería, Admin.
- **Historia:** Como boletero quiero dejar registrado que esa entrada se cobró en efectivo en la puerta.
- **Reglas:** Es un check dentro de la emisión manual; se deshabilita automáticamente si el tipo es gratuito.
- **Referencia:** `src/components/event/individual/EmitTicketModal.tsx` (`paidOnLocation`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-07 — Acreditar automáticamente el ticket emitido en boletería
- **Actor:** Sistema.
- **Historia:** Como boletero, si la persona ya está entrando, no quiero tener que escanearle el ticket que le acabo de emitir.
- **Reglas:** La emisión manual registra el escaneo en la misma transacción: el ticket queda marcado como ingresado, con hora y con el usuario que lo emitió.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`registerTicketScanInTx`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-08 — Reenviar un ticket por mail 🔌
- **Actor:** Boletería, Admin.
- **Historia:** Como boletero quiero reenviarle la entrada a alguien que dice que no le llegó.
- **Flujo:** Menú de acciones de la fila del ticket → Enviar → confirmación por notificación.
- **Excepciones:** Falla del proveedor de mail → error explícito.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.send`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-09 — Descargar el PDF de un ticket desde el backoffice
- **Actor:** Boletería, Admin.
- **Historia:** Como boletero quiero bajar el PDF y mostrárselo o mandárselo por WhatsApp.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.getPdf`), `src/app/(backoffice)/admin/event/[slug]/actions.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EMI-10 — Eliminar un ticket emitido
- **Actor:** Admin.
- **Historia:** Como productor quiero borrar una entrada emitida por error.
- **Reglas:** Borrado físico, con modal de confirmación. Sólo ADMIN.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.delete`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 16. Módulo ACR — Acreditación y control de acceso

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-ACR-01 | Elegir los eventos a escanear | Control, Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-02 | Escanear un QR con la cámara del celular | Control, Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-03 | Escanear tickets de varios eventos a la vez | Control, Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-04 | Validar que el ticket pertenezca al evento | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-05 | Rechazar un ticket ya escaneado | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-06 | Avisar que el ticket todavía no está vigente | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-07 | Avisar que el ticket está fuera del horario permitido | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-08 | Mostrar quién invitó a la persona al escanear | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-09 | Ver el resultado del último escaneo | Control, Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-10 | Ver el historial de los últimos escaneos | Control, Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-11 | Acreditar manualmente desde la lista | Boletería, Admin | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-12 | Registrar auditoría de cada escaneo | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-ACR-13 | Generar listado de presentismo en PDF | Boletería, Admin | ☐ | ☐ | ☐ | ☐ |

#### CU-ACR-01 — Elegir los eventos a escanear
- **Actor:** Control de acceso, Boletería, Admin.
- **Historia:** Como personal de puerta quiero seleccionar qué evento(s) estoy controlando antes de empezar.
- **Reglas:** Por defecto muestra sólo los eventos de las próximas 24 hs (con opción de ver todos). Los usuarios de boletería/control ven **sólo los eventos donde fueron autorizados**. Sólo eventos desde ayer en adelante.
- **Referencia:** `src/app/(backoffice)/admin/ticketing/page.tsx`, `events.getAllForTicketing`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-02 — Escanear un QR con la cámara del celular
- **Actor:** Control, Boletería, Admin.
- **Historia:** Como personal de puerta quiero escanear las entradas con mi celular, sin hardware adicional.
- **Reglas:** Lector de QR en el navegador. Cada lectura dispara la validación contra el servidor. Existe además un acceso directo al escáner desde el panel del evento.
- **Referencia:** `src/components/event/individual/scan/QRCodeScanner.tsx`, `src/app/(backoffice)/admin/event/[slug]/scan/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-03 — Escanear tickets de varios eventos a la vez
- **Actor:** Control, Boletería, Admin.
- **Historia:** Como personal de puerta de un lugar con dos fiestas la misma noche quiero un único escáner que acepte las entradas de ambas.
- **Reglas:** Los ids de evento seleccionados viajan en la URL del escáner y el ticket se busca dentro de ese conjunto.
- **Referencia:** `src/app/(backoffice)/admin/ticketing/scan/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-04 — Validar que el ticket pertenezca al evento
- **Actor:** Sistema.
- **Reglas:** Se descifra el contenido del QR; si no descifra o el ticket no pertenece a los eventos seleccionados, devuelve "Ticket no encontrado / no pertenece a este evento".
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.scan`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-05 — Rechazar un ticket ya escaneado
- **Actor:** Sistema.
- **Historia:** Como productor quiero que una entrada no se pueda usar dos veces.
- **Reglas:** Si el ticket ya fue escaneado y su tipo **no** permite escaneos múltiples, se rechaza informando la hora del escaneo anterior.
- **Referencia:** `src/server/utils/register-ticket-scan.ts` (`canRegisterScan`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-06 — Avisar que el ticket todavía no está vigente
- **Actor:** Sistema.
- **Reglas:** Si la hora de inicio del tipo de ticket es futura, el escaneo se acepta pero se muestra el aviso con la hora en que empieza a valer.
- **Referencia:** `emittedTickets.scan`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-07 — Avisar que el ticket está fuera del horario permitido
- **Actor:** Sistema.
- **Ver:** CU-TKT-07.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-08 — Mostrar quién invitó a la persona al escanear
- **Actor:** Sistema.
- **Historia:** Como personal de puerta quiero ver de qué RRPP viene la persona que está entrando.
- **Reglas:** El resultado del escaneo incluye el nombre del organizador que invitó y, si corresponde, el número de escaneo.
- **Referencia:** `emittedTickets.scan`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-09 — Ver el resultado del último escaneo
- **Actor:** Control, Boletería, Admin.
- **Reglas:** Tarjeta grande con estado (éxito / ya escaneado / no encontrado), nombre de la persona, tipo de ticket e información extra. Códigos de color y notificaciones diferenciadas.
- **Referencia:** `src/components/event/individual/scan/LastScanCard.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-10 — Ver el historial de los últimos escaneos
- **Actor:** Control, Boletería, Admin.
- **Historia:** Como personal de puerta quiero revisar las últimas entradas que pasé por si hubo un error.
- **Reglas:** Mantiene en pantalla los últimos 20 escaneos de la sesión.
- **Referencia:** `src/components/event/individual/scan/LastScansHistory.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-11 — Acreditar manualmente desde la lista
- **Actor:** Boletería, Admin.
- **Historia:** Como boletero quiero marcar como ingresada a una persona buscándola por nombre, cuando el QR no funciona.
- **Reglas:** Desde el menú de la fila del ticket. Aplica las mismas reglas de escaneo múltiple.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.manualScan`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-12 — Registrar auditoría de cada escaneo
- **Actor:** Sistema.
- **Historia:** Como productor quiero saber quién acreditó a cada persona y a qué hora exacta.
- **Reglas:** Cada escaneo genera un registro con fecha/hora y usuario; el ticket guarda además el último escaneo. Habilita ver el detalle de todos los ingresos de un ticket con escaneo múltiple.
- **Referencia:** `prisma/schema.prisma` (`EmittedTicketScan`), `src/components/event/individual/ticketsTable/TicketEntryTimeCell.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-ACR-13 — Generar listado de presentismo en PDF
- **Actor:** Boletería, Admin.
- **Historia:** Como productor quiero imprimir la lista de invitados para tenerla en papel en la puerta, por si se cae internet.
- **Reglas:** Dos formatos: **ordenado alfabéticamente** o **agrupado por tipo de ticket**. Cada listado incluye QR al panel del evento, dirección, nombre, fecha, contador de "vendidas sobre total" y, por persona: nombre, tipo, teléfono, DNI, quién invitó y casillero de ingreso.
- **Referencia:** `src/server/routers/events.ts` (`events.generatePresentismoOrderNamePDF`, `events.generatePresentismoGroupedTicketTypePDF`), `src/server/utils/presentismo-pdf.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 17. Módulo OPE — Operación del evento (listados y exportaciones)

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-OPE-01 | Ver la lista de ventas por tipo de ticket | Admin, Boletería, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-02 | Buscar una persona en la lista de ventas | Admin, Boletería, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-03 | Ordenar y redimensionar columnas | Admin, Boletería, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-04 | Ver el detalle de columnas del ticket | Admin, Boletería, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-05 | Ver la hora de ingreso y los reingresos | Admin, Boletería | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-06 | Exportar la tabla visible con validación de contraseña | Admin, Boletería | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-07 | Exportar el evento completo a Excel por tipo de ticket | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-08 | Ver las respuestas del formulario del evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-09 | Saltar del ticket a su formulario respondido | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-10 | Ver el QR público del evento para imprimir | Admin, Boletería | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-11 | Ver la vista consolidada de un evento por invitación | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-OPE-12 | Paginar y navegar listados largos | Todos | ☐ | ☐ | ☐ | ☐ |

#### CU-OPE-01 — Ver la lista de ventas por tipo de ticket
- **Actor:** Admin, Boletería, Organizador.
- **Historia:** Como productor quiero ver quiénes compraron, separados por tipo de entrada.
- **Reglas:** Una solapa por tipo de ticket, respetando el orden configurado, con el tipo "Organizador" siempre al final. El alcance de lo que se ve depende del rol (todo / equipo / propio).
- **Referencia:** `src/components/event/individual/TicketTableWithTabs.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-02 — Buscar una persona en la lista de ventas
- **Actor:** Admin, Boletería, Organizador.
- **Historia:** Como boletero quiero encontrar rápido a alguien por nombre o DNI cuando está en la puerta.
- **Reglas:** Busca simultáneamente en nombre, DNI, mail, teléfono y organizador que invitó. **Ignora acentos y mayúsculas**. El foco va al buscador automáticamente en escritorio.
- **Referencia:** `src/components/event/individual/SearchTickets.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-03 — Ordenar y redimensionar columnas
- **Actor:** Admin, Boletería, Organizador.
- **Reglas:** Orden ascendente/descendente/sin orden por columna; ancho ajustable; tabla virtualizada para soportar miles de filas.
- **Referencia:** `src/components/common/DataTable.tsx`, `src/components/common/table/SortableColumnHeader.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-04 — Ver el detalle de columnas del ticket
- **Actor:** Admin, Boletería, Organizador.
- **Reglas:** Columnas disponibles: ID de comprador, Ingresó, Hora de ingreso, Nombre, Fecha de nacimiento, DNI, Teléfono, Correo, Instagram, Invita (texto libre), Organizador, Jefe del organizador, Fecha de emisión, Formulario y Acciones. Algunas se muestran sólo según el rol y el modo del evento.
- **Referencia:** `src/components/event/individual/ticketsTable/columns.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-05 — Ver la hora de ingreso y los reingresos
- **Actor:** Admin, Boletería.
- **Reglas:** Muestra la hora del último ingreso; si el ticket permite escaneos múltiples, permite ver el detalle de todos los ingresos con su hora y quién los registró.
- **Referencia:** `src/components/event/individual/ticketsTable/TicketEntryTimeCell.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-06 — Exportar la tabla visible con validación de contraseña
- **Actor:** Admin, Boletería.
- **Historia:** Como productor quiero bajarme la lista tal como la estoy viendo (filtrada y ordenada).
- **Reglas:** ⚠️ **Antes de exportar, el sistema pide la contraseña del usuario logueado y la valida.** Es un control de seguridad sobre datos personales.
- **Referencia:** `src/app/actions/DataTable.ts` (`validatePassword`), `src/components/common/DataTable.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-07 — Exportar el evento completo a Excel por tipo de ticket
- **Actor:** Admin.
- **Historia:** Como productor quiero un Excel con una hoja por tipo de entrada para trabajar los datos aparte.
- **Reglas:** Genera un `.xlsx` con una hoja por tipo de ticket. Columnas: DNI/Pasaporte, Nombre, Mail, Teléfono, Instagram, Género (traducido), Fecha de Nacimiento, Fecha de Emisión, Ingresó y Invitado por.
- **Referencia:** `src/server/routers/events.ts` (`events.exportXlsxByTicketType`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-08 — Ver las respuestas del formulario del evento
- **Actor:** Admin.
- **Historia:** Como productor quiero leer lo que contestó la gente en las preguntas que puse.
- **Reglas:** Tabla dedicada al pie del panel del evento, visible sólo si el evento tiene preguntas activas o respuestas cargadas.
- **Referencia:** `src/components/event/individual/SurveyAnswersTable.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-09 — Saltar del ticket a su formulario respondido
- **Actor:** Admin.
- **Reglas:** Desde la columna "Formulario" de un ticket, el sistema filtra la tabla de respuestas por el DNI y hace scroll hasta ella.
- **Referencia:** `src/components/event/individual/ticketsTable/columns.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-10 — Ver el QR público del evento para imprimir
- **Actor:** Admin, Boletería.
- **Historia:** Como productor quiero un QR que lleve a la página de venta, para poner en la barra o en un flyer.
- **Reglas:** No se muestra en eventos de modo invitación (no hay página pública).
- **Referencia:** `src/components/event/individual/PrintEventQr.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-11 — Ver la vista consolidada de un evento por invitación
- **Actor:** Admin.
- **Historia:** Como productor de un evento cerrado quiero una vista distinta, centrada en organizadores y códigos, no en tipos de entrada.
- **Referencia:** `src/components/event/individual/AdminInvitationEventView.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-OPE-12 — Paginar y navegar listados largos
- **Actor:** Todos.
- **Referencia:** `src/components/event/individual/ticketsTable/Pagination.tsx`, `@tanstack/react-virtual`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 18. Módulo CRM — Base de datos de compradores

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-CRM-01 | Ver el padrón único de compradores | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-CRM-02 | Ver el padrón de mis propios compradores | Organizador, Jefe | ☐ | ☐ | ☐ | ☐ |
| CU-CRM-03 | Abrir la ficha de un comprador | Admin, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-CRM-04 | Ver el historial de eventos asistidos de un comprador | Admin, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-CRM-05 | Contactar a un comprador por WhatsApp, Instagram o mail | Admin, Organizador | ☐ | ☐ | ☐ | ☐ |
| CU-CRM-06 | Identificar a un comprador con un código corto | Sistema | ☐ | ☐ | ☐ | ☐ |

#### CU-CRM-01 — Ver el padrón único de compradores
- **Actor:** Admin.
- **Historia:** Como productor quiero tener la base de toda la gente que alguna vez compró una entrada mía, para comunicarme y para entender mi público.
- **Reglas:** Un registro por **DNI** (se toma el dato más reciente de esa persona). Muestra DNI, nombre, mail, género, Instagram, fecha de nacimiento, teléfono, **edad calculada** y código de comprador.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.getAllUniqueBuyer`), `src/app/(backoffice)/admin/database/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CRM-02 — Ver el padrón de mis propios compradores
- **Actor:** Organizador, Jefe.
- **Ver:** CU-ORG-10.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CRM-03 — Abrir la ficha de un comprador
- **Actor:** Admin, Organizador.
- **Historia:** Como productor quiero ver el perfil de una persona: sus datos y su relación con mis eventos.
- **Reglas:** Ruta por DNI. Normaliza el Instagram (le saca el `@`).
- **Referencia:** `src/app/(backoffice)/admin/database/[dni]/`, `src/components/database/BuyerInformation.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CRM-04 — Ver el historial de eventos asistidos de un comprador
- **Actor:** Admin, Organizador.
- **Historia:** Como productor quiero saber a cuántas de mis fiestas vino realmente esta persona.
- **Reglas:** Cuenta sólo los eventos donde el ticket **fue escaneado** (asistencia real, no compra). Muestra evento, fecha, salón y quién lo invitó.
- **Referencia:** `src/server/routers/emitted-tickets.ts` (`emittedTickets.getUniqueBuyer`), `src/components/admin/BuyerTable.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CRM-05 — Contactar a un comprador por WhatsApp, Instagram o mail
- **Actor:** Admin, Organizador.
- **Historia:** Como productor quiero escribirle directo a una persona desde su ficha.
- **Reglas:** Accesos directos a WhatsApp (con el teléfono), Instagram (con el usuario) y correo.
- **Referencia:** `src/components/database/BuyerLinks.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-CRM-06 — Identificar a un comprador con un código corto
- **Actor:** Sistema.
- **Historia:** Como boletero quiero un número corto para referirme a una persona en la puerta, en vez de leer un UUID.
- **Reglas:** Código numérico derivado del DNI, mostrado como columna "ID" en las tablas y en la ficha. En eventos por invitación, en cambio, la columna "ID" muestra el número corto del código de invitación.
- **Referencia:** `src/server/utils/db/utils.ts` (`getBuyersCodeByDni`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 19. Módulo EST — Estadísticas y reportes

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-EST-01 | Ver el tablero general de la instancia | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EST-02 | Filtrar las métricas por rango de fechas | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EST-03 | Filtrar las métricas por evento | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EST-04 | Ver tasa de asistencia, recaudación y tickets vendidos | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EST-05 | Ver la composición de asistencia por género | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EST-06 | Ver la curva de emisión de tickets por hora | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EST-07 | Comparar eventos entre sí | Admin | ☐ | ☐ | ☐ | ☐ |
| CU-EST-08 | Comparar salones entre sí | Admin | ☐ | ☐ | ☐ | ☐ |

#### CU-EST-01 — Ver el tablero general de la instancia
- **Actor:** Admin.
- **Historia:** Como productor quiero un tablero con los números de mi operación para tomar decisiones.
- **Reglas:** Reúne indicadores, gráficos y tabla comparativa. ⚠️ **La ruta existe (`/admin`) pero está comentada en la navegación lateral**, por lo que hoy no es accesible desde el menú.
- **Referencia:** `src/app/(backoffice)/admin/(dashboard)/page.tsx`, `src/components/admin/SideBar.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EST-02 — Filtrar las métricas por rango de fechas
- **Actor:** Admin.
- **Reglas:** Selector de rango con localización es-AR; por defecto el último mes.
- **Referencia:** `src/components/admin/DataRangePicker.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EST-03 — Filtrar las métricas por evento
- **Actor:** Admin.
- **Reglas:** Modo alternativo al de fechas: selecciona un evento puntual y todos los indicadores se recalculan sobre él. Por defecto propone el último evento ya ocurrido.
- **Referencia:** `src/app/(backoffice)/admin/(dashboard)/page.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EST-04 — Ver tasa de asistencia, recaudación y tickets vendidos
- **Actor:** Admin.
- **Reglas:** Tres indicadores principales: **tasa de asistencia** (escaneados sobre emitidos, con barra de progreso), **dinero recaudado** (en pesos) y **tickets vendidos**. Se excluyen las órdenes en estado reservado.
- **Referencia:** `src/server/routers/statistics.ts` (`statistics.getStatistics`), `src/server/services/eventStats.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EST-05 — Ver la composición de asistencia por género
- **Actor:** Admin.
- **Reglas:** Gráfico de torta con la distribución por género de los asistentes.
- **Referencia:** `src/components/admin/GenderPie.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EST-06 — Ver la curva de emisión de tickets por hora
- **Actor:** Admin.
- **Historia:** Como productor quiero saber a qué hora se vende más para elegir cuándo publicar o hacer promos.
- **Reglas:** Grafica la cantidad de tickets emitidos por hora, ajustando automáticamente el rango horario a las horas con actividad, con una serie por evento.
- **Referencia:** `src/server/routers/statistics.ts` (`statistics.getEmittedTicketsPerHour`), `src/components/admin/BuyPerHourChart.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EST-07 — Comparar eventos entre sí
- **Actor:** Admin.
- **Reglas:** Tabla con asistencia, recaudado, vendidos y emitidos por evento en el período.
- **Referencia:** `src/server/routers/statistics.ts` (`statistics.getEventsStats`), `src/components/admin/ComparativeTable.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-EST-08 — Comparar salones entre sí
- **Actor:** Admin.
- **Historia:** Como productor que rota de lugar quiero saber en qué salón me funciona mejor.
- **Reglas:** Mismas métricas que CU-EST-07 pero agrupadas por locación.
- **Referencia:** `src/server/routers/statistics.ts` (`statistics.getLocationsStats`).
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---

## 20. Módulo INT — Integraciones y plataforma

| ID | Caso de uso | Actor | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- |
| CU-INT-01 | Cobrar con la cuenta de MercadoPago del cliente 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-INT-02 | Recibir confirmaciones de pago por webhook firmado 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-INT-03 | Enviar correos transaccionales 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-INT-04 | Reintentar automáticamente los envíos fallidos | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-INT-05 | Almacenar imágenes en object storage 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-INT-06 | Exponer la agenda de la instancia a un portal central 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-INT-07 | Firmar y verificar la comunicación entre instancia y orquestador 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |
| CU-INT-08 | Aprovisionar una instancia nueva por cliente | Plataforma | ☐ | ☐ | ☐ | ☐ |
| CU-INT-09 | Aplicar migraciones y datos semilla | Plataforma | ☐ | ☐ | ☐ | ☐ |
| CU-INT-10 | Medir el uso del sitio público 🔌 | Sistema | ☐ | ☐ | ☐ | ☐ |

#### CU-INT-01 — Cobrar con la cuenta de MercadoPago del cliente 🔌
- **Actor:** Sistema.
- **Historia:** Como cliente quiero que la plata de las entradas caiga directamente en mi cuenta de MercadoPago.
- **Reglas:** Cada instancia usa su propio Access Token. La preferencia de pago lleva el nombre y descripción del evento, un único ítem con el total ya calculado, la orden como referencia externa y URLs de retorno de éxito/pendiente/error.
- **Referencia:** `src/server/routers/mercado-pago.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-02 — Recibir confirmaciones de pago por webhook firmado 🔌
- **Actor:** Sistema.
- **Reglas:** Verifica la firma HMAC-SHA256 del encabezado `x-signature` con comparación en tiempo constante. Ante pago aprobado: marca la orden como pagada, genera los PDF, envía los mails y dispara la notificación al productor. Rechaza requests sin firma (400) o con firma inválida (403).
- **Referencia:** `src/app/api/mercadopago/route.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-03 — Enviar correos transaccionales 🔌
- **Actor:** Sistema.
- **Reglas:** Proveedor Resend, con dominio propio por instancia. Tipos de mail: entrega de tickets (con adjunto), bienvenida con credenciales, notificación de venta al productor, y ticket de organizador.
- **Referencia:** `src/server/services/mail.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-04 — Reintentar automáticamente los envíos fallidos
- **Actor:** Sistema.
- **Reglas:** Reintentos con espera creciente (hasta 3 intentos) en las notificaciones; los mails de tickets se envían secuencialmente para no exceder los límites de tasa.
- **Referencia:** `src/server/utils/retry.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-05 — Almacenar imágenes en object storage 🔌
- **Actor:** Sistema.
- **Reglas:** Portadas de evento en S3, bajo un prefijo derivado del nombre de la instancia. Requiere sesión activa para subir; sólo tipos de imagen.
- **Referencia:** `src/app/api/upload/route.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-06 — Exponer la agenda de la instancia a un portal central 🔌
- **Actor:** Sistema.
- **Historia:** Como red de productores quiero que todas las instancias publiquen su agenda en un calendario común.
- **Reglas:** Endpoint firmado que recibe un rango de fechas y devuelve los eventos activos con nombre, slug, fechas, portada, salón y **estadísticas resumidas por evento**, más los datos de identificación de la instancia. Sólo eventos publicados y no eliminados.
- **Referencia:** `src/app/api/pluto/calendar-events/route.ts`, `src/server/services/calendarEventStats.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-07 — Firmar y verificar la comunicación entre instancia y orquestador 🔌
- **Actor:** Sistema.
- **Reglas:** Todas las llamadas entre la instancia y el orquestador (Pluto) van firmadas con HMAC más timestamp, y se verifican en ambos sentidos.
- **Referencia:** `src/server/security/signed-request.ts`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-08 — Aprovisionar una instancia nueva por cliente
- **Actor:** Plataforma.
- **Historia:** Como proveedor quiero levantar una instancia nueva para un cliente con su marca, su base y su dominio.
- **Reglas:** Modelo **una instancia = un cliente**: base de datos propia, variables de entorno propias (nombre, descripción, color, dominio, mail de contacto, claves de MercadoPago, Resend, S3 y clave de cifrado de códigos de barra). **No hay multi-tenancy dentro de la aplicación.**
- **Nota para el corte:** este punto es central. Si Light se piensa como autoservicio de bajo precio, el modelo actual de una instancia por cliente es el mayor condicionante de costo.
- **Referencia:** `.env.example`, `src/app/credentials/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-09 — Aplicar migraciones y datos semilla
- **Actor:** Plataforma.
- **Reglas:** Scripts de migración (Prisma + Drizzle) y de carga inicial (`seed`, `seed-ticket-slug`).
- **Referencia:** `package.json`, `prisma/migrations/`, `src/drizzle/`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

#### CU-INT-10 — Medir el uso del sitio público 🔌
- **Actor:** Sistema.
- **Reglas:** Analítica web integrada en el layout público.
- **Referencia:** `@vercel/analytics`, `src/app/layout.tsx`.
- **Clasificación:** Light ☐ · Pro ☐ · Ambos ☐ · Fuera de alcance ☐

---
---

# ANEXOS

Los anexos **no son casos de uso**: son matrices de apoyo para tomar la decisión del corte.

---

## Anexo A — Matriz de roles × módulos

Lectura: ✔ acceso completo · ◐ acceso parcial (sólo lo propio / lo de su equipo) · — sin acceso.

| Módulo | Público | CONTROL_TICKETING | TICKETING | ORGANIZER | CHIEF_ORGANIZER | ADMIN |
| --- | --- | --- | --- | --- | --- | --- |
| ACC Acceso | ◐ | ✔ | ✔ | ✔ | ✔ | ✔ |
| CFG Configuración | — | — | — | — | — | ✔ |
| USR Usuarios | — | — | — | ◐ (perfil propio) | ◐ (su equipo) | ✔ |
| EVT Eventos | — | ◐ (autorizados) | ◐ (autorizados) | ◐ (asignados) | ◐ (asignados) | ✔ |
| TKT Tipos de ticket | — | — | — | ◐ (link propio) | ◐ | ✔ |
| MOD Modos | — | — | — | — | ◐ (distribución) | ✔ |
| ORG Organizadores | — | — | — | ◐ (lo propio) | ◐ (su equipo) | ✔ |
| JEF Jefatura | — | — | — | — | ✔ | ✔ |
| VTA Venta pública | ✔ | — | — | — | — | — |
| EMI Emisión | — | — | ✔ | ◐* | ◐* | ✔ |
| ACR Acreditación | — | ✔ | ✔ | ◐* | ◐* | ✔ |
| OPE Operación | — | — | ✔ | ◐ (lo propio) | ◐ (su equipo) | ✔ |
| CRM Base de datos | — | — | — | ◐ (lo propio) | ◐ | ✔ |
| EST Estadísticas | — | — | — | — | ◐ (de su equipo) | ✔ |
| INT Integraciones | — | — | — | — | — | ◐ (credenciales) |

> `*` Consecuencia de la jerarquía lineal de roles: `ORGANIZER` y `CHIEF_ORGANIZER` están **por
> encima** de `TICKETING`, por lo que técnicamente pueden invocar las operaciones de boletería
> (emitir, reenviar, descargar PDF, acreditar manualmente) aunque la interfaz no se las muestre.
> Ver Anexo F, punto F-1.

---

## Anexo B — Parámetros configurables por evento

Cada fila es una decisión concreta de producto: "¿este parámetro existe en Light?". Muchos de estos
son la raíz de la complejidad percibida del producto actual.

| # | Parámetro | Entidad | Tipo | Default | CU relacionado | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-01 | Nombre | Event | texto | — | CU-EVT-02 | ☐ | ☐ | ☐ | ☐ |
| B-02 | Descripción (markdown) | Event | texto rico | — | CU-EVT-05 | ☐ | ☐ | ☐ | ☐ |
| B-03 | Imagen de portada | Event | URL | — | CU-EVT-03 | ☐ | ☐ | ☐ | ☐ |
| B-04 | Video (YouTube) | Event | URL | null | CU-EVT-04 | ☐ | ☐ | ☐ | ☐ |
| B-05 | Fecha/hora de inicio y fin | Event | fecha | — | CU-EVT-02 | ☐ | ☐ | ☐ | ☐ |
| B-06 | Edad mínima | Event | número | null | CU-EVT-06 | ☐ | ☐ | ☐ | ☐ |
| B-07 | Locación | Event | FK | — | CU-CFG-04 | ☐ | ☐ | ☐ | ☐ |
| B-08 | Categoría | Event | FK | — | CU-CFG-08 | ☐ | ☐ | ☐ | ☐ |
| B-09 | Carpeta | Event | FK | null | CU-EVT-22 | ☐ | ☐ | ☐ | ☐ |
| B-10 | Modo de invitación | Event | enum (3) | TRADITIONAL | CU-EVT-07 | ☐ | ☐ | ☐ | ☐ |
| B-11 | Pedir datos de cada asistente | Event | booleano | true | CU-EVT-08 | ☐ | ☐ | ☐ | ☐ |
| B-12 | Cargo por servicio | Event | número | null | CU-EVT-09 | ☐ | ☐ | ☐ | ☐ |
| B-13 | Mail de notificación de ventas | Event | email | null | CU-EVT-10 | ☐ | ☐ | ☐ | ☐ |
| B-14 | Mostrar código del ticket en el PDF | Event | booleano | false | CU-EVT-11 | ☐ | ☐ | ☐ | ☐ |
| B-15 | Campo "invita" de texto libre | Event | booleano | false | CU-EVT-12 | ☐ | ☐ | ☐ | ☐ |
| B-16 | Publicado / despublicado | Event | booleano | false | CU-EVT-16 | ☐ | ☐ | ☐ | ☐ |
| B-17 | Usuarios de boletería autorizados | Event ↔ User | relación | vacío | CU-EVT-14 | ☐ | ☐ | ☐ | ☐ |
| B-18 | Preguntas del formulario | EventQuestion | lista | vacío | CU-EVT-13 | ☐ | ☐ | ☐ | ☐ |
| B-19 | Organizadores del evento | EventXOrganizer | relación | vacío | CU-ORG-01 | ☐ | ☐ | ☐ | ☐ |
| B-20 | % de descuento por organizador | EventXOrganizer | número | null | CU-MOD-02 | ☐ | ☐ | ☐ | ☐ |
| B-21 | Cupo de invitaciones por organizador | EventXOrganizer | número | null | CU-MOD-04 | ☐ | ☐ | ☐ | ☐ |
| B-22 | Nombre / descripción del tipo de ticket | TicketType | texto | — | CU-TKT-01 | ☐ | ☐ | ☐ | ☐ |
| B-23 | Precio | TicketType | número | null | CU-TKT-02 | ☐ | ☐ | ☐ | ☐ |
| B-24 | Categoría (gratis / pago / mesa) | TicketType | enum (3) | — | CU-TKT-02 | ☐ | ☐ | ☐ | ☐ |
| B-25 | Cupo máximo | TicketType | número | — | CU-TKT-03 | ☐ | ☐ | ☐ | ☐ |
| B-26 | Máximo por compra | TicketType | número | — | CU-TKT-04 | ☐ | ☐ | ☐ | ☐ |
| B-27 | Fecha límite de venta | TicketType | fecha | null | CU-TKT-05 | ☐ | ☐ | ☐ | ☐ |
| B-28 | Hora de validez propia del ticket | TicketType | fecha | = evento | CU-TKT-06 | ☐ | ☐ | ☐ | ☐ |
| B-29 | Límite horario de escaneo | TicketType | fecha | null | CU-TKT-07 | ☐ | ☐ | ☐ | ☐ |
| B-30 | Permitir escaneos múltiples | TicketType | booleano | false | CU-TKT-08 | ☐ | ☐ | ☐ | ☐ |
| B-31 | Visible en la web | TicketType | booleano | true | CU-TKT-09 | ☐ | ☐ | ☐ | ☐ |
| B-32 | Umbral de "últimos lugares" | TicketType | número | null | CU-TKT-10 | ☐ | ☐ | ☐ | ☐ |
| B-33 | Orden de aparición | TicketType | número | secuencial | CU-TKT-11 | ☐ | ☐ | ☐ | ☐ |
| B-34 | Organizadores del tipo de ticket | TicketType ↔ User | relación | vacío | CU-TKT-12 | ☐ | ☐ | ☐ | ☐ |
| B-35 | Enviar ticket de organizador por mail | (acción del alta) | booleano | false | CU-ORG-02 | ☐ | ☐ | ☐ | ☐ |

**Total: 35 parámetros configurables por evento** (10 del evento en sí, 6 flags de comportamiento,
13 del tipo de ticket, 3 de organizadores, 3 relacionales).

---

## Anexo C — Integraciones externas y dependencias de infraestructura

| # | Dependencia | Para qué se usa | Variables de entorno | Casos afectados si no está | Light | Pro | Ambos | Fuera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | PostgreSQL | Toda la persistencia | `DATABASE_URL` | todos | ☐ | ☐ | ☐ | ☐ |
| C-02 | MercadoPago | Cobro online y confirmación de pago | `MP_ACCESS_TOKEN`, `MP_SECRET_KEY` | CU-VTA-17, CU-INT-01/02 (queda sólo lo gratuito) | ☐ | ☐ | ☐ | ☐ |
| C-03 | Resend | Todos los correos | `RESEND_API_KEY`, `RESEND_DOMAIN` | CU-EMI-03/04/08, CU-EVT-10, CU-USR-12 | ☐ | ☐ | ☐ | ☐ |
| C-04 | AWS S3 | Portadas de evento | `AWS_*`, `NEXT_PUBLIC_S3_BUCKET_URL` | CU-EVT-03 | ☐ | ☐ | ☐ | ☐ |
| C-05 | Clave de cifrado de QR | Generar y validar los QR de los tickets | `BARCODE_SECRET` | CU-EMI-02, todo el módulo ACR | ☐ | ☐ | ☐ | ☐ |
| C-06 | Pluto (orquestador) | Alta de credenciales, redeploy, calendario central | `PLUTO_URL`, `INSTANCE_WEB_URL` | CU-ACC-05/06, CU-INT-06/07 | ☐ | ☐ | ☐ | ☐ |
| C-07 | Analítica web | Métricas de uso del sitio público | — | CU-INT-10 | ☐ | ☐ | ☐ | ☐ |
| C-08 | Secreto de sesión | Autenticación | `AUTH_SECRET` | todo el backoffice | ☐ | ☐ | ☐ | ☐ |
| C-09 | Branding de instancia | Identidad visual y remitentes | `NEXT_PUBLIC_INSTANCE_*`, `NEXT_PUBLIC_HUE`, `NEXT_PUBLIC_SATURATION`, `INSTANCE_CONTACT_EMAIL` | CU-CFG-01/02/03 | ☐ | ☐ | ☐ | ☐ |

---

## Anexo D — Dependencias entre casos de uso

Si al armar el corte se saca un caso "padre", los "hijos" caen con él. Esto es lo que hay que mirar
para que Light no quede roto.

### D-1 · El modo INVITACIÓN arrastra un subsistema completo

```
CU-MOD-03 Modo INVITACIÓN
 ├── CU-MOD-04 Cupo por organizador
 ├── CU-MOD-05 Generación de códigos individuales
 ├── CU-MOD-06 Canje de código (route handler dedicado)
 ├── CU-MOD-08 Redistribución "robando" tickets
 ├── CU-MOD-09 Vista de distribución entregada
 ├── CU-ORG-08 Mis códigos no usados
 ├── CU-ORG-09 Compartir código individual
 ├── CU-OPE-11 Vista consolidada de evento por invitación
 ├── CU-EVT-24 Cálculo alternativo de capacidad
 ├── CU-CRM-06 Columna ID con número de invitación
 └── TODO el módulo JEF (la jefatura existe para repartir invitaciones)
```

Entidades involucradas: `TicketXOrganizer`, `EventXOrganizer.ticketAmount`, y ~900 líneas de lógica
de distribución (`chief-organizer-invitation-distribution.ts`).

### D-2 · La figura del ORGANIZADOR arrastra

```
Organizador como usuario del sistema
 ├── CU-USR-04/05/06 alta y gestión de RRPP
 ├── CU-USR-12 importación masiva
 ├── CU-USR-13/14 grupos (tags)
 ├── CU-USR-15 alias de cobro y Drive
 ├── CU-USR-16 jerarquía con jefe
 ├── CU-ORG-01..13 módulo completo
 ├── CU-MOD-02 comisiones por descuento
 ├── CU-TKT-12/13 asignación de tipos de ticket y links
 ├── CU-TKT-16 tipo de ticket "Organizador"
 ├── CU-JEF-01..09 módulo completo
 ├── CU-OPE-04 columnas Organizador / Jefe del organizador
 └── CU-ACR-08 "invitado por" en el escaneo
```

> **Alternativa liviana ya existente en el producto:** el modo SIMPLE (CU-MOD-07 + CU-EVT-12)
> cubre la necesidad de "saber quién invitó" **sin** dar de alta usuarios, sin comisiones y sin
> jerarquía. Es el único caso donde el sistema ya ofrece hoy una versión reducida de una capacidad
> compleja.

### D-3 · El cobro online arrastra

```
CU-VTA-17 Pago con MercadoPago
 ├── CU-ACC-05/06 onboarding de credenciales (hoy bloquea el login si faltan)
 ├── CU-INT-01/02 preferencia + webhook firmado
 ├── CU-VTA-10 carrito con expiración (existe para no bloquear cupo durante el pago)
 ├── CU-VTA-16 desglose de precios
 ├── CU-VTA-20 pago pendiente / reintento
 ├── CU-EVT-09 cargo por servicio
 ├── CU-MOD-02 descuento por organizador (se aplica en la preferencia)
 └── CU-EST-04 recaudación (sin precios, la métrica de dinero pierde sentido)
```

> ⚠️ **Bloqueo actual:** si la instancia no tiene credenciales de MercadoPago cargadas, el login
> redirige obligatoriamente a `/credentials`. Una instancia que sólo maneje eventos gratuitos hoy
> **no puede saltear ese paso**.

### D-4 · Los tipos de ticket múltiples arrastran

```
Varios tipos de ticket por evento
 ├── CU-TKT-11 reordenamiento
 ├── CU-TKT-13 link por tipo
 ├── CU-OPE-01 solapas por tipo
 ├── CU-OPE-07 export con una hoja por tipo
 ├── CU-ACR-13 presentismo agrupado por tipo
 └── CU-TKT-06/07 horarios distintos por tipo
```

### D-5 · Cadena mínima e irreducible

Sin esto no hay producto, en ninguna versión:

```
CU-ACC-01 login → CU-EVT-02 crear evento → CU-TKT-01 un tipo de ticket
 → CU-EVT-16 publicar → CU-VTA-05 ficha pública → CU-VTA-08 elegir entradas
 → CU-VTA-11 cargar datos → CU-EMI-01 emitir → CU-EMI-02 PDF con QR
 → CU-EMI-03 enviar por mail → CU-ACR-02 escanear en la puerta
```

Son **11 casos de uso** de los 184 relevados.

---

## Anexo E — Ejes de corte candidatos

> **Esto no es una propuesta de separación.** Es la lista de dimensiones que aparecieron durante el
> relevamiento y sobre las cuales el corte puede definirse. Sirve para que la discusión funcional no
> se haga caso por caso sino por eje, y recién después se baje a cada CU.

| # | Eje | Extremo simple | Extremo complejo | Módulos que mueve |
| --- | --- | --- | --- | --- |
| E-01 | **Quién trae al público** | "Invita" texto libre (SIMPLE) | RRPP como usuarios, con código, comisión y jerarquía | MOD, ORG, JEF, USR |
| E-02 | **Cómo se controla el aforo** | Un cupo total | Cupo por tipo + máximo por compra + umbral de stock + límite de venta | TKT |
| E-03 | **Cómo se cobra** | Sólo gratuito / cobro en puerta | Cobro online con descuentos y cargo por servicio | VTA, INT |
| E-04 | **Cuántos tipos de entrada** | Uno | N tipos con orden, horarios y visibilidad propios | TKT, OPE |
| E-05 | **Modelo de invitación** | Sólo venta abierta | 3 modos, con subsistema de códigos individuales | MOD |
| E-06 | **Profundidad del catálogo** | El evento se escribe solo | Catálogos de locaciones, categorías y carpetas reutilizables | CFG, EVT |
| E-07 | **Equipo operativo** | Un solo usuario que hace todo | 5 roles con autorización por evento | ACC, USR, EVT |
| E-08 | **Datos del asistente** | Nombre y DNI del comprador | Datos completos por asistente + formulario de preguntas | VTA, EVT |
| E-09 | **Inteligencia de negocio** | Contador de emitidos vs. escaneados | Tablero, comparativas por evento y salón, curva horaria, padrón de compradores | EST, CRM |
| E-10 | **Presencia pública** | Link directo al evento | Cartelera con búsqueda, filtros y categorías | VTA, CFG |
| E-11 | **Salidas documentales** | PDF del ticket | + presentismo en dos formatos, Excel por tipo, QR imprimible, exportes con clave | ACR, OPE |
| E-12 | **Modelo de despliegue** | Multi-tenant / autoservicio | Una instancia por cliente con branding y credenciales propias | INT |

---

## Anexo F — Observaciones y huecos detectados en el relevamiento

Hallazgos objetivos surgidos de leer el código. No son juicios sobre el corte, pero conviene que el
funcional los tenga a la vista porque varios afectan la decisión.

| # | Observación | Impacto |
| --- | --- | --- |
| **F-1** | La autorización es una **jerarquía lineal**, no un esquema de permisos. `ORGANIZER` hereda las capacidades de `TICKETING` (emitir tickets, reenviar, descargar PDF, acreditar manualmente) aunque la UI no las exponga. | Si Light se define "por rol", conviene revisar el modelo de permisos antes. |
| **F-2** | **Los feature flags están implementados pero vacíos** (`FEATURE_KEYS = {}`). Existe tabla, API, pantalla de administración y componente envoltorio. | Es el mecanismo natural para el corte Light/Pro sin bifurcar el código. |
| **F-3** | El **tablero de estadísticas está construido pero desactivado** en la navegación (la entrada está comentada en la sidebar). | Hoy la funcionalidad más "Pro" del sistema no se está usando. |
| **F-4** | **No se puede cambiar el modo de invitación** de un evento después de crearlo (el update no toca el campo). | Condiciona cualquier estrategia de "empezá simple y creceś". |
| **F-5** | El login **exige credenciales de MercadoPago** para acceder al sistema, incluso si el cliente sólo hace eventos gratuitos. | Fricción de onboarding severa para un producto de entrada. |
| **F-6** | El modo INVITACIÓN exige que el evento tenga **exactamente un tipo de ticket** (además del de organizador); si no, el canje falla con "error en la configuración". | Restricción no evidente para el usuario. |
| **F-7** | El sistema **guarda el alias de cobro** del organizador pero **no liquida ni transfiere**: la rendición a RRPP es manual y por fuera. | Hueco funcional en la propuesta de valor para el segmento RRPP. |
| **F-8** | No hay **reembolsos, cancelaciones ni transferencia de tickets** entre personas. | Hueco funcional transversal. |
| **F-9** | No hay **gestión de mesas/ubicaciones asignadas** más allá de la categoría `TABLE` del tipo de ticket (que es sólo una etiqueta). | Relevante si el segmento incluye salones con mesas. |
| **F-10** | No hay **códigos de descuento / cupones** independientes del organizador. | Hueco funcional habitual en ticketing. |
| **F-11** | No hay **integración con WhatsApp Business** ni envío masivo de campañas: la base de compradores se consulta y exporta, pero la comunicación es manual. | Relevante para el eje CRM. |
| **F-12** | La **capacidad de la locación** se carga pero no se valida contra la suma de cupos de los tipos de ticket. | Validación faltante. |
| **F-13** | El borrado de usuarios y locaciones es **físico**; el de eventos y preguntas es **lógico**. Criterio inconsistente. | Riesgo de pérdida de datos. |
| **F-14** | No existe **auditoría de cambios de configuración** (quién cambió un precio, un cupo o una fecha). Sí hay auditoría de escaneos. | Relevante para operaciones con equipo grande. |
| **F-15** | La **exportación de datos personales exige revalidar la contraseña**, pero no queda registro de quién exportó qué. | Control parcial. |
| **F-16** | El modelo es **una instancia por cliente**, sin multi-tenancy en la aplicación. | Determina el costo marginal de cada cliente Light. |
| **F-17** | El campo `paidOnLocation` del ticket registra el cobro en puerta pero **no hay cierre de caja ni arqueo** por boletero/turno. | Hueco funcional para operación de puerta. |
| **F-18** | El carrito expira a los **10 minutos**, valor fijo en código, no configurable. | Parámetro candidato a configuración. |

---

## Anexo G — Planilla de clasificación (índice completo)

Índice plano de los 184 casos, listo para volcar a planilla y clasificar de corrido.

| ID | Caso de uso | Módulo | Light | Pro | Ambos | Fuera | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CU-ACC-01 | Iniciar sesión con usuario y contraseña | ACC | ☐ | ☐ | ☐ | ☐ | |
| CU-ACC-02 | Redirección automática al panel según rol | ACC | ☐ | ☐ | ☐ | ☐ | |
| CU-ACC-03 | Cerrar sesión | ACC | ☐ | ☐ | ☐ | ☐ | |
| CU-ACC-04 | Bloqueo de acceso por rol | ACC | ☐ | ☐ | ☐ | ☐ | |
| CU-ACC-05 | Cargar credenciales de cobro | ACC | ☐ | ☐ | ☐ | ☐ | ver F-5 |
| CU-ACC-06 | Esperar el redeploy | ACC | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-01 | Identidad de la instancia | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-02 | Paleta de color | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-03 | Logo/marca | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-04 | Crear locación | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-05 | Editar locación | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-06 | Eliminar locación | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-07 | Listar locaciones con sus eventos | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-08 | Crear categoría de evento | CFG | ☐ | ☐ | ☐ | ☐ | obligatoria en el evento |
| CU-CFG-09 | Editar categoría | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-10 | Activar/desactivar categoría | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-11 | Reordenar categorías | CFG | ☐ | ☐ | ☐ | ☐ | |
| CU-CFG-12 | Administrar feature flags | CFG | ☐ | ☐ | ☐ | ☐ | ver F-2 |
| CU-USR-01 | Crear usuario interno | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-02 | Confirmar creación de ADMIN | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-03 | Listar usuarios internos | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-04 | Crear organizador / RRPP | USR | ☐ | ☐ | ☐ | ☐ | ver D-2 |
| CU-USR-05 | Listar organizadores con filtros | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-06 | Ver ficha de organizador | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-07 | Editar datos de usuario | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-08 | Editar mi perfil | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-09 | Resetear contraseña | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-10 | Compartir credenciales | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-11 | Eliminar usuario | USR | ☐ | ☐ | ☐ | ☐ | ver F-13 |
| CU-USR-12 | Importar organizadores desde planilla | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-13 | Crear y administrar grupos (tags) | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-14 | Asignar/quitar del grupo | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-USR-15 | Alias de cobro y Drive | USR | ☐ | ☐ | ☐ | ☐ | ver F-7 |
| CU-USR-16 | Asignar organizador a un jefe | USR | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-01 | Crear evento con asistente | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-02 | Información general | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-03 | Portada con recorte | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-04 | Video de YouTube | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-05 | Descripción con formato | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-06 | Edad mínima | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-07 | Modo de invitación | EVT | ☐ | ☐ | ☐ | ☐ | ver F-4 |
| CU-EVT-08 | Datos por asistente | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-09 | Cargo por servicio | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-10 | Mail de notificación de ventas | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-11 | Código del ticket en el PDF | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-12 | Campo "invita" libre | EVT | ☐ | ☐ | ☐ | ☐ | ver D-2 |
| CU-EVT-13 | Preguntas del formulario | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-14 | Usuarios de boletería del evento | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-15 | Previsualizar el evento | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-16 | Publicar / despublicar | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-17 | Editar evento | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-18 | Duplicar evento | EVT | ☐ | ☐ | ☐ | ☐ | clave para fiestas recurrentes |
| CU-EVT-19 | Eliminar evento (lógico) | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-20 | Listar próximos y pasados | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-21 | Carpetas de eventos | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-22 | Mover evento a carpeta | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-23 | Panel individual del evento | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-EVT-24 | Contador de emitidos sobre cupo | EVT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-01 | Crear tipo de ticket | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-02 | Precio y categoría | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-03 | Cupo máximo | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-04 | Máximo por compra | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-05 | Fecha límite de venta | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-06 | Horario propio del ticket | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-07 | Límite horario de escaneo | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-08 | Escaneos múltiples | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-09 | Ocultar de la web | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-10 | Aviso de últimos lugares | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-11 | Reordenar tipos | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-12 | Organizadores por tipo | TKT | ☐ | ☐ | ☐ | ☐ | ver D-2 |
| CU-TKT-13 | Link directo al tipo | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-14 | Editar tipo | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-15 | Eliminar tipo | TKT | ☐ | ☐ | ☐ | ☐ | |
| CU-TKT-16 | Tipo especial "Organizador" | TKT | ☐ | ☐ | ☐ | ☐ | ver D-2 |
| CU-MOD-01 | Modo TRADICIONAL | MOD | ☐ | ☐ | ☐ | ☐ | |
| CU-MOD-02 | Comisión por descuento | MOD | ☐ | ☐ | ☐ | ☐ | |
| CU-MOD-03 | Modo INVITACIÓN | MOD | ☐ | ☐ | ☐ | ☐ | ver D-1, F-6 |
| CU-MOD-04 | Cupo de invitaciones | MOD | ☐ | ☐ | ☐ | ☐ | |
| CU-MOD-05 | Códigos individuales | MOD | ☐ | ☐ | ☐ | ☐ | |
| CU-MOD-06 | Canje de código | MOD | ☐ | ☐ | ☐ | ☐ | |
| CU-MOD-07 | Modo SIMPLE | MOD | ☐ | ☐ | ☐ | ☐ | alternativa liviana existente |
| CU-MOD-08 | Redistribuir robando tickets | MOD | ☐ | ☐ | ☐ | ☐ | |
| CU-MOD-09 | Ver distribución entregada | MOD | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-01 | Asignar organizadores al evento | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-02 | Mail con ticket de organizador | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-03 | Ver mis eventos | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-04 | Mi código personal | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-05 | Copiar mi link de venta | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-06 | Mi QR personalizado | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-07 | Ver mis ventas | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-08 | Mis códigos no usados | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-09 | Compartir un código | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-10 | Mi base de compradores | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-11 | Validar código en checkout | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-12 | Atribución automática por link | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-ORG-13 | Reasignar organizador de un ticket | ORG | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-01 | Administrar mi equipo | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-02 | Distribuir mi pozo de invitaciones | JEF | ☐ | ☐ | ☐ | ☐ | ver D-1 |
| CU-JEF-03 | Recuperar invitaciones no usadas | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-04 | Sumar organizador al evento | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-05 | Quitar organizador del evento | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-06 | Ventas consolidadas del equipo | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-07 | Filtrar ventas por organizador | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-08 | Métricas de rendimiento | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-JEF-09 | Detalle de un organizador | JEF | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-01 | Cartelera de eventos | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-02 | Buscar evento | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-03 | Filtrar por fecha | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-04 | Filtrar por categoría | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-05 | Ficha del evento | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-06 | Video del evento | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-07 | Ubicación y cómo llegar | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-08 | Seleccionar entradas | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-09 | Disponibilidad y últimos lugares | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-10 | Carrito con expiración | VTA | ☐ | ☐ | ☐ | ☐ | ver F-18 |
| CU-VTA-11 | Datos de los asistentes | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-12 | Reutilizar datos anteriores | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-13 | Aplicar código de organizador | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-14 | Declarar quién me invitó | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-15 | Responder el formulario | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-16 | Detalle de precios | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-17 | Pagar con MercadoPago | VTA | ☐ | ☐ | ☐ | ☐ | ver D-3 |
| CU-VTA-18 | Entradas gratuitas sin pago | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-19 | Ver y descargar mis entradas | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-VTA-20 | Retomar pago pendiente | VTA | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-01 | Emitir tickets al confirmar | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-02 | PDF con QR cifrado | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-03 | Mail por ticket | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-04 | Mail único con todos los tickets | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-05 | Emisión manual en boletería | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-06 | Pagado en puerta | EMI | ☐ | ☐ | ☐ | ☐ | ver F-17 |
| CU-EMI-07 | Acreditación automática al emitir | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-08 | Reenviar ticket por mail | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-09 | Descargar PDF desde backoffice | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-EMI-10 | Eliminar ticket emitido | EMI | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-01 | Elegir eventos a escanear | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-02 | Escanear con la cámara | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-03 | Escanear varios eventos a la vez | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-04 | Validar pertenencia al evento | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-05 | Rechazar ticket ya escaneado | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-06 | Avisar ticket no vigente | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-07 | Avisar fuera de horario | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-08 | Mostrar quién invitó | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-09 | Resultado del último escaneo | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-10 | Historial de escaneos | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-11 | Acreditar manualmente | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-12 | Auditoría de escaneos | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-ACR-13 | Presentismo en PDF | ACR | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-01 | Lista de ventas por tipo | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-02 | Buscar persona | OPE | ☐ | ☐ | ☐ | ☐ | crítico en puerta |
| CU-OPE-03 | Ordenar y redimensionar columnas | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-04 | Columnas del ticket | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-05 | Hora de ingreso y reingresos | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-06 | Exportar tabla con clave | OPE | ☐ | ☐ | ☐ | ☐ | ver F-15 |
| CU-OPE-07 | Exportar Excel por tipo | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-08 | Ver respuestas del formulario | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-09 | Saltar del ticket al formulario | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-10 | QR público del evento | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-11 | Vista consolidada por invitación | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-OPE-12 | Paginar listados largos | OPE | ☐ | ☐ | ☐ | ☐ | |
| CU-CRM-01 | Padrón único de compradores | CRM | ☐ | ☐ | ☐ | ☐ | |
| CU-CRM-02 | Padrón propio del organizador | CRM | ☐ | ☐ | ☐ | ☐ | |
| CU-CRM-03 | Ficha del comprador | CRM | ☐ | ☐ | ☐ | ☐ | |
| CU-CRM-04 | Historial de eventos asistidos | CRM | ☐ | ☐ | ☐ | ☐ | |
| CU-CRM-05 | Contactar por WhatsApp/IG/mail | CRM | ☐ | ☐ | ☐ | ☐ | ver F-11 |
| CU-CRM-06 | Código corto de comprador | CRM | ☐ | ☐ | ☐ | ☐ | |
| CU-EST-01 | Tablero general | EST | ☐ | ☐ | ☐ | ☐ | ver F-3 |
| CU-EST-02 | Filtrar por fechas | EST | ☐ | ☐ | ☐ | ☐ | |
| CU-EST-03 | Filtrar por evento | EST | ☐ | ☐ | ☐ | ☐ | |
| CU-EST-04 | Asistencia, recaudación, vendidos | EST | ☐ | ☐ | ☐ | ☐ | |
| CU-EST-05 | Asistencia por género | EST | ☐ | ☐ | ☐ | ☐ | |
| CU-EST-06 | Curva de emisión por hora | EST | ☐ | ☐ | ☐ | ☐ | |
| CU-EST-07 | Comparar eventos | EST | ☐ | ☐ | ☐ | ☐ | |
| CU-EST-08 | Comparar salones | EST | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-01 | Cobrar con MercadoPago del cliente | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-02 | Webhook de pago firmado | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-03 | Correos transaccionales | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-04 | Reintentos de envío | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-05 | Imágenes en object storage | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-06 | Agenda expuesta al portal central | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-07 | Comunicación firmada con el orquestador | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-08 | Aprovisionar instancia por cliente | INT | ☐ | ☐ | ☐ | ☐ | ver F-16 |
| CU-INT-09 | Migraciones y datos semilla | INT | ☐ | ☐ | ☐ | ☐ | |
| CU-INT-10 | Analítica del sitio público | INT | ☐ | ☐ | ☐ | ☐ | |

---

## Anexo H — Trazabilidad: dónde vive cada módulo en el código

Para estimar el esfuerzo de apagar o extraer cada bloque.

| Módulo | Archivos principales | Volumen aprox. |
| --- | --- | --- |
| ACC | `src/server/auth.ts`, `src/app/login/`, `src/app/credentials/`, `src/server/utils/authRedirect.ts` | bajo |
| CFG | `src/server/routers/location.ts`, `event-categories.ts`, `event-folder.ts`, `feature.ts`, `src/lib/get-colors.ts` | bajo |
| USR | `src/server/routers/user.ts` (517 líneas), `tag.ts`, `src/components/admin/users/**`, `src/lib/userImportUtils.ts` | medio |
| EVT | `src/server/routers/events.ts` (2338 líneas — incluye create/update/duplicate/exports), `src/components/event/create/**`, `src/app/(backoffice)/admin/event/**` | **alto** |
| TKT | dentro de `events.ts` + `src/components/event/create/ticketType/**`, `src/server/schemas/ticket-type.ts` | medio |
| MOD | `src/server/utils/chief-organizer-invitation-distribution.ts` (901 líneas), `ticketXOrganizerInvite.ts`, `src/lib/event-organizers.ts`, `src/lib/chief-organizer-event.ts`, `src/app/api/event/[slug]/invite/` | **alto** |
| ORG | `src/server/routers/organizer.ts`, `src/components/organization/**`, `src/hooks/organizers/**` | medio |
| JEF | `chief-organizer-invitation-distribution.ts`, `src/components/organization/event/ChiefOrganizerEventView.tsx`, `OrganizerDistribution.tsx` | medio-alto |
| VTA | `src/app/(client)/**` (landing, evento, checkout ~1000 líneas, tickets), `src/server/routers/ticket-group.ts` (582), `mercado-pago.ts` | **alto** |
| EMI | `src/server/utils/ticket-template.ts` (639 líneas), `src/server/routers/emitted-tickets.ts` (767), `src/server/services/mail.ts` | medio-alto |
| ACR | `src/server/utils/register-ticket-scan.ts`, `presentismo-pdf.ts` (404), `src/components/event/individual/scan/**`, `src/app/(backoffice)/admin/ticketing/**` | medio |
| OPE | `src/components/event/individual/ticketsTable/**`, `src/components/common/DataTable.tsx`, `src/app/actions/DataTable.ts` | medio |
| CRM | `emittedTickets.getAllUniqueBuyer*`, `src/app/(backoffice)/*/database/**`, `src/components/database/**` | bajo |
| EST | `src/server/routers/statistics.ts` (307), `src/server/services/eventStats.ts`, `calendarEventStats.ts`, `src/components/admin/*Chart*` | medio |
| INT | `src/app/api/**`, `src/server/security/signed-request.ts`, `src/server/services/**` | medio |

---

## Anexo I — Qué falta relevar (fuera del alcance de este documento)

Para completar el insumo del corte comercial, quedan pendientes datos que **no están en el código**
y que hay que aportar desde el negocio:

1. **Volumen y perfil de los clientes actuales** por instancia: cuántos usan cada modo de
   invitación, cuántos usan RRPP con comisión, cuántos usan jefes de organizadores, cuántos tienen
   más de un tipo de ticket, cuántos usan el formulario de preguntas.
2. **Uso real de las funciones "Pro"**: si el tablero de estadísticas está desactivado en el menú
   (F-3), probablemente haya más funcionalidad construida y no usada.
3. **Costo de infraestructura por instancia**, para dimensionar la viabilidad del modelo actual en
   un plan Light de bajo precio (ver F-16).
4. **Frecuencia de las tareas de soporte**: cuántas veces se pide reenviar un ticket, corregir la
   atribución a un organizador, resetear una contraseña. Es un buen proxy de qué es imprescindible.
5. **Fricción de onboarding medida**: cuánto tarda hoy un cliente nuevo desde el alta hasta su
   primer evento publicado, y en qué paso se traba (candidato fuerte: F-5).

---

*Fin del documento. 184 casos de uso relevados, 35 parámetros configurables por evento, 9
dependencias externas, 5 cadenas de dependencia funcional y 18 observaciones.*






