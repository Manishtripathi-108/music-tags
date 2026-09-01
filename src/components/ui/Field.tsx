'use client';

import * as React from 'react';
import { Field as ArkField } from '@ark-ui/react/field';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { DATA_INVALID, DISABLED, FOCUS_RING_PRIMARY } from '@/lib/styles/tailwind.helpers';

const FieldStyles =
    'border-border bg-input text-foreground placeholder:text-muted-foreground/60 flex h-8 w-full px-2.5 py-1 rounded-md border text-xs shadow-2xs transition-all duration-150';

export const Field = React.forwardRef<React.ComponentRef<typeof ArkField.Root>, React.ComponentPropsWithoutRef<typeof ArkField.Root>>(
    ({ className, ...props }, ref) => (
        <ArkField.Root ref={ref} className={cn('group flex w-full flex-col gap-1 text-xs data-disabled:opacity-60', className)} {...props} />
    )
);
Field.displayName = 'Field';

export const FieldLabel = React.forwardRef<React.ComponentRef<typeof ArkField.Label>, React.ComponentPropsWithoutRef<typeof ArkField.Label>>(
    ({ className, ...props }, ref) => (
        <ArkField.Label
            ref={ref}
            className={cn(
                'text-muted-foreground group-data-invalid:text-destructive flex items-center gap-1 font-mono text-[11px] font-semibold select-none group-data-disabled:cursor-not-allowed',
                className
            )}
            {...props}
        />
    )
);
FieldLabel.displayName = 'FieldLabel';

export const FieldInput = React.forwardRef<React.ComponentRef<typeof ArkField.Input>, React.ComponentPropsWithoutRef<typeof ArkField.Input>>(
    ({ className, ...props }, ref) => (
        <ArkField.Input ref={ref} className={cn(FieldStyles, FOCUS_RING_PRIMARY, DATA_INVALID, DISABLED, className)} {...props} />
    )
);
FieldInput.displayName = 'FieldInput';

export const FieldTextarea = React.forwardRef<React.ComponentRef<typeof ArkField.Textarea>, React.ComponentPropsWithoutRef<typeof ArkField.Textarea>>(
    ({ className, ...props }, ref) => (
        <ArkField.Textarea ref={ref} className={cn(FieldStyles, FOCUS_RING_PRIMARY, DATA_INVALID, DISABLED, 'min-h-16', className)} {...props} />
    )
);
FieldTextarea.displayName = 'FieldTextarea';

export const FieldSelect = React.forwardRef<React.ComponentRef<typeof ArkField.Select>, React.ComponentPropsWithoutRef<typeof ArkField.Select>>(
    ({ className, ...props }, ref) => (
        <ArkField.Select ref={ref} className={cn(FieldStyles, FOCUS_RING_PRIMARY, DATA_INVALID, DISABLED, className)} {...props} />
    )
);
FieldSelect.displayName = 'FieldSelect';

export const FieldHelperText = React.forwardRef<
    React.ComponentRef<typeof ArkField.HelperText>,
    React.ComponentPropsWithoutRef<typeof ArkField.HelperText>
>(({ className, ...props }, ref) => (
    <ArkField.HelperText ref={ref} className={cn('text-muted-foreground text-[11px] leading-normal', className)} {...props} />
));
FieldHelperText.displayName = 'FieldHelperText';

export const FieldErrorText = React.forwardRef<
    React.ComponentRef<typeof ArkField.ErrorText>,
    React.ComponentPropsWithoutRef<typeof ArkField.ErrorText>
>(({ className, children, ...props }, ref) => {
    return (
        <ArkField.ErrorText
            ref={ref}
            className={cn('text-destructive flex items-center gap-1 text-[11px] leading-tight font-medium', className)}
            {...props}>
            {typeof children === 'string' ? (
                <>
                    <Icon icon="warning" className="size-3 shrink-0" />
                    <span>{children}</span>
                </>
            ) : (
                children
            )}
        </ArkField.ErrorText>
    );
});
FieldErrorText.displayName = 'FieldErrorText';

export const FieldRequiredIndicator = React.forwardRef<
    React.ComponentRef<typeof ArkField.RequiredIndicator>,
    React.ComponentPropsWithoutRef<typeof ArkField.RequiredIndicator>
>(({ className, ...props }, ref) => (
    <ArkField.RequiredIndicator ref={ref} className={cn('text-destructive ml-0.5 font-bold', className)} {...props} />
));
FieldRequiredIndicator.displayName = 'FieldRequiredIndicator';

export const FieldHelper = FieldHelperText;
export const FieldError = FieldErrorText;
