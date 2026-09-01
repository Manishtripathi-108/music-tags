'use client';

import * as React from 'react';
import { Editable as ArkEditable } from '@ark-ui/react/editable';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export function Editable({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Root>) {
    return (
        <ArkEditable.Root
            {...props}
            ref={ref}
            className={cn('group relative flex w-full flex-col gap-1 text-xs data-[disabled]:opacity-60', className)}
        />
    );
}

export function EditableLabel({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Label>) {
    return (
        <ArkEditable.Label
            {...props}
            ref={ref}
            className={cn('flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground select-none', className)}
        />
    );
}

export function EditableArea({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Area>) {
    return (
        <ArkEditable.Area
            {...props}
            ref={ref}
            className={cn('relative flex w-full items-center', className)}
        />
    );
}

export function EditableInput({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Input>) {
    return (
        <ArkEditable.Input
            {...props}
            ref={ref}
            className={cn(
                'flex h-7 w-full rounded border border-primary/60 bg-background px-2 py-0.5 font-mono text-xs text-foreground shadow-2xs outline-none ring-2 ring-primary/20 transition-all duration-150',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
        />
    );
}

export function EditablePreview({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Preview>) {
    return (
        <ArkEditable.Preview
            {...props}
            ref={ref}
            className={cn(
                'flex min-h-6 w-full items-center truncate rounded px-1.5 py-0.5 text-xs text-foreground transition-colors select-text',
                'hover:bg-muted/50 cursor-text data-[placeholder]:text-muted-foreground/60',
                className
            )}
        />
    );
}

export function EditableControl({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Control>) {
    return (
        <ArkEditable.Control
            {...props}
            ref={ref}
            className={cn('flex items-center gap-1', className)}
        />
    );
}

export function EditableEditTrigger({ ref, className, children, ...props }: React.ComponentProps<typeof ArkEditable.EditTrigger>) {
    return (
        <ArkEditable.EditTrigger
            {...props}
            ref={ref}
            className={cn(
                'inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all',
                className
            )}>
            {children ?? <Icon icon="edit" className="size-3.5" />}
        </ArkEditable.EditTrigger>
    );
}

export function EditableSubmitTrigger({ ref, className, children, ...props }: React.ComponentProps<typeof ArkEditable.SubmitTrigger>) {
    return (
        <ArkEditable.SubmitTrigger
            {...props}
            ref={ref}
            className={cn(
                'inline-flex size-6 cursor-pointer items-center justify-center rounded bg-primary text-primary-foreground hover:brightness-110 active:scale-95 transition-all shadow-2xs',
                className
            )}>
            {children ?? <Icon icon="success" className="size-3.5" />}
        </ArkEditable.SubmitTrigger>
    );
}

export function EditableCancelTrigger({ ref, className, children, ...props }: React.ComponentProps<typeof ArkEditable.CancelTrigger>) {
    return (
        <ArkEditable.CancelTrigger
            {...props}
            ref={ref}
            className={cn(
                'inline-flex size-6 cursor-pointer items-center justify-center rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all',
                className
            )}>
            {children ?? <Icon icon="close" className="size-3.5" />}
        </ArkEditable.CancelTrigger>
    );
}

/**
 * Compact Table Cell Inline Editable
 * Double-click to activate, Enter/blur to commit, Escape to cancel.
 */
export interface InlineTableCellEditableProps {
    value: string;
    onValueCommit: (value: string) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    previewClassName?: string;
    isActiveRow?: boolean;
}

export function InlineTableCellEditable({
    value,
    onValueCommit,
    placeholder = '-',
    className,
    inputClassName,
    previewClassName,
    isActiveRow = false,
}: InlineTableCellEditableProps) {
    const [currentValue, setCurrentValue] = React.useState(value);

    React.useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    return (
        <ArkEditable.Root
            value={currentValue}
            onValueChange={(details: { value: string }) => setCurrentValue(details.value)}
            onValueCommit={(details: { value: string }) => {
                setCurrentValue(details.value);
                onValueCommit(details.value);
            }}
            activationMode="dblclick"
            selectOnFocus
            submitMode="both"
            className={cn('group/edit relative flex min-w-0 flex-1 items-center font-mono', className)}>
            <ArkEditable.Area className="flex min-w-0 flex-1 items-center">
                <ArkEditable.Input
                    className={cn(
                        'h-5 w-full min-w-0 rounded border border-primary/60 bg-input px-1 py-0 font-mono text-[11px] text-foreground shadow-xs outline-none ring-1 ring-primary/30',
                        inputClassName
                    )}
                />
                <ArkEditable.Preview
                    className={cn(
                        'h-5 min-w-0 flex-1 truncate rounded px-1 py-0 font-mono text-[11px] leading-5 transition-colors',
                        isActiveRow
                            ? 'text-inherit hover:bg-primary/20'
                            : 'hover:bg-muted/80 hover:text-foreground',
                        !currentValue && 'opacity-40',
                        previewClassName
                    )}>
                    {currentValue || placeholder}
                </ArkEditable.Preview>
            </ArkEditable.Area>
        </ArkEditable.Root>
    );
}

export default Editable;
