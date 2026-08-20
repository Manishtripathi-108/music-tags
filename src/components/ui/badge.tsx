import type { ComponentProps, Ref } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/lib/utils/cn';

/* ---------------------------------- Variants --------------------------------- */

export const badgeVariants = cva(
    ['inline-flex items-center justify-center font-medium transition-colors select-none', 'antialiased whitespace-nowrap'],
    {
        variants: {
            variant: {
                default:
                    'bg-primary/10 text-primary border border-primary/20 outline-primary/30 dark:bg-primary/20 dark:text-primary dark:border-primary/30 dark:outline-primary/40',
                primary:
                    'bg-primary/10 text-primary border border-primary/20 outline-primary/30 dark:bg-primary/20 dark:text-primary dark:border-primary/30 dark:outline-primary/40',
                secondary: 'bg-secondary text-secondary-foreground border border-border outline-secondary/20',
                muted: 'bg-muted text-muted-foreground border border-border outline-border',
                destructive:
                    'bg-destructive/10 text-destructive border border-destructive/20 outline-destructive/30 dark:bg-destructive/20 dark:text-destructive dark:border-destructive/30 dark:outline-destructive/40',
                outline: 'bg-transparent text-foreground border border-border outline-border',
                accent: 'bg-accent text-accent-foreground border border-accent/30 outline-accent/40',
                success:
                    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 outline-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 dark:outline-emerald-500/40',
                warning:
                    'bg-amber-500/10 text-amber-600 border border-amber-500/20 outline-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 dark:outline-amber-500/40',
                gray: 'bg-muted text-muted-foreground border border-border outline-border',
                green: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 outline-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 dark:outline-emerald-500/40',
                purple: 'bg-purple-500/10 text-purple-600 border border-purple-500/20 outline-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 dark:outline-purple-500/40',
                orange: 'bg-orange-500/10 text-orange-600 border border-orange-500/20 outline-orange-500/30 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30 dark:outline-orange-500/40',
                red: 'bg-rose-500/10 text-rose-600 border border-rose-500/20 outline-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30 dark:outline-rose-500/40',
                pink: 'bg-pink-500/10 text-pink-600 border border-pink-500/20 outline-pink-500/30 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/30 dark:outline-pink-500/40',
                blue: 'bg-blue-500/10 text-blue-600 border border-blue-500/20 outline-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 dark:outline-blue-400/30',
                yellow: 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/20 outline-yellow-500/30 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30 dark:outline-yellow-400/30',
            },
            size: {
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
    }
);

/* ------------------------------------ Types ----------------------------------- */

export type BadgeElement = HTMLSpanElement;

export type BadgeVariantType =
    | 'default'
    | 'primary'
    | 'secondary'
    | 'muted'
    | 'destructive'
    | 'outline'
    | 'accent'
    | 'success'
    | 'warning'
    | 'gray'
    | 'green'
    | 'purple'
    | 'orange'
    | 'red'
    | 'pink'
    | 'blue'
    | 'yellow';

export type BadgeProps = ComponentProps<'span'> &
    Omit<VariantProps<typeof badgeVariants>, 'variant'> & {
        ref?: Ref<BadgeElement>;
        variant?: BadgeVariantType;
        color?: BadgeVariantType;
    };

/* ---------------------------------- Component --------------------------------- */

const Badge = ({ ref, className, size, variant, color, shape, stroke, children, ...props }: BadgeProps) => {
    const activeVariant = variant ?? color ?? 'default';

    return (
        <span
            ref={ref}
            className={cn(
                badgeVariants({
                    variant: activeVariant,
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

export { Badge };
export default Badge;
