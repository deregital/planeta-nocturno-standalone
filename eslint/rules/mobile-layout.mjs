// Clases de Tailwind que rompen la pantalla en el celular (desde 360px de
// ancho). Cada patrón salió de un desborde real (ver CLAUDE.md, "Mobile"):
//
// - fixedWidth: un ancho o mínimo fijo de más de 320px sin breakpoint
//   (`min-w-96`, `w-[400px]`) no entra en 360px menos los márgenes.
// - rigidGrid: 4 columnas o más sin breakpoint quedan de ~60px en el celular.
// - dialogWidth: `w-full`/`w-screen`/`max-w-none` en un DialogContent le
//   sacan el margen de 1rem que trae la base y lo pegan a los bordes.
//
// Un caso legítimo (p. ej. una grilla de muestras de color dentro de un
// popover angosto) se marca con eslint-disable-next-line y el motivo.

const MAX_FIXED_PX = 320;
const MAX_GRID_COLUMNS = 3;
const SPACING_PX = 4;
const CONTAINER_PX = {
  '3xs': 256,
  '2xs': 288,
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  '2xl': 672,
  '3xl': 768,
  '4xl': 896,
  '5xl': 1024,
  '6xl': 1152,
  '7xl': 1280,
};
// Variantes que sólo aplican desde cierto ancho: lo que llevan no afecta al
// celular. `max-sm:`/`max-md:` sí aplican en el celular y se revisan.
const MIN_WIDTH_VARIANT = /^(sm|md|lg|xl|2xl|min-\[[^\]]+\]|@.*)$/;
const CLASS_HELPERS = new Set(['cn', 'clsx', 'classNames', 'cva', 'twMerge']);
const DIALOG_WIDTH =
  /^(w-(full|screen|auto|dvw|svw|lvw)|max-w-(none|full|screen.*))$/;

/** Separa `md:hover:w-10` en variantes y utilidad, respetando los corchetes. */
function splitVariants(token) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of token) {
    if (char === '[' || char === '(') depth += 1;
    if (char === ']' || char === ')') depth -= 1;
    if (char === ':' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return { variants: parts.slice(0, -1), utility: parts.at(-1) ?? '' };
}

function lengthToPx(value) {
  const arbitrary = value.match(/^\[(\d+(?:\.\d+)?)(px|rem)\]$/);
  if (arbitrary) {
    const amount = Number(arbitrary[1]);
    return arbitrary[2] === 'rem' ? amount * 16 : amount;
  }
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * SPACING_PX;
  return CONTAINER_PX[value];
}

export function findMobileProblems(
  classString,
  { isDialogContent = false } = {},
) {
  const problems = [];
  for (const raw of classString.split(/\s+/)) {
    if (!raw) continue;
    const { variants, utility: rawUtility } = splitVariants(raw);
    if (variants.some((variant) => MIN_WIDTH_VARIANT.test(variant))) continue;
    const utility = rawUtility.replace(/^!|!$/g, '');

    const width = utility.match(/^(min-w|w|basis)-(.+)$/);
    if (width) {
      const px = lengthToPx(width[2]);
      if (px !== undefined && px > MAX_FIXED_PX) {
        problems.push({
          messageId: 'fixedWidth',
          data: { token: raw, px: String(Math.round(px)) },
        });
        continue;
      }
    }

    const grid = utility.match(/^grid-cols-(\d+)$/);
    if (grid && Number(grid[1]) > MAX_GRID_COLUMNS) {
      problems.push({ messageId: 'rigidGrid', data: { token: raw } });
      continue;
    }

    if (isDialogContent && DIALOG_WIDTH.test(utility)) {
      problems.push({ messageId: 'dialogWidth', data: { token: raw } });
    }
  }
  return problems;
}

/** Junta los strings de clases de una expresión: literales, templates, cn(), ternarios. */
function collectStrings(node, out) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') out.push({ node, value: node.value });
      return;
    case 'TemplateLiteral':
      for (const quasi of node.quasis)
        out.push({ node: quasi, value: quasi.value.cooked ?? '' });
      for (const expression of node.expressions)
        collectStrings(expression, out);
      return;
    case 'JSXExpressionContainer':
      collectStrings(node.expression, out);
      return;
    case 'ConditionalExpression':
      collectStrings(node.consequent, out);
      collectStrings(node.alternate, out);
      return;
    case 'LogicalExpression':
      collectStrings(node.left, out);
      collectStrings(node.right, out);
      return;
    case 'ArrayExpression':
      for (const element of node.elements) collectStrings(element, out);
      return;
    case 'ObjectExpression':
      for (const property of node.properties) {
        if (property.type !== 'Property') continue;
        if (property.key.type === 'Literal') collectStrings(property.key, out);
        collectStrings(property.value, out);
      }
      return;
    case 'CallExpression':
      if (
        node.callee.type === 'Identifier' &&
        CLASS_HELPERS.has(node.callee.name)
      ) {
        for (const argument of node.arguments) collectStrings(argument, out);
      }
      return;
    default:
  }
}

function jsxName(name) {
  if (!name) return '';
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return jsxName(name.property);
  return '';
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Evita clases de Tailwind que desbordan la pantalla en el celular',
    },
    schema: [],
    messages: {
      fixedWidth:
        '`{{token}}` fija {{px}}px y no entra en un celular de 360px. Usá `w-full max-w-*` o poné el ancho con un breakpoint (`sm:`, `md:`).',
      rigidGrid:
        '`{{token}}` sin breakpoint deja columnas de ~60px en el celular. Usá menos columnas abajo y `sm:`/`md:grid-cols-*` arriba.',
      dialogWidth:
        '`{{token}}` en DialogContent le saca el margen de 1rem que trae la base y lo pega a los bordes del celular. Usá `max-w-*` o `sm:w-*`.',
    },
  },
  create(context) {
    const seen = new Set();

    function check(expression, options) {
      const strings = [];
      collectStrings(expression, strings);
      for (const { node, value } of strings) {
        if (seen.has(node)) continue;
        seen.add(node);
        for (const problem of findMobileProblems(value, options)) {
          context.report({ node, ...problem });
        }
      }
    }

    return {
      JSXAttribute(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          !/className$/i.test(node.name.name)
        )
          return;
        const element = jsxName(node.parent?.name);
        check(node.value, {
          isDialogContent:
            element === 'DialogContent' && node.name.name === 'className',
        });
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          CLASS_HELPERS.has(node.callee.name)
        ) {
          check(node, {});
        }
      },
    };
  },
};

export default rule;
