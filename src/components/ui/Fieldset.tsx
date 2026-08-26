'use client';

import * as React from 'react';
import { Fieldset as ArkFieldset } from '@ark-ui/react/fieldset';
import { cn } from '@/lib/utils';

export const Fieldset = React.forwardRef<
    React.ComponentRef<typeof ArkFieldset.Root>,
    React.ComponentPropsWithoutRef<typeof ArkFieldset.Root>
>(({ className, ...props }, ref) => (
    <ArkFieldset.Root
        ref={ref}
        className={cn(
            'flex w-full flex-col gap-3 rounded-lg border border-border/80 bg-card/30 p-3.5 shadow-2xs transition-colors data-[disabled]:opacity-60 data-[disabled]:pointer-events-none',
            className
        )}
        {...props}
    />
));
Fieldset.displayName = 'Fieldset';

export const FieldsetLegend = React.forwardRef<
    React.ComponentRef<typeof ArkFieldset.Legend>,
    React.ComponentPropsWithoutRef<typeof ArkFieldset.Legend>
>(({ className, ...props }, ref) => (
    <ArkFieldset.Legend
        ref={ref}
        className={cn(
            'flex items-center gap-1.5 px-1 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground select-none',
            className
        )}
        {...props}
    />
));
FieldsetLegend.displayName = 'FieldsetLegend';

export const FieldsetHelperText = React.forwardRef<
    React.ComponentRef<typeof ArkFieldset.HelperText>,
    React.ComponentPropsWithoutRef<typeof ArkFieldset.HelperText>
>(({ className, ...props }, ref) => (
    <ArkFieldset.HelperText
        ref={ref}
        className={cn('px-1 text-[11px] text-muted-foreground leading-normal', className)}
        {...props}
    />
));
FieldsetHelperText.displayName = 'FieldsetHelperText';

export const FieldsetErrorText = React.forwardRef<
    React.ComponentRef<typeof ArkFieldset.ErrorText>,
    React.ComponentPropsWithoutRef<typeof ArkFieldset.ErrorText>
>(({ className, ...props }, ref) => (
    <ArkFieldset.ErrorText
        ref={ref}
        className={cn('px-1 text-[11px] font-medium text-destructive leading-normal', className)}
        {...props}
    />
));
FieldsetErrorText.displayName = 'FieldsetErrorText';

export const FieldsetContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-2.5 pt-0.5', className)} {...props} />
));
FieldsetContent.displayName = 'FieldsetContent';

export default Fieldset;
