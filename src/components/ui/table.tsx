'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Sombra en el borde mientras quede tabla por deslizar: en el celular las
 * columnas de la derecha (Estado, Total, Acciones) quedaban afuera sin ninguna
 * pista de que la tabla se mueve.
 */
function useHorizontalOverflow() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      setEdges({
        left: element.scrollLeft > 4,
        right:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
      });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  return { ref, edges };
}

function Table({
  className,
  fullWidth,
  ...props
}: React.ComponentProps<'table'> & { fullWidth?: boolean }) {
  const { ref, edges } = useHorizontalOverflow();

  return (
    <div
      className={cn(
        'relative w-full',
        fullWidth &&
          'max-w-full w-[calc(100vw-20px)] md:w-[calc(100vw-20px-var(--sidebar-width))]',
      )}
    >
      <div
        ref={ref}
        data-slot='table-container'
        className='overflow-x-auto w-full'
      >
        <table
          data-slot='table'
          className={cn('caption-bottom text-sm w-full', className)}
          {...props}
        />
      </div>
      {edges.left && (
        <div
          aria-hidden
          className='pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/15 to-transparent'
        />
      )}
      {edges.right && (
        <div
          aria-hidden
          className='pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/15 to-transparent'
        />
      )}
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot='table-header'
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot='table-body'
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        'bg-accent-ultra-light/50 border-t font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={cn(
        'hover:bg-accent-ultra-light/50 data-[state=selected]:bg-accent-ultra-light/50 border-b border-stroke transition-colors',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={cn(
        'text-accent h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('text-accent mt-4 text-sm', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
