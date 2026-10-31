import { GripVertical } from 'lucide-react';
import { type ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export default function EventListDragHandle({
  className,
  disabled,
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      type='button'
      disabled={disabled}
      aria-label='Reordenar'
      className={cn(
        'flex shrink-0 items-center text-on-accent disabled:opacity-100',
        className,
        disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical className={cn('size-4', disabled && 'opacity-40')} />
    </button>
  );
}
