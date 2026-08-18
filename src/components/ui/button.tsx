import * as React from 'react';

import { ark } from '@ark-ui/react/factory';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-200',
                destructive: 'bg-red-900 text-zinc-100 shadow-sm hover:bg-red-800',
                outline: 'border border-zinc-800 bg-zinc-900/50 shadow-sm hover:bg-zinc-800 hover:text-zinc-100',
                secondary: 'bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700',
                ghost: 'hover:bg-zinc-800 hover:text-zinc-100',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-7 px-3 py-1',
                sm: 'h-6 rounded px-2 text-xs',
                lg: 'h-8 rounded px-4',
                icon: 'h-7 w-7',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
    return <ark.button asChild={asChild} className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
