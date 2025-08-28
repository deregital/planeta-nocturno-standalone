import { cn } from '@/lib/utils';

//TODO: CAMBIAR BG A FILLED COMPONENT EN RETOQUES UI
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
