import { RuleTester } from 'eslint';

import mobileLayoutRule from '../../eslint/rules/mobile-layout.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run('mobile/no-overflowing-classes', mobileLayoutRule, {
  valid: [
    {
      name: 'ancho fluido con tope',
      code: `<Card className='w-full max-w-md mx-auto' />`,
    },
    {
      name: 'anchos fijos chicos o detrás de un breakpoint',
      code: `<div className='w-80 min-w-72 sm:w-xl md:min-w-96 lg:w-[600px] min-[480px]:w-96' />`,
    },
    {
      name: 'grillas de hasta 3 columnas o con breakpoint',
      code: `<div className={cn('grid grid-cols-3', open && 'md:grid-cols-7 sm:grid-cols-5')} />`,
    },
    {
      name: 'DialogContent con max-w propio',
      code: `<DialogContent className='max-w-2xl sm:max-w-xl md:w-full' />`,
    },
    {
      name: 'w-full fuera de un DialogContent',
      code: `<div className='w-full' />`,
    },
    {
      name: 'valores que no son longitudes fijas',
      code: `<div className='w-[calc(100%-2rem)] w-1/2 basis-1/3 w-[90vw] min-w-0 w-screen' />`,
    },
  ],
  invalid: [
    {
      name: 'min-w-96 sin breakpoint (tarjeta de /tickets)',
      code: `<Card className='max-w-md mx-auto m-4 min-w-96' />`,
      errors: [{ messageId: 'fixedWidth' }],
    },
    {
      name: 'ancho arbitrario en px o rem, también con max-md e important',
      code: `<div className={cn('w-[400px]', active ? 'max-md:min-w-[22rem]' : 'basis-96!')} />`,
      errors: [
        { messageId: 'fixedWidth' },
        { messageId: 'fixedWidth' },
        { messageId: 'fixedWidth' },
      ],
    },
    {
      name: 'ancho de contenedor sin breakpoint',
      code: 'const classes = cn(`w-xl ${extra}`);',
      errors: [{ messageId: 'fixedWidth' }],
    },
    {
      name: 'grilla de 5 columnas sin breakpoint',
      code: `<li className='grid grid-cols-5 font-bold' />`,
      errors: [{ messageId: 'rigidGrid' }],
    },
    {
      name: 'w-full en DialogContent le saca el margen',
      code: `<DialogContent className='max-w-xl! md:max-w-3xl! w-full' />`,
      errors: [{ messageId: 'dialogWidth' }],
    },
    {
      name: 'max-w-none en DialogContent dentro de clsx con objeto',
      code: `<DialogContent className={clsx({ 'max-w-none': wide })} />`,
      errors: [{ messageId: 'dialogWidth' }],
    },
  ],
});

console.log('mobile/no-overflowing-classes: ok');
