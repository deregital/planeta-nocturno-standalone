export const meta = {
  name: 'swarm-test',
  description:
    'Enjambre de agentes que usan la app como usuarios reales sobre el stack simulado, y después verifica cada hallazgo desde cero',
  whenToUse:
    'Con el stack simulado levantado (tests/stack/up.sh --reseed). args: { root, startedAt, personas?, minSeverity? }',
  phases: [
    {
      title: 'Usar la app',
      detail: 'un agente por persona, en paralelo',
      model: 'sonnet',
    },
    {
      title: 'Consolidar',
      detail: 'unir duplicados, chequeo de invariantes, marcar conocidos',
    },
    {
      title: 'Verificar',
      detail: 'reproducir cada hallazgo desde cero y ubicar la causa',
      model: 'sonnet',
    },
  ],
};

// args.root: ruta absoluta del repo. args.startedAt: hora ISO de inicio (el script no
// puede leer el reloj). args.personas: ids a correr (por defecto todas).
const ROOT = args?.root;
const STARTED_AT = args?.startedAt;
if (!ROOT || !STARTED_AT) throw new Error('Faltan args.root y args.startedAt');

const PERSONAS = [
  { id: 'compradora', file: 'compradora-celu.md' },
  { id: 'caotico', file: 'comprador-caotico.md' },
  { id: 'carrera', file: 'carrera-cupo.md' },
  { id: 'invitados', file: 'invitados.md' },
  { id: 'organizadores', file: 'organizadores.md' },
  { id: 'puerta', file: 'puerta.md' },
  { id: 'productora', file: 'productora.md' },
  { id: 'backoffice', file: 'backoffice.md' },
  { id: 'boleteria', file: 'boleteria.md' },
  { id: 'control', file: 'panel-control.md' },
  { id: 'saboteador', file: 'saboteador.md' },
  { id: 'ux-celu', file: 'recorrido-celu.md' },
].filter((p) => !args?.personas || args.personas.includes(p.id));

const SEVERITIES = ['critica', 'alta', 'media', 'baja'];
const minRank = SEVERITIES.indexOf(args?.minSeverity ?? 'media');

const FINDING = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    severidad: { type: 'string', enum: SEVERITIES },
    tipo: {
      type: 'string',
      enum: ['bug', 'usabilidad', 'datos', 'rendimiento', 'seguridad'],
    },
    pantalla: { type: 'string', description: 'URL o pantalla donde pasa' },
    pasos: {
      type: 'array',
      items: { type: 'string' },
      description: 'Pasos exactos desde cero, con usuario, evento y datos',
    },
    esperado: { type: 'string' },
    ocurrido: { type: 'string' },
    evidencia: {
      type: 'array',
      items: { type: 'string' },
      description: 'Rutas de capturas, líneas de log, resultados de SQL',
    },
    reproducciones: {
      type: 'string',
      description: 'Cuántas veces pasó sobre cuántos intentos',
    },
    sospechaEntorno: {
      type: 'string',
      description:
        'Por qué podría ser un artefacto del entorno simulado, o vacío',
    },
    causaProbable: {
      type: 'string',
      description: 'Archivo:línea si la encontraste, o vacío',
    },
  },
  required: [
    'titulo',
    'severidad',
    'tipo',
    'pantalla',
    'pasos',
    'esperado',
    'ocurrido',
    'evidencia',
    'reproducciones',
  ],
};

const REPORT = {
  type: 'object',
  properties: {
    hallazgos: { type: 'array', items: FINDING },
    cobertura: {
      type: 'string',
      description: 'Qué recorridos hiciste y cuántas acciones',
    },
    sinProbar: {
      type: 'string',
      description: 'Qué no pudiste probar y por qué',
    },
  },
  required: ['hallazgos', 'cobertura', 'sinProbar'],
};

const CONSOLIDATED = {
  type: 'object',
  properties: {
    hallazgos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'H01, H02…' },
          ...FINDING.properties,
          personas: { type: 'array', items: { type: 'string' } },
          origenes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Títulos originales unidos acá',
          },
          conocido: {
            type: 'string',
            description: 'Qué ítem de conocidos.md coincide, o vacío',
          },
        },
        required: ['id', ...FINDING.required, 'personas', 'conocido'],
      },
    },
    invariantes: {
      type: 'string',
      description:
        'Resumen de tests/stack/check y a qué hallazgo corresponde cada violación',
    },
    descartados: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Reportes descartados y por qué (artefactos del entorno, gustos)',
    },
  },
  required: ['hallazgos', 'invariantes', 'descartados'],
};

const VERDICT = {
  type: 'object',
  properties: {
    veredicto: {
      type: 'string',
      enum: [
        'confirmado',
        'no-reproducido',
        'artefacto-del-entorno',
        'comportamiento-esperado',
      ],
    },
    severidad: {
      type: 'string',
      enum: SEVERITIES,
      description: 'Severidad que le asignás vos después de reproducirlo',
    },
    pasosMinimos: { type: 'array', items: { type: 'string' } },
    causa: {
      type: 'string',
      description: 'Causa en el código (archivo:línea y por qué), o vacío',
    },
    evidencia: { type: 'array', items: { type: 'string' } },
    notas: { type: 'string' },
  },
  required: [
    'veredicto',
    'severidad',
    'pasosMinimos',
    'causa',
    'evidencia',
    'notas',
  ],
};

