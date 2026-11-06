'use client';

import * as React from 'react';

import { NumberInput as ArkNumberInput } from '@ark-ui/react/number-input';

import Icon from '@/components/ui/Icon';

import { cn } from './cn';
import { DISABLED, FIELD_CONTROL_STYLES, FOCUS_RING } from './tailwind.helpers';

export function NumberInput({ ref, className, ...props }: React.ComponentProps<typeof ArkNumberInput.Root>) {
    return (
        <ArkNumberInput.Root
            {...props}
            ref={ref}
            className={cn('group relative flex w-full flex-col gap-1 text-xs', 'data-disabled:opacity-60', className)}
        />
    );
}

export function NumberInputLabel({ ref, className, ...props }: React.ComponentProps<typeof ArkNumberInput.Label>) {
    return (
        <ArkNumberInput.Label
            {...props}
            ref={ref}
            className={cn(
                'text-muted-foreground',
                'flex items-center gap-1',
                'font-mono text-[11px] font-semibold',
                'select-none',
                'group-data-disabled:cursor-not-allowed',
                'group-data-invalid:text-destructive',
                className
            )}
        />
    );
}

export function NumberInputControl({ ref, className, ...props }: React.ComponentProps<typeof ArkNumberInput.Control>) {
    return (
        <ArkNumberInput.Control
            {...props}
            ref={ref}
            className={cn('relative isolate flex w-full items-center', 'group-data-invalid:text-destructive', className)}
        />
    );
}

export function NumberInputInput({ ref, className, ...props }: React.ComponentProps<typeof ArkNumberInput.Input>) {
    return (
        <ArkNumberInput.Input
            {...props}
            ref={ref}
            className={cn(
                FIELD_CONTROL_STYLES,

                // Number inputs should use tabular numerals.
                'font-mono tabular-nums',

                // Keep browser number controls from competing
                // with our custom Ark triggers.
                '[appearance:textfield]',
                '[&::-webkit-inner-spin-button]:appearance-none',
                '[&::-webkit-outer-spin-button]:appearance-none',

                className
            )}
        />
    );
}

export function NumberInputIncrementTrigger({ ref, className, children, ...props }: React.ComponentProps<typeof ArkNumberInput.IncrementTrigger>) {
    return (
        <ArkNumberInput.IncrementTrigger
            {...props}
            ref={ref}
            className={cn(
                'flex h-1/2 w-full',
                'cursor-pointer items-center justify-center',
                'text-muted-foreground',
                'transition-colors duration-100',

                'hover:bg-accent hover:text-foreground',
                'active:bg-accent/80',

                FOCUS_RING,
                DISABLED,

                className
            )}>
            {children ?? <Icon icon="up" aria-hidden="true" className="size-2.5" />}
        </ArkNumberInput.IncrementTrigger>
    );
}

export function NumberInputDecrementTrigger({ ref, className, children, ...props }: React.ComponentProps<typeof ArkNumberInput.DecrementTrigger>) {
    return (
        <ArkNumberInput.DecrementTrigger
            {...props}
            ref={ref}
            className={cn(
                'flex h-1/2 w-full',
                'cursor-pointer items-center justify-center',
                'border-border/80 border-t',
                'text-muted-foreground',
                'transition-colors duration-100',

                'hover:bg-accent hover:text-foreground',
                'active:bg-accent/80',

                FOCUS_RING,
                DISABLED,

                className
            )}>
            {children ?? <Icon icon="down" aria-hidden="true" className="size-2.5" />}
        </ArkNumberInput.DecrementTrigger>
    );
}

export function NumberInputScrubber({ ref, className, ...props }: React.ComponentProps<typeof ArkNumberInput.Scrubber>) {
    return (
        <ArkNumberInput.Scrubber
            {...props}
            ref={ref}
            className={cn(
                'absolute inset-y-px left-px z-10',
                'flex w-6 items-center justify-center',
                'cursor-ew-resize select-none',
                'text-muted-foreground',
                'transition-colors duration-100',
                'hover:text-foreground',

                'data-scrubbing:text-primary',

                DISABLED,

                className
            )}
        />
    );
}

export function NumberInputValueText({ ref, className, ...props }: React.ComponentProps<typeof ArkNumberInput.ValueText>) {
    return (
        <ArkNumberInput.ValueText
            {...props}
            ref={ref}
            className={cn('text-foreground', 'font-mono text-xs tabular-nums', 'data-invalid:text-destructive', className)}
        />
    );
}

export interface NumberInputFieldProps extends React.ComponentProps<typeof ArkNumberInput.Root> {
    label?: React.ReactNode;
    placeholder?: string;
    inputClassName?: string;
    error?: React.ReactNode;
}

export function NumberInputField({ ref, label, placeholder, inputClassName, className, error, invalid, ...props }: NumberInputFieldProps) {
    const isInvalid = invalid || !!error;

    return (
        <NumberInput {...props} ref={ref} invalid={isInvalid} className={className}>
            {label && <NumberInputLabel>{label}</NumberInputLabel>}

            <NumberInputControl>
                <NumberInputInput placeholder={placeholder} className={inputClassName} />

                <div
                    className={cn(
                        'absolute inset-y-px right-px z-10',
                        'flex w-6 flex-col',
                        'overflow-hidden',
                        'rounded-r-md',
                        'border-border/80 border-l',
                        'bg-muted/30'
                    )}
                    aria-hidden="true">
                    <NumberInputIncrementTrigger />
                    <NumberInputDecrementTrigger />
                </div>
            </NumberInputControl>

            {error && (
                <div role="alert" title={typeof error === 'string' ? error : undefined} className={cn('text-destructive', 'flex items-center gap-1', 'font-mono text-[10px]', 'leading-tight font-medium')}>
                    <Icon icon="warning" aria-hidden="true" className="size-2.5 shrink-0" />

                    <span className="min-w-0 truncate">{error}</span>
                </div>
            )}
        </NumberInput>
    );
}

export default NumberInput;
