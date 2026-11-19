import React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface GenericInputWithLabelProps {
  label?: string;
  id: string;
  className?: string;
  children: React.ReactElement;
  required?: boolean;
  error?: string;
  warning?: string;
}

export default function GenericInputWithLabel({
  label,
  id,
  className,
  children,
  required,
  error,
  warning,
}: GenericInputWithLabelProps) {
  const warningId = warning ? `${id}-warning` : undefined;
  const childrenClassName = cn(
    (children.props as { className?: string }).className,
    error
      ? '[&_[data-slot="input"]]:border-2 [&_[data-slot="input"]]:border-red-500'
      : warning
        ? 'border-amber-500 [&_[data-slot="input"]]:border-amber-500 placeholder:text-accent-dark/40 py-2'
        : 'border-stroke placeholder:text-accent-dark/40 py-2',
  );

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label !== undefined && (
        <Label htmlFor={id} className='pl-1 text-accent gap-[2px]'>
          {label || '\u00A0'}
          {required && <span className='text-red-500'>*</span>}
        </Label>
      )}
      {
        React.cloneElement(children, {
          // @ts-expect-error the class name is not in the props
          className: childrenClassName,
          ...(warningId ? { 'aria-describedby': warningId } : {}),
        }) as React.ReactElement
      }
      {error && <p className='pl-1 font-bold text-xs text-red-500'>{error}</p>}
      {!error && warning && (
        <p
          id={warningId}
          role='status'
          className='pl-1 text-xs font-medium text-amber-300'
        >
          {warning}
        </p>
      )}
    </div>
  );
}
