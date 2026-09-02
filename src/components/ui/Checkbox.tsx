'use client';

import * as React from 'react';
import { Checkbox as ArkCheckbox } from '@ark-ui/react/checkbox';

import { cn } from '@/lib/utils';

/* ---------------------------------- Icons ---------------------------------- */

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}>
            <polyline points="2.5 7.5 5.5 10.5 11.5 3.5" />
        </svg>
    );
}

function MinusIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}>
            <line x1="3" y1="7" x2="11" y2="7" />
        </svg>
    );
}

/* ------------------------------- Primitives ------------------------------- */

export function CheckboxRoot({ ref, className, ...props }: React.ComponentProps<typeof ArkCheckbox.Root>) {
    return (
        <ArkCheckbox.Root
            {...props}
            ref={ref}
            className={cn(
                'group text-foreground inline-flex cursor-pointer items-center gap-2 text-xs font-medium select-none',
                'data-disabled:cursor-not-allowed data-disabled:opacity-50',
                className
            )}
        />
    );
}

export function CheckboxIndicator({ ref, className, children, indeterminate, ...props }: React.ComponentProps<typeof ArkCheckbox.Indicator>) {
    return (
        <ArkCheckbox.Indicator
            {...props}
            ref={ref}
            indeterminate={indeterminate}
            className={cn('flex items-center justify-center text-current', className)}>
            {children ?? (indeterminate ? <MinusIcon className="size-3 stroke-[2.5]" /> : <CheckIcon className="size-3 stroke-[2.5]" />)}
        </ArkCheckbox.Indicator>
    );
}

export function CheckboxControl({ ref, className, children, ...props }: React.ComponentProps<typeof ArkCheckbox.Control>) {
    return (
        <ArkCheckbox.Control
            {...props}
            ref={ref}
            className={cn(
                'border-border bg-input text-primary-foreground size-4 shrink-0 rounded-lg border shadow-2xs transition-colors duration-150',
                'flex items-center justify-center',
                'hover:border-primary/60 hover:bg-input',
                'focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden',
                'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground',
                'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground',
                'data-invalid:border-destructive data-invalid:ring-destructive/20',
                'data-disabled:cursor-not-allowed data-disabled:opacity-50',
                className
            )}>
            {children ?? (
                <>
                    <CheckboxIndicator />
                    <CheckboxIndicator indeterminate />
                </>
            )}
        </ArkCheckbox.Control>
    );
}

export function CheckboxLabel({ ref, className, ...props }: React.ComponentProps<typeof ArkCheckbox.Label>) {
    return (
        <ArkCheckbox.Label
            {...props}
            ref={ref}
            className={cn(
                'text-foreground cursor-pointer text-xs leading-none font-medium select-none',
                'group-data-disabled:cursor-not-allowed group-data-disabled:opacity-60',
                'group-data-invalid:text-destructive',
                className
            )}
        />
    );
}

export function CheckboxHiddenInput({ ref, ...props }: React.ComponentProps<typeof ArkCheckbox.HiddenInput>) {
    return <ArkCheckbox.HiddenInput {...props} ref={ref} />;
}

export function CheckboxGroup({ ref, className, ...props }: React.ComponentProps<typeof ArkCheckbox.Group>) {
    return <ArkCheckbox.Group {...props} ref={ref} className={cn('flex flex-col gap-2', className)} />;
}

export const CheckboxGroupProvider = ArkCheckbox.GroupProvider;
export const CheckboxContext = ArkCheckbox.Context;

/* -------------------------------- Composite -------------------------------- */

export interface CheckboxProps extends Omit<React.ComponentProps<typeof ArkCheckbox.Root>, 'children'> {
    label?: React.ReactNode;
    description?: React.ReactNode;
    inputRef?: React.Ref<HTMLInputElement>;
    inputProps?: React.ComponentProps<typeof ArkCheckbox.HiddenInput>;
    children?: React.ReactNode;
}

export function Checkbox({ ref, label, description, children, inputRef, inputProps, className, ...props }: CheckboxProps) {
    const hasDetails = Boolean(description);
    const content = label ?? children;

    return (
        <CheckboxRoot {...props} ref={ref} className={cn(hasDetails ? 'items-start gap-2.5' : 'items-center gap-2', className)}>
            <CheckboxControl className={hasDetails ? 'mt-0.5' : undefined} />
            {(content || description) && (
                <div className="flex flex-col gap-0.5">
                    {content && <CheckboxLabel>{content}</CheckboxLabel>}
                    {description && <span className="text-muted-foreground text-[11px] leading-normal select-none">{description}</span>}
                </div>
            )}
            <CheckboxHiddenInput {...inputProps} ref={inputRef} />
        </CheckboxRoot>
    );
}

Checkbox.Root = CheckboxRoot;
Checkbox.Control = CheckboxControl;
Checkbox.Indicator = CheckboxIndicator;
Checkbox.Label = CheckboxLabel;
Checkbox.HiddenInput = CheckboxHiddenInput;
Checkbox.Group = CheckboxGroup;
Checkbox.GroupProvider = ArkCheckbox.GroupProvider;
Checkbox.Context = ArkCheckbox.Context;

export default Checkbox;
