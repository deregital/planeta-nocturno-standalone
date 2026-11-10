'use client';

import { useEffect, useState } from 'react';

import {
  findMobileOverflows,
  type MobileOverflowProblem,
} from '@/lib/mobile-overflow';

const MARK = 'data-mobile-overflow';
const STORAGE_KEY = 'mobile-overflow-watcher';
const KIND_LABEL: Record<MobileOverflowProblem['kind'], string> = {
  page: 'se sale de la pantalla',
  clipped: 'no entra en su caja: queda cortado o hay que deslizarlo de costado',
  spill: 'el contenido se sale de su caja',
  'dialog-height': 'modal más alto que la pantalla y sin scroll',
};

/**
 * Sólo en `next dev`: marca en rojo y avisa por consola lo que se sale de la
 * pantalla o un modal que no entra a lo alto. Probalo con el modo celular de
 * las devtools (360px). Para apagarlo:
 * localStorage.setItem('mobile-overflow-watcher', 'off').
 * Un contenedor que desborda a propósito lleva `data-allow-overflow`.
 */
export default function MobileOverflowWatcher() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'off') return;
    } catch {
      // Sin storage: el aviso queda prendido.
    }

    const style = document.createElement('style');
    style.textContent = `[${MARK}]{outline:2px dashed #ff1f1f!important;outline-offset:-2px!important}`;
    document.head.appendChild(style);

    const reported = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      for (const element of document.querySelectorAll(`[${MARK}]`)) {
        element.removeAttribute(MARK);
      }
      const problems = findMobileOverflows();
      for (const problem of problems) {
        problem.element.setAttribute(MARK, problem.kind);
        const key = `${location.pathname} ${problem.kind} ${problem.description}`;
        if (reported.has(key)) continue;
        reported.add(key);
        console.warn(
          `[mobile] ${KIND_LABEL[problem.kind]} (${problem.amount}px a ${document.documentElement.clientWidth}px de ancho): ${problem.description}`,
          problem.element,
        );
      }
      setCount(problems.length);
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 700);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-state', 'open'],
    });
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      style.remove();
    };
  }, []);

  if (count === 0) return null;
  return (
    <div
      data-allow-overflow
      role='status'
      className='fixed bottom-2 left-2 z-[9999] rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-lg'
    >
      {count} {count === 1 ? 'desborde' : 'desbordes'} mobile (ver consola)
    </div>
  );
}
