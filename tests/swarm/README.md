# Enjambre de testers

Muchos agentes usando la app al mismo tiempo como personas reales (compradora desde
Instagram, comprador caótico con mala señal, amigos peleando el último cupo, invitados con
link, jefe de organizadores y su equipo, puerta con fila, productora, backoffice,
boletería, dueños del sistema, usuario malicioso, recorrido de usabilidad en celular) sobre
el [stack simulado](../stack/README.md). No buscan code smells: tocan botones, vuelven
atrás, cortan la red, abren el mismo link cinco veces, escanean 40 QR seguidos y miran
qué se rompe.

## Correr

1. `tests/stack/up.sh --reseed` (estado limpio).
2. Pedirle a Claude Code: *"corré el workflow tests/swarm/workflow.js con
   args `{ root: <ruta absoluta del repo>, startedAt: <hora ISO de ahora> }`"*.
   Opcional: `personas: ['puerta', 'carrera']` para correr sólo algunas y
   `minSeverity: 'alta'` para verificar menos.

El workflow tiene tres fases:

1. **Usar la app**: un agente Sonnet por persona (`personas/*.md`), todos con las reglas
   de `instrucciones.md`. Cada uno devuelve hallazgos con pasos, evidencia y cobertura.
2. **Consolidar**: un agente une duplicados, corre `tests/stack/check` (invariantes de la
   base, pagos contra la base, mails, errores del servidor), descarta artefactos del
   entorno y marca lo que ya estaba en `conocidos.md`.
3. **Verificar**: cada hallazgo de severidad media o mayor lo intenta refutar otro agente,
   reproduciéndolo desde cero con datos propios y buscando la causa en el código.

## Agregar una persona

Un `.md` en `personas/` con quién es, desde qué dispositivo, qué datos son suyos (para no
pisar a otros agentes) y qué recorridos hacer, y su entrada en `PERSONAS` de
`workflow.js`. Conviene pedir recorridos concretos y después variaciones (repetir, a la
vez, con mala red, volver atrás) más que "probá todo".
