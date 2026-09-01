'use client';

import * as React from 'react';
import { NumberInput as ArkNumberInput } from '@ark-ui/react/number-input';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export const NumberInput = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.Root>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.Root>
>(({ className, ...props }, ref) => (
    <ArkNumberInput.Root
        ref={ref}
        className={cn('group relative flex w-full flex-col gap-1 text-xs data-[disabled]:opacity-60', className)}
        {...props}
    />
));
NumberInput.displayName = 'NumberInput';

export const NumberInputLabel = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.Label>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.Label>
>(({ className, ...props }, ref) => (
    <ArkNumberInput.Label
        ref={ref}
        className={cn('flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground select-none', className)}
        {...props}
    />
));
NumberInputLabel.displayName = 'NumberInputLabel';

export const NumberInputControl = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.Control>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.Control>
>(({ className, ...props }, ref) => (
    <ArkNumberInput.Control
        ref={ref}
        className={cn('relative isolate flex w-full items-center', className)}
        {...props}
    />
));
NumberInputControl.displayName = 'NumberInputControl';

export const NumberInputInput = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.Input>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.Input>
>(({ className, ...props }, ref) => (
    <ArkNumberInput.Input
        ref={ref}
        className={cn(
            'flex h-8 w-full rounded-md border border-border bg-input/40 pr-7 pl-2.5 font-mono text-xs tabular-nums text-foreground shadow-2xs transition-all duration-150 placeholder:text-muted-foreground/60',
            'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[invalid]:border-destructive/70 data-[invalid]:focus-visible:ring-destructive/20',
            className
        )}
        {...props}
    />
));
NumberInputInput.displayName = 'NumberInputInput';

export const NumberInputIncrementTrigger = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.IncrementTrigger>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.IncrementTrigger>
>(({ className, children, ...props }, ref) => (
    <ArkNumberInput.IncrementTrigger
        ref={ref}
        className={cn(
            'flex h-1/2 w-full cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-40',
            className
        )}
        {...props}>
        {children ?? <Icon icon="up" className="size-2.5" />}
    </ArkNumberInput.IncrementTrigger>
));
NumberInputIncrementTrigger.displayName = 'NumberInputIncrementTrigger';

export const NumberInputDecrementTrigger = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.DecrementTrigger>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.DecrementTrigger>
>(({ className, children, ...props }, ref) => (
    <ArkNumberInput.DecrementTrigger
        ref={ref}
        className={cn(
            'flex h-1/2 w-full cursor-pointer items-center justify-center border-t border-border/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-40',
            className
        )}
        {...props}>
        {children ?? <Icon icon="down" className="size-2.5" />}
    </ArkNumberInput.DecrementTrigger>
));
NumberInputDecrementTrigger.displayName = 'NumberInputDecrementTrigger';

export const NumberInputScrubber = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.Scrubber>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.Scrubber>
>(({ className, ...props }, ref) => (
    <ArkNumberInput.Scrubber
        ref={ref}
        className={cn(
            'absolute inset-y-px left-px flex w-6 cursor-ew-resize items-center justify-center text-muted-foreground select-none z-1 hover:text-foreground',
            className
        )}
        {...props}
    />
));
NumberInputScrubber.displayName = 'NumberInputScrubber';

export const NumberInputValueText = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.ValueText>,
    React.ComponentPropsWithoutRef<typeof ArkNumberInput.ValueText>
>(({ className, ...props }, ref) => (
    <ArkNumberInput.ValueText
        ref={ref}
        className={cn('font-mono text-xs tabular-nums text-foreground', className)}
        {...props}
    />
));
NumberInputValueText.displayName = 'NumberInputValueText';

/**
 * Convenient Stepper Component: Bundles Input with Up/Down buttons in one tidy component
 */
export interface NumberInputFieldProps extends React.ComponentPropsWithoutRef<typeof ArkNumberInput.Root> {
    label?: string;
    placeholder?: string;
    inputClassName?: string;
    error?: string;
}

export const NumberInputField = React.forwardRef<
    React.ComponentRef<typeof ArkNumberInput.Root>,
    NumberInputFieldProps
>(({ label, placeholder, inputClassName, className, error, invalid, ...props }, ref) => (
    <NumberInput ref={ref} className={className} invalid={invalid || !!error} {...props}>
        {label && <NumberInputLabel>{label}</NumberInputLabel>}
        <NumberInputControl>
            <NumberInputInput placeholder={placeholder} className={inputClassName} />
            <div className="absolute inset-y-px right-px flex w-6 flex-col overflow-hidden rounded-r-md border-l border-border/80 bg-muted/30 z-1">
                <NumberInputIncrementTrigger />
                <NumberInputDecrementTrigger />
            </div>
        </NumberInputControl>
        {error && (
            <span className="flex items-center gap-1 font-mono text-[10px] font-medium text-destructive leading-tight">
                <Icon icon="warning" className="size-2.5 shrink-0" />
                <span className="truncate">{error}</span>
            </span>
        )}
    </NumberInput>
));
NumberInputField.displayName = 'NumberInputField';

export default NumberInput;
