// Detecta lo que se sale de la pantalla: lo usan el aviso de desarrollo
// (MobileOverflowWatcher) y el test de tests/mobile/overflow.mjs, que copia
// esta función al navegador. Mantener sin imports y sin dependencias del DOM
// fuera de `document`/`window`.

export type MobileOverflowProblem = {
  kind: 'page' | 'clipped' | 'spill' | 'dialog-height';
  /** px que se sale (horizontal) o que falta (alto del modal). */
  amount: number;
  description: string;
  element: Element;
};

const IGNORE =
  '[data-allow-overflow], [data-allow-overflow] *, .sr-only, [data-sonner-toaster], [data-sonner-toaster] *, [data-slot=dialog-overlay], [data-slot=sheet-overlay], [data-slot=drawer-overlay]';

function describe(element: Element) {
  const classes = (element.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join('.');
  const text = ((element as HTMLElement).innerText ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
  return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${text ? ` «${text}»` : ''}`;
}

/** Una caja pensada para deslizarse de costado: tablas y overflow-x explícito. */
function isHorizontalScroller(element: Element) {
  if (element.matches('[data-slot=table-container], [data-allow-overflow]')) {
    return true;
  }
  const classes = ` ${element.getAttribute('class') ?? ''} `;
  if (/\s(overflow-x-(auto|scroll)|overflow-(auto|scroll))\s/.test(classes)) {
    return true;
  }
  const style = (element as HTMLElement).style;
  return /(auto|scroll)/.test(style?.overflowX || style?.overflow || '');
}

function isRendered(element: Element) {
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && Number(style.opacity) > 0.01;
}

export function findMobileOverflows(): MobileOverflowProblem[] {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const problems: MobileOverflowProblem[] = [];
  const offending = new Set<Element>();

  for (const element of document.body.querySelectorAll('*')) {
    if (element.matches(IGNORE) || !isRendered(element)) continue;
    const rect = element.getBoundingClientRect();
    const amount = Math.round(Math.max(rect.right - viewportWidth, -rect.left));
    if (amount <= 1) continue;
    // Un elemento fijo que está entero fuera de la pantalla es un panel que
    // entra o sale con una animación.
    if (
      getComputedStyle(element).position === 'fixed' &&
      (rect.left >= viewportWidth || rect.right <= 0)
    ) {
      continue;
    }

    // Dentro de algo que scrollea de costado a propósito (una tabla) está
    // bien. Si lo recorta un overflow-hidden, o queda dentro de una caja que
    // sólo debería scrollear para abajo (un modal: el navegador le agrega el
    // scroll lateral solo), el contenido queda cortado o hay que deslizarlo.
    let kind: MobileOverflowProblem['kind'] = 'page';
    let intentional = false;
    for (
      let ancestor = element.parentElement;
      ancestor && ancestor !== document.body;
      ancestor = ancestor.parentElement
    ) {
      const overflowX = getComputedStyle(ancestor).overflowX;
      if (!/(auto|scroll|hidden|clip)/.test(overflowX)) continue;
      const ancestorRect = ancestor.getBoundingClientRect();
      if (ancestorRect.right > viewportWidth + 1 || ancestorRect.left < -1) {
        continue;
      }
      if (/(auto|scroll)/.test(overflowX) && isHorizontalScroller(ancestor)) {
        intentional = true;
      } else {
        kind = 'clipped';
      }
      break;
    }
    if (intentional) continue;

    offending.add(element);
    if (element.parentElement && offending.has(element.parentElement)) continue;
    problems.push({ kind, amount, description: describe(element), element });
  }

  // Contenido que se sale de su propia caja (un texto que no corta línea y
  // pisa el borde de una barra, un botón o una tarjeta), aunque no llegue al
  // borde de la pantalla.
  const spilled = new Set<Element>();
  for (const element of document.body.querySelectorAll('*')) {
    if (
      element.matches(`${IGNORE}, svg, svg *, input, textarea, select`) ||
      offending.has(element) ||
      element.scrollWidth <= element.clientWidth + 3
    ) {
      continue;
    }
    const style = getComputedStyle(element);
    if (
      style.overflowX !== 'visible' ||
      style.display === 'inline' ||
      style.display === 'contents'
    ) {
      continue;
    }
    const hasBox =
      element.tagName === 'BUTTON' ||
      style.borderLeftWidth !== '0px' ||
      !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor);
    const rect = element.getBoundingClientRect();
    if (
      !hasBox ||
      rect.width < 30 ||
      rect.height < 12 ||
      !isRendered(element)
    ) {
      continue;
    }
    spilled.add(element);
  }
  // Se informa la caja más interna: es la que hay que arreglar.
  for (const element of spilled) {
    const hasInner = [...spilled].some(
      (other) => other !== element && element.contains(other),
    );
    if (hasInner) continue;
    problems.push({
      kind: 'spill',
      amount: element.scrollWidth - element.clientWidth,
      description: describe(element),
      element,
    });
  }

  // Modals, paneles y menús: lo que queda arriba o abajo de la pantalla no se
  // puede alcanzar (el fondo no scrollea), salvo que esté dentro de una caja
  // con scroll o recorte que sí entra en la pantalla.
  for (const dialog of document.querySelectorAll(
    '[role=dialog], [role=alertdialog]',
  )) {
    if (!isRendered(dialog)) continue;
    let missing = 0;
    let culprit: Element = dialog;
    for (const element of [dialog, ...dialog.querySelectorAll('*')]) {
      if (element.matches(IGNORE) || !isRendered(element)) continue;
      const rect = element.getBoundingClientRect();
      const out = Math.round(Math.max(-rect.top, rect.bottom - viewportHeight));
      if (out <= 1 || out <= missing) continue;
      let contained = false;
      for (
        let ancestor = element === dialog ? null : element.parentElement;
        ancestor;
        ancestor = ancestor === dialog ? null : ancestor.parentElement
      ) {
        if (
          !/(auto|scroll|hidden|clip)/.test(
            getComputedStyle(ancestor).overflowY,
          )
        ) {
          continue;
        }
        const box = ancestor.getBoundingClientRect();
        if (box.top >= -1 && box.bottom <= viewportHeight + 1) {
          contained = true;
          break;
        }
      }
      if (contained) continue;
      missing = out;
      culprit = element;
    }
    if (missing > 1) {
      problems.push({
        kind: 'dialog-height',
        amount: missing,
        description: describe(culprit),
        element: culprit,
      });
    }
  }

  return problems;
}
