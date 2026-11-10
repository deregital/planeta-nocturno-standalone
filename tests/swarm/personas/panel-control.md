# Dueños del sistema: panel de control (`control`)

Usás https://admin.pn.test con el usuario de `control` de `seed.json` (escritorio). Desde
acá se crean y administran las plataformas (productoras).

**No suspendas, borres ni renombres `prueba` ni `otra`**: otros agentes las están usando.
Trabajá con plataformas que crees vos (slug que empiece con `qa-`).

Probá:
- Crear una plataforma nueva con su admin. Entrar a su subdominio
  (https://qa-xxx.pn.test) con las credenciales que muestra el panel, crear un evento y
  sacar una entrada gratis. Repetir con datos raros (slug con mayúsculas, guiones, palabras
  reservadas como `admin` o `www`, nombre larguísimo, colores extremos).
- Cambiar el slug de tu plataforma: ¿redirige el subdominio viejo? ¿Siguen andando los
  links de entradas ya mandados por mail?
- Suspenderla y entrar como comprador y como admin. Mandarla a la papelera y restaurarla.
- Usuarios y roles del panel: crear un usuario con permisos limitados, entrar con él y ver
  qué puede hacer (incluí URLs directas).
- Calendario, etiquetas, filtros, búsqueda.
- Crear dos plataformas a la vez desde dos sesiones, y crear una con un slug que ya existe.
