import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 disabled:select-none cursor-pointer [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-button text-on-accent font-medium text-[12px] sm:text-[16px] leading-[100%] px-8 py-2 rounded-[10px] hover:bg-accent/90',
        accent:
          'bg-accent text-on-accent font-medium text-[12px] sm:text-[16px] leading-[100%] px-8 py-2 rounded-[10px] hover:bg-accent/90',
        outline:
          'bg-transparent border-2 border-button text-accent font-medium text-[12px] sm:text-[16px] leading-[100%] px-8 py-2 rounded-[10px] hover:bg-accent-ultra-light',
        ghost: 'hover:bg-accent/10 text-accent',
        destructive: 'bg-red-500 text-white',
        success: 'bg-green-500 text-white hover:bg-green-500/90',
      },

      size: {
        icon: 'size-8 p-1',
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
