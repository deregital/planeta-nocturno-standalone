import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type FormRowProps = HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export function FormRow({ children, className, ...props }: FormRowProps) {
  return (
    <div
      className={cn(
        'flex flex-row gap-3 items-start w-full [&>*]:flex-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
