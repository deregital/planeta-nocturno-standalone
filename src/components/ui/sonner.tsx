'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className='toaster group [&_li]:bg-accent-light [&_li]:text-accent-dark [&_li]:border-stroke'
      toastOptions={{
        style: {
          background: 'var(--accent-ultra-light-color)',
          color: 'var(--accent-dark-color)',
          border: 'var(--stroke-color)',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
