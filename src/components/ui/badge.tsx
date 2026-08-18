import * as React from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-zinc-800 text-zinc-100',
                secondary: 'border-transparent bg-zinc-800/80 text-zinc-400',
                destructive: 'border-transparent bg-red-950 text-red-400 border-red-850',
                outline: 'text-zinc-400 border-zinc-800',
                success: 'border-emerald-900/50 bg-emerald-950/80 text-emerald-400',
                accent: 'border-blue-900/50 bg-blue-950/80 text-blue-400',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
