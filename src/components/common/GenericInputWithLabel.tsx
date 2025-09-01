import React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface GenericInputWithLabelProps {
  label: string;
  id: string;
  className?: string;
  children: React.ReactElement;
  required?: boolean;
  error?: string;
}

export default function GenericInputWithLabel({
  label,
  id,
  className,
  children,
  required,
  error,
}: GenericInputWithLabelProps) {
  const childrenClassName = cn(
    (children.props as { className?: string }).className,
    error
      ? '[&_[data-slot="input"]]:border-2 [&_[data-slot="input"]]:border-red-500'
      : 'border-stroke placeholder:text-accent-dark/40 py-2',
  );

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={id} className='pl-1 text-accent gap-[2px]'>
        {label}
        {required && <span className='text-red-500'>*</span>}
      </Label>
      {
        React.cloneElement(children, {
          // @ts-expect-error the class name is not in the props
          className: childrenClassName,
        }) as React.ReactElement
      }
      {error && <p className='pl-1 font-bold text-xs text-red-500'>{error}</p>}
    </div>
  );
}
