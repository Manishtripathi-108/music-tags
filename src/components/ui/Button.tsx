import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
    [
        'group relative inline-flex shrink-0 items-center justify-center',
        'cursor-pointer select-none',
        'overflow-hidden',
        'font-medium',
        'transition-all duration-200',
        'outline-none',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70',
        'focus-visible:ring-2 focus-visible:ring-primary/50',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
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
                    '[--button-from:color-mix(in_oklch,var(--color-surface-900)_90%,black)]',
                    '[--button-via:var(--color-surface-700)]',
                    '[--button-to:var(--color-surface-500)]',
                    '[--button-inner-from:var(--color-surface-800)]',
                    '[--button-inner-to:var(--color-surface-700)]',
                    '[--button-ring:var(--color-surface-500)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],
                outline: [
                    '[--button-ring:var(--color-primary)]',

                    'bg-transparent',
                    'text-primary',
                    'ring-1 ring-inset ring-primary/30',

                    'hover:bg-primary/5',
                    'hover:ring-primary/50',
                ],
                ghost: [
                    '[--button-ring:var(--color-primary)]',

                    'bg-transparent',
                    'text-surface-700',
                    'dark:text-surface-300',

                    'hover:bg-surface-100',
                    'dark:hover:bg-surface-800',
                ],
                destructive: [
                    '[--button-from:color-mix(in_oklch,var(--color-red-600)_75%,black)]',
                    '[--button-via:var(--color-red-600)]',
                    '[--button-to:color-mix(in_oklch,var(--color-red-600)_82%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-red-600)_88%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-red-600)_94%,white)]',
                    '[--button-ring:var(--color-red-500)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],

                success: [
                    '[--button-from:color-mix(in_oklch,var(--color-green-600)_75%,black)]',
                    '[--button-via:var(--color-green-600)]',
                    '[--button-to:color-mix(in_oklch,var(--color-green-600)_82%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-green-600)_88%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-green-600)_94%,white)]',
                    '[--button-ring:var(--color-green-500)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],
                warning: [
                    '[--button-from:color-mix(in_oklch,var(--color-yellow-600)_75%,black)]',
                    '[--button-via:var(--color-yellow-500)]',
                    '[--button-to:color-mix(in_oklch,var(--color-yellow-500)_82%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-yellow-500)_88%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-yellow-500)_94%,white)]',
                    '[--button-ring:var(--color-yellow-500)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],
                info: [
                    '[--button-from:color-mix(in_oklch,var(--color-blue-600)_75%,black)]',
                    '[--button-via:var(--color-blue-600)]',
                    '[--button-to:color-mix(in_oklch,var(--color-blue-600)_82%,white)]',
                    '[--button-inner-from:color-mix(in_oklch,var(--color-blue-600)_88%,black)]',
                    '[--button-inner-to:color-mix(in_oklch,var(--color-blue-600)_94%,white)]',
                    '[--button-ring:var(--color-blue-500)]',

                    'bg-linear-to-t',
                    'from-(--button-from)',
                    'via-(--button-via)',
                    'to-(--button-to)',
                ],
                link: ['bg-transparent', 'text-primary', 'underline-offset-4', 'hover:underline'],
            },

            size: {
                xs: ['min-h-7', 'rounded-sm', 'p-px', 'text-xs'],
                sm: ['min-h-8', 'rounded-md', 'p-0.5', 'text-sm'],
                md: ['min-h-10', 'rounded-2xl', 'p-0.5', 'text-sm'],
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
    ['flex h-full w-full items-center justify-center', 'gap-2', 'rounded-[inherit]', 'text-white', 'wg-antialiased', 'transition-all duration-200'],
    {
        variants: {
            variant: {
                primary: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)', 'shadow-sm', 'group-hover:brightness-105'],
                secondary: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)'],
                outline: ['bg-transparent', 'text-primary'],
                ghost: ['bg-transparent', 'text-inherit'],
                destructive: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)', 'shadow-sm', 'group-hover:brightness-105'],
                success: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)', 'shadow-sm', 'group-hover:brightness-105'],
                warning: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)', 'text-surface-950', 'shadow-sm'],
                info: ['bg-linear-to-t', 'from-(--button-inner-from)', 'to-(--button-inner-to)', 'shadow-sm', 'group-hover:brightness-105'],
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

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

const Button = ({ className, variant, size, fullWidth, children, type = 'button', ...props }: ButtonProps) => {
    return (
        <button
            type={type}
            className={cn(
                buttonVariants({
                    variant,
                    size,
                    fullWidth,
                }),
                className
            )}
            {...props}>
            <span
                className={cn(
                    buttonInnerVariants({
                        variant,
                        size,
                    })
                )}>
                {children}
            </span>
        </button>
    );
};

export { Button };

export default Button;
