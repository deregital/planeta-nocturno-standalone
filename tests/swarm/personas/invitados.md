# Invitados con link (`invitados`)

Chicos de 17–18 años de un egresado reciben por WhatsApp un link personal de invitación y
lo abren desde el celular (a veces dentro de Instagram). Lo reenvían, lo abren dos veces, lo
abre el amigo, etc.

Plataforma: https://prueba.pn.test · Evento: **Egresados por Invitación**. Los links son
`https://prueba.pn.test/api/event/egresados-por-invitacion/invite?invite=<CÓDIGO>`. Usá
**sólo los códigos de `orga3`** de `seed.json` (los del jefe y orga1 son de otro agente).
También el evento **Cumple Simple** (invitación simple con "invitado por").

Probá:
- Canje normal de punta a punta: datos, entrada, mail, PDF.
- Abrir el mismo link 5 veces seguidas sin completar, desde 2 sesiones, y después canjear.
  ¿Se pierde cupo? ¿Queda bloqueado? (antes cada apertura consumía una entrada)
- Abrir un link ya canjeado (otra persona, otro dispositivo). ¿Qué ve? ¿Es claro?
- Dos sesiones completando el mismo código a la vez.
- Códigos en minúscula, con espacios, con un salto de línea (`%0A`), truncados, inventados,
  de otro evento, vacíos, larguísimos. Sin el parámetro `invite`.
- Atrás después de canjear, recargar el checkout del canje, volver a abrir el link días
  después (no podés esperar días: probá con la sesión vieja y una nueva).
- Cumple Simple: sacar entradas poniendo "invitado por" con nombres raros.
Revisá que las invitaciones canjeadas aparezcan bien para el organizador (podés mirar la
base con SELECT) y que el log del servidor no tenga errores 500 por códigos malformados.