const common = `Repo: ${ROOT} (trabajá siempre desde ahí y usá rutas relativas a esa carpeta).
Reglas y herramientas: ${ROOT}/tests/swarm/instrucciones.md (leelo entero antes de empezar).
Datos sembrados y credenciales: ${ROOT}/tests/stack/.run/seed.json.
El enjambre arrancó a las ${STARTED_AT}. Hay otros agentes usando la app a la vez con otras
personas: no toques datos que no sean de tu persona.`;

phase('Usar la app');
log(`${PERSONAS.length} personas: ${PERSONAS.map((p) => p.id).join(', ')}`);
const reports = await parallel(
  PERSONAS.map(
    (persona) => () =>
      agent(
        `Sos el agente tester "${persona.id}".
${common}
Tu persona: ${ROOT}/tests/swarm/personas/${persona.file}. Tus sesiones del navegador empiezan
con "${persona.id}-".

Usá la app como esa persona hasta agotar tu presupuesto y devolvé el reporte. Cerrá tus
sesiones del navegador al terminar.`,
        {
          label: `persona:${persona.id}`,
          phase: 'Usar la app',
          model: 'sonnet',
          schema: REPORT,
        },
      ).then((report) => (report ? { persona: persona.id, ...report } : null)),
  ),
);
const done = reports.filter(Boolean);
const dropped = PERSONAS.filter(
  (p) => !done.some((r) => r.persona === p.id),
).map((p) => p.id);
if (dropped.length)
  log(`Sin reporte (agente caído o salteado): ${dropped.join(', ')}`);
const raw = done.reduce((n, r) => n + r.hallazgos.length, 0);
log(`${raw} hallazgos crudos de ${done.length} personas`);

phase('Consolidar');
const consolidated = await agent(
  `Consolidá los reportes de un enjambre de testers.
${common}

1. Corré \`tests/stack/check --since ${STARTED_AT}\` (invariantes de las bases, pagos
   simulados contra la base, mails faltantes y errores del servidor). Cada violación que no
   esté ya en un reporte es un hallazgo nuevo (persona: "invariantes"); usá el log del
   servidor y los logs de los navegadores (tests/stack/.run/browser/*.log, con hora y
   comando) para reconstruir qué lo causó.
2. Uní los hallazgos duplicados o con la misma causa (quedate con los mejores pasos y toda
   la evidencia). Descartá los que son artefactos evidentes del entorno simulado (portadas
   rosas, el diseño del Mercado Pago falso, dominios .test) y los gustos sin impacto.
3. Marcá en "conocido" los que coinciden con ${ROOT}/tests/swarm/conocidos.md.
4. Revisá la severidad con criterio de negocio: plata o entradas perdidas y gente que no
   puede entrar es crítica; numerá H01, H02… de más a menos grave.

Reportes:
${JSON.stringify(done, null, 1)}`,
  { label: 'consolidar', phase: 'Consolidar', schema: CONSOLIDATED },
);
if (!consolidated) return { reports: done, consolidated: null, verified: [] };

const toVerify = consolidated.hallazgos.filter(
  (h) => SEVERITIES.indexOf(h.severidad) <= minRank,
);
const skipped = consolidated.hallazgos.length - toVerify.length;
log(
  `${consolidated.hallazgos.length} hallazgos únicos; se verifican ${toVerify.length}${skipped ? ` (quedan ${skipped} de severidad menor sin verificar)` : ''}`,
);

phase('Verificar');
const verified = await parallel(
  toVerify.map(
    (finding) => () =>
      agent(
        `Verificá un hallazgo de un tester: tu trabajo es intentar refutarlo. Por defecto es
"no-reproducido" hasta que lo veas pasar vos.
${common}
Usá sesiones del navegador nuevas que empiecen con "verif-${finding.id.toLowerCase()}-" y
datos propios (no reutilices los del tester). Si para reproducirlo hace falta un estado que ya
no existe (cupo agotado, código usado), creá uno equivalente desde la app.

1. Reproducilo desde cero siguiendo los pasos (simplificalos si podés). Probá al menos dos
   veces. Si no pasa, probá las variantes razonables antes de descartarlo.
2. Si se reproduce, buscá la causa en el código (archivo:línea) y explicá por qué pasa.
3. Decidí si es un artefacto del entorno simulado (tests/stack/mocks.mjs, preload.mjs,
   browser.mjs) o comportamiento esperado/documentado, y reasigná la severidad.

Hallazgo:
${JSON.stringify(finding, null, 1)}`,
        {
          label: `verificar:${finding.id}`,
          phase: 'Verificar',
          model: 'sonnet',
          schema: VERDICT,
        },
      ).then((verdict) => ({ ...finding, verificacion: verdict })),
  ),
);

return {
  startedAt: STARTED_AT,
  personas: done.map((r) => ({
    persona: r.persona,
    hallazgos: r.hallazgos.length,
    cobertura: r.cobertura,
    sinProbar: r.sinProbar,
  })),
  sinReporte: dropped,
  consolidated,
  verified: verified.filter(Boolean),
  sinVerificar: consolidated.hallazgos.filter(
    (h) => SEVERITIES.indexOf(h.severidad) > minRank,
  ),
};
