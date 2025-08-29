import { cn } from '@/lib/utils';

export function FilledCard({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'border border-stroke rounded-md bg-accent-ultra-light gap-4',
        className,
      )}
      {...props}
    />
  );
}
