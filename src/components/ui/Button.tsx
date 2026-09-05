import type { ComponentProps } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from './cn';
import { DISABLED, FOCUS_RING } from './tailwind.helpers';

const buttonVariants = cva(
    [
        'group relative inline-flex shrink-0 items-center justify-center',
        'cursor-pointer select-none',
        'overflow-hidden',
        'transition-all duration-200',
        'outline-none',
        'active:scale-90',
    ],
    {
        variants: {
            variant: {
                primary: [
                    '[--button-from:color-mix(in_oklch,var(--color-primary)_72%,black)]',
                    '[--button-via:var(--color-primary)]',
                    '[--button-to:color-mix(in_oklch,var(--color-primary)_72%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-primary)_84%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-primary)_92%,white)]',
                    '[--button-ring:var(--color-primary)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',

                    'hover:[--button-from:color-mix(in_oklch,var(--color-primary)_65%,black)]',
                    'hover:[--button-to:color-mix(in_oklch,var(--color-primary)_78%,white)]',
                ],
                secondary: [
                    '[--button-from:color-mix(in_oklch,var(--color-secondary)_90%,black)]',
                    '[--button-via:var(--color-secondary)]',
                    '[--button-to:color-mix(in_oklch,var(--color-secondary)_80%,white)]',
                    '[--button-inner-from:var(--color-secondary)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-secondary)_90%,white)]',
                    '[--button-ring:var(--color-secondary)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],
                outline: [
                    '[--button-ring:var(--color-primary)]',

                    'bg-transparent',
                    'text-foreground',
                    'border border-border',

                    'hover:bg-muted/80',
                    'hover:text-foreground',
                ],
                ghost: [
                    '[--button-ring:var(--color-primary)]',

                    'bg-transparent',
                    'text-muted-foreground',

                    'hover:bg-muted/80',
                    'hover:text-foreground',
                ],
                destructive: [
                    '[--button-from:color-mix(in_oklch,var(--color-destructive)_75%,black)]',
                    '[--button-via:var(--color-destructive)]',
                    '[--button-to:color-mix(in_oklch,var(--color-destructive)_82%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-destructive)_88%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-destructive)_94%,white)]',
                    '[--button-ring:var(--color-destructive)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],

                success: [
                    '[--button-from:color-mix(in_oklch,var(--color-success)_75%,black)]',
                    '[--button-via:var(--color-success)]',
                    '[--button-to:color-mix(in_oklch,var(--color-success)_82%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-success)_88%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-success)_94%,white)]',
                    '[--button-ring:var(--color-success)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],
                warning: [
                    '[--button-from:color-mix(in_oklch,var(--color-warning)_75%,black)]',
                    '[--button-via:var(--color-warning)]',
                    '[--button-to:color-mix(in_oklch,var(--color-warning)_82%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-warning)_88%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-warning)_94%,white)]',
                    '[--button-ring:var(--color-warning)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],
                link: ['bg-transparent', 'text-primary', 'underline-offset-4', 'hover:underline'],
            },

            size: {
                xs: ['min-h-7', 'rounded-sm', 'p-px', 'text-xs'],
                sm: ['min-h-8', 'rounded-md', 'p-0.5', 'text-xs'],
                md: ['min-h-10', 'rounded-2xl', 'p-0.5', 'text-xs'],
                lg: ['min-h-11', 'rounded-2xl', 'p-0.5', 'text-base'],
                xl: ['min-h-12', 'rounded-2xl', 'p-0.5', 'text-lg'],
            },

            fullWidth: {
                true: 'w-full',
                false: 'w-auto',
            },
        },

        defaultVariants: {
            variant: 'primary',
            size: 'sm',
            fullWidth: false,
        },
    }
);

const buttonInnerVariants = cva(
    ['flex h-full w-full items-center justify-center', 'gap-2', 'rounded-[inherit]', 'wg-antialiased', 'transition-all duration-200'],
    {
        variants: {
            variant: {
                primary: [
                    'bg-linear-to-t',
                    'from-(--button-inner-from)',
                    'to-(--button-inner-to)',
                    'text-primary-foreground',
                    'shadow-xs',
                    'group-hover:brightness-105',
                ],
                secondary: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)', 'text-secondary-foreground'],
                outline: ['bg-transparent', 'text-foreground'],
                ghost: ['bg-transparent', 'text-inherit'],
                destructive: [
                    'bg-linear-to-t',
                    'from-(--button-inner-from)',
                    'to-(--button-inner-to)',
                    'text-destructive-foreground',
                    'shadow-xs',
                    'group-hover:brightness-105',
                ],
                success: [
                    'bg-linear-to-t',
                    'from-(--button-inner-from)',
                    'to-(--button-inner-to)',
                    'text-success-foreground',
                    'shadow-xs',
                    'group-hover:brightness-105',
                ],
                warning: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)', 'text-warning-foreground', 'shadow-xs'],
                link: ['bg-transparent', 'text-primary'],
            },

            size: {
                xs: 'rounded-[calc(theme(borderRadius.sm)-1px)] px-2 py-1',
                sm: 'rounded-[calc(theme(borderRadius.md)-2px)] px-3 py-1.5',
                md: 'rounded-[14px] px-4 py-2',
                lg: 'rounded-[14px] px-5 py-2.5',
                xl: 'rounded-[14px] px-8 py-3',
            },
        },

        defaultVariants: {
            variant: 'primary',
            size: 'sm',
        },
    }
);

export type ButtonProps = ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        innerClassName?: string;
    };

const Button = ({ className, innerClassName, variant, size, fullWidth, children, type = 'button', ...props }: ButtonProps) => {
    return (
        <button
            type={type}
            className={cn(
                buttonVariants({
                    variant,
                    size,
                    fullWidth,
                }),
                DISABLED,
                FOCUS_RING,
                className
            )}
            {...props}>
            <span
                className={cn(
                    buttonInnerVariants({
                        variant,
                        size,
                    }),
                    innerClassName
                )}>
                {children}
            </span>
        </button>
    );
};

export { Button };

export default Button;
