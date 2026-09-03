import type { ComponentPropsWithRef } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from './cn';

const badgeVariants = cva(['inline-flex items-center justify-center font-medium transition-colors select-none', 'antialiased whitespace-nowrap'], {
    variants: {
        variant: {
            default: 'bg-primary/10 text-primary border border-primary/20',
            primary: 'bg-primary text-primary-foreground border border-primary',
            secondary: 'bg-secondary text-secondary-foreground border border-border',
            muted: 'bg-muted text-muted-foreground border border-border',
            destructive: 'bg-destructive/10 text-destructive border border-destructive/20',
            outline: 'bg-transparent text-foreground border',
            accent: 'bg-accent text-accent-foreground border border-accent/40',
            success: 'bg-success/10 text-success border border-success/20',
            warning: 'bg-warning/10 text-warning border border-warning/20',
        },
        size: {
            xs: 'text-[9px] leading-3 px-1 py-0 font-medium',
            sm: 'text-[11px] leading-4 px-1.5 py-0.5 font-medium',
            md: 'text-xs leading-5 px-2.5 py-0.5 font-semibold',
            lg: 'text-sm leading-6 px-3 py-1 font-semibold',
        },
        shape: {
            rounded: 'rounded-md',
            pill: 'rounded-full',
            square: 'rounded-none',
        },
        stroke: {
            true: 'outline outline-1 -outline-offset-1',
            false: '',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'md',
        shape: 'rounded',
        stroke: false,
    },
});

export type BadgeProps = ComponentPropsWithRef<'span'> & VariantProps<typeof badgeVariants>;

/**
 * Pill and label badge component.
 */
export const Badge = ({ ref, className, size, variant, shape, stroke, children, ...props }: BadgeProps) => {
    return (
        <span
            ref={ref}
            className={cn(
                badgeVariants({
                    variant,
                    size,
                    shape,
                    stroke,
                }),
                className
            )}
            {...props}>
            {children}
        </span>
    );
};

export default Badge;
