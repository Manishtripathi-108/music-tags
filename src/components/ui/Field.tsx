'use client';

import * as React from 'react';
import { Field as ArkField } from '@ark-ui/react/field';
import { cn } from '@/lib/utils';

export const Field = React.forwardRef<
    React.ComponentRef<typeof ArkField.Root>,
    React.ComponentPropsWithoutRef<typeof ArkField.Root>
>(({ className, ...props }, ref) => (
    <ArkField.Root
        ref={ref}
        className={cn('group flex w-full flex-col gap-1 text-xs data-disabled:opacity-60', className)}
        {...props}
    />
));
Field.displayName = 'Field';

export const FieldLabel = React.forwardRef<
    React.ComponentRef<typeof ArkField.Label>,
    React.ComponentPropsWithoutRef<typeof ArkField.Label>
>(({ className, ...props }, ref) => (
    <ArkField.Label
        ref={ref}
        className={cn(
            'flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground select-none group-data-disabled:cursor-not-allowed group-data-invalid:text-destructive',
            className
        )}
        {...props}
    />
));
FieldLabel.displayName = 'FieldLabel';

export const FieldInput = React.forwardRef<
    React.ComponentRef<typeof ArkField.Input>,
    React.ComponentPropsWithoutRef<typeof ArkField.Input>
>(({ className, ...props }, ref) => (
    <ArkField.Input
        ref={ref}
        className={cn(
            'flex h-8 w-full rounded-md border border-border bg-input px-2.5 py-1 text-xs text-foreground shadow-2xs transition-all duration-150 placeholder:text-muted-foreground/60',
            'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-invalid:border-destructive/70 data-invalid:focus-visible:ring-destructive/20',
            className
        )}
        {...props}
    />
));
FieldInput.displayName = 'FieldInput';

export const FieldTextarea = React.forwardRef<
    React.ComponentRef<typeof ArkField.Textarea>,
    React.ComponentPropsWithoutRef<typeof ArkField.Textarea>
>(({ className, ...props }, ref) => (
    <ArkField.Textarea
        ref={ref}
        className={cn(
            'flex min-h-16 w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs text-foreground shadow-2xs transition-all duration-150 placeholder:text-muted-foreground/60',
            'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-invalid:border-destructive/70 data-invalid:focus-visible:ring-destructive/20',
            className
        )}
        {...props}
    />
));
FieldTextarea.displayName = 'FieldTextarea';

export const FieldSelect = React.forwardRef<
    React.ComponentRef<typeof ArkField.Select>,
    React.ComponentPropsWithoutRef<typeof ArkField.Select>
>(({ className, ...props }, ref) => (
    <ArkField.Select
        ref={ref}
        className={cn(
            'flex h-8 w-full appearance-none rounded-md border border-border bg-input px-2.5 py-1 text-xs text-foreground shadow-2xs transition-all duration-150',
            'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-invalid:border-destructive/70 data-invalid:focus-visible:ring-destructive/20',
            className
        )}
        {...props}
    />
));
FieldSelect.displayName = 'FieldSelect';

export const FieldHelperText = React.forwardRef<
    React.ComponentRef<typeof ArkField.HelperText>,
    React.ComponentPropsWithoutRef<typeof ArkField.HelperText>
>(({ className, ...props }, ref) => (
    <ArkField.HelperText
        ref={ref}
        className={cn('text-[11px] text-muted-foreground leading-normal', className)}
        {...props}
    />
));
FieldHelperText.displayName = 'FieldHelperText';

export const FieldErrorText = React.forwardRef<
    React.ComponentRef<typeof ArkField.ErrorText>,
    React.ComponentPropsWithoutRef<typeof ArkField.ErrorText>
>(({ className, ...props }, ref) => (
    <ArkField.ErrorText
        ref={ref}
        className={cn('text-[11px] font-medium text-destructive leading-normal', className)}
        {...props}
    />
));
FieldErrorText.displayName = 'FieldErrorText';

export const FieldRequiredIndicator = React.forwardRef<
    React.ComponentRef<typeof ArkField.RequiredIndicator>,
    React.ComponentPropsWithoutRef<typeof ArkField.RequiredIndicator>
>(({ className, ...props }, ref) => (
    <ArkField.RequiredIndicator
        ref={ref}
        className={cn('text-destructive font-bold ml-0.5', className)}
        {...props}
    />
));
FieldRequiredIndicator.displayName = 'FieldRequiredIndicator';

export const FieldHelper = FieldHelperText;
export const FieldError = FieldErrorText;
