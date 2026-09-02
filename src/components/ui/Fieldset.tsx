'use client';

import * as React from 'react';
import { Fieldset as ArkFieldset } from '@ark-ui/react/fieldset';
import { cn } from '@/lib/utils';

export function Fieldset({ ref, className, ...props }: React.ComponentProps<typeof ArkFieldset.Root>) {
    return (
        <ArkFieldset.Root
            {...props}
            ref={ref}
            className={cn(
                'flex w-full flex-col gap-3 rounded-lg border border-border/80 bg-card/30 p-3.5 shadow-2xs transition-colors data-[disabled]:opacity-60 data-[disabled]:pointer-events-none',
                className
            )}
        />
    );
}

export function FieldsetLegend({ ref, className, ...props }: React.ComponentProps<typeof ArkFieldset.Legend>) {
    return (
        <ArkFieldset.Legend
            {...props}
            ref={ref}
            className={cn(
                'flex items-center gap-1.5 px-1 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground select-none',
                className
            )}
        />
    );
}

export function FieldsetHelperText({ ref, className, ...props }: React.ComponentProps<typeof ArkFieldset.HelperText>) {
    return (
        <ArkFieldset.HelperText
            {...props}
            ref={ref}
            className={cn('px-1 text-[11px] text-muted-foreground leading-normal', className)}
        />
    );
}

export function FieldsetErrorText({ ref, className, ...props }: React.ComponentProps<typeof ArkFieldset.ErrorText>) {
    return (
        <ArkFieldset.ErrorText
            {...props}
            ref={ref}
            className={cn('px-1 text-[11px] font-medium text-destructive leading-normal', className)}
        />
    );
}

export function FieldsetContent({ ref, className, ...props }: React.ComponentProps<'div'>) {
    return <div {...props} ref={ref} className={cn('flex flex-col gap-2.5 pt-0.5', className)} />;
}

Fieldset.Root = ArkFieldset.Root;
Fieldset.Legend = FieldsetLegend;
Fieldset.HelperText = FieldsetHelperText;
Fieldset.ErrorText = FieldsetErrorText;
Fieldset.Content = FieldsetContent;
Fieldset.Context = ArkFieldset.Context;

export default Fieldset;
