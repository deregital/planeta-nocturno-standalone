import type { Route } from 'next';

import Link from 'next/link';

import { CONSUMER_COMPLAINTS_URL } from '@/lib/legal';
import { WITHDRAWAL_PATH } from '@/lib/withdrawal';

/**
 * Pie de las páginas públicas: el botón de arrepentimiento, los textos legales
 * y el link de reclamos.
 */
export function LegalFooter() {
  return (
    <footer className='border-t border-accent-dark/10 px-4 py-4'>
      <nav
        aria-label='Información legal'
        className='mx-auto flex max-w-screen-2xl flex-wrap justify-center gap-x-5 gap-y-2 text-center text-xs text-accent-dark/70'
      >
        {/* Disp. SSDCyLC 954/2025: visible desde el primer acceso, sin login. */}
        <Link
          href={WITHDRAWAL_PATH as Route}
          className='font-semibold text-accent-dark underline underline-offset-2'
        >
          Botón de arrepentimiento
        </Link>
        <Link href='/terminos' className='underline-offset-2 hover:underline'>
          Términos y condiciones
        </Link>
        <Link href='/privacidad' className='underline-offset-2 hover:underline'>
          Política de privacidad
        </Link>
        <a
          href={CONSUMER_COMPLAINTS_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='underline-offset-2 hover:underline'
        >
          Defensa de las y los consumidores. Para reclamos ingrese aquí
        </a>
      </nav>
    </footer>
  );
}
