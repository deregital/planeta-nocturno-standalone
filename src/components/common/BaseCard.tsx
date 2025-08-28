import { cn } from '@/lib/utils';

export function BaseCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('border border-stroke rounded-md gap-4', className)}
      {...props}
    />
  );
}
