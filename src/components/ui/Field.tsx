'use client';

import * as React from 'react';

import { Field as ArkField } from '@ark-ui/react/field';

import Icon from '@/components/ui/Icon';

import { cn } from './cn';
import { FIELD_CONTROL_STYLES } from './tailwind.helpers';

export function Field({ className, ...props }: React.ComponentProps<typeof ArkField.Root>) {
    return <ArkField.Root {...props} className={cn('group flex w-full flex-col gap-1 text-xs', 'data-disabled:opacity-60', className)} />;
}

export function FieldLabel({ className, ...props }: React.ComponentProps<typeof ArkField.Label>) {
    return (
        <ArkField.Label
            {...props}
            className={cn(
                'text-muted-foreground',
                'group-data-invalid:text-destructive',
                'flex items-center gap-1',
                'font-mono text-[11px] font-semibold',
                'select-none',
                'group-data-disabled:cursor-not-allowed',
                className
            )}
        />
    );
}

export function FieldInput({ ref, className, ...props }: React.ComponentProps<typeof ArkField.Input>) {
    return <ArkField.Input {...props} ref={ref} className={cn(FIELD_CONTROL_STYLES, className)} />;
}

export function FieldTextarea({ ref, className, ...props }: React.ComponentProps<typeof ArkField.Textarea>) {
    return <ArkField.Textarea {...props} ref={ref} className={cn(FIELD_CONTROL_STYLES, 'min-h-16 resize-y', className)} />;
}

export function FieldSelect({ ref, className, ...props }: React.ComponentProps<typeof ArkField.Select>) {
    return <ArkField.Select {...props} ref={ref} className={cn(FIELD_CONTROL_STYLES, className)} />;
}

export function FieldHelperText({ className, ...props }: React.ComponentProps<typeof ArkField.HelperText>) {
    return <ArkField.HelperText {...props} className={cn('text-muted-foreground', 'text-[11px] leading-normal', className)} />;
}

export function FieldErrorText({ className, children, title, ...props }: React.ComponentProps<typeof ArkField.ErrorText>) {
    return (
        <ArkField.ErrorText
            title={title || (typeof children === 'string' ? children : undefined)}
            {...props}
            className={cn('text-destructive', 'flex items-center gap-1', 'text-[11px] leading-tight font-medium', className)}>
            {typeof children === 'string' ? (
                <>
                    <Icon icon="warning" aria-hidden="true" className="size-3 shrink-0" />
                    <span>{children}</span>
                </>
            ) : (
                children
            )}
        </ArkField.ErrorText>
    );
}

export function FieldRequiredIndicator({ className, ...props }: React.ComponentProps<typeof ArkField.RequiredIndicator>) {
    return <ArkField.RequiredIndicator {...props} className={cn('text-destructive ml-0.5', className)} />;
}

export const FieldHelper = FieldHelperText;
export const FieldError = FieldErrorText;

Field.Root = ArkField.Root;
Field.Label = FieldLabel;
Field.Input = FieldInput;
Field.Textarea = FieldTextarea;
Field.Select = FieldSelect;
Field.HelperText = FieldHelperText;
Field.ErrorText = FieldErrorText;
Field.RequiredIndicator = FieldRequiredIndicator;
Field.Context = ArkField.Context;

export default Field;
