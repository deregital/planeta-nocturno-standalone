import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type FormRowProps = HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export function FormRow({ children, className, ...props }: FormRowProps) {
  return (
    <div
      className={cn(
        // En el celular un campo por fila: de a dos quedaban de ~150px y no se
        // leía lo escrito (fecha, teléfono).
        'flex flex-col sm:flex-row gap-3 sm:items-start w-full [&>*]:min-w-0 sm:[&>*]:flex-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
