'use client';

import * as React from 'react';
import { Editable as ArkEditable } from '@ark-ui/react/editable';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export const Editable = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.Root>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.Root>
>(({ className, ...props }, ref) => (
    <ArkEditable.Root
        ref={ref}
        className={cn('group relative flex w-full flex-col gap-1 text-xs data-[disabled]:opacity-60', className)}
        {...props}
    />
));
Editable.displayName = 'Editable';

export const EditableLabel = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.Label>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.Label>
>(({ className, ...props }, ref) => (
    <ArkEditable.Label
        ref={ref}
        className={cn('flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground select-none', className)}
        {...props}
    />
));
EditableLabel.displayName = 'EditableLabel';

export const EditableArea = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.Area>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.Area>
>(({ className, ...props }, ref) => (
    <ArkEditable.Area
        ref={ref}
        className={cn('relative flex w-full items-center', className)}
        {...props}
    />
));
EditableArea.displayName = 'EditableArea';

export const EditableInput = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.Input>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.Input>
>(({ className, ...props }, ref) => (
    <ArkEditable.Input
        ref={ref}
        className={cn(
            'flex h-7 w-full rounded border border-primary/60 bg-background px-2 py-0.5 font-mono text-xs text-foreground shadow-2xs outline-none ring-2 ring-primary/20 transition-all duration-150',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
        )}
        {...props}
    />
));
EditableInput.displayName = 'EditableInput';

export const EditablePreview = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.Preview>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.Preview>
>(({ className, ...props }, ref) => (
    <ArkEditable.Preview
        ref={ref}
        className={cn(
            'flex min-h-6 w-full items-center truncate rounded px-1.5 py-0.5 text-xs text-foreground transition-colors select-text',
            'hover:bg-muted/50 cursor-text data-[placeholder]:text-muted-foreground/60',
            className
        )}
        {...props}
    />
));
EditablePreview.displayName = 'EditablePreview';

export const EditableControl = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.Control>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.Control>
>(({ className, ...props }, ref) => (
    <ArkEditable.Control
        ref={ref}
        className={cn('flex items-center gap-1', className)}
        {...props}
    />
));
EditableControl.displayName = 'EditableControl';

export const EditableEditTrigger = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.EditTrigger>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.EditTrigger>
>(({ className, children, ...props }, ref) => (
    <ArkEditable.EditTrigger
        ref={ref}
        className={cn(
            'inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all',
            className
        )}
        {...props}>
        {children ?? <Icon icon="edit" className="size-3.5" />}
    </ArkEditable.EditTrigger>
));
EditableEditTrigger.displayName = 'EditableEditTrigger';

export const EditableSubmitTrigger = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.SubmitTrigger>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.SubmitTrigger>
>(({ className, children, ...props }, ref) => (
    <ArkEditable.SubmitTrigger
        ref={ref}
        className={cn(
            'inline-flex size-6 cursor-pointer items-center justify-center rounded bg-primary text-primary-foreground hover:brightness-110 active:scale-95 transition-all shadow-2xs',
            className
        )}
        {...props}>
        {children ?? <Icon icon="success" className="size-3.5" />}
    </ArkEditable.SubmitTrigger>
));
EditableSubmitTrigger.displayName = 'EditableSubmitTrigger';

export const EditableCancelTrigger = React.forwardRef<
    React.ComponentRef<typeof ArkEditable.CancelTrigger>,
    React.ComponentPropsWithoutRef<typeof ArkEditable.CancelTrigger>
>(({ className, children, ...props }, ref) => (
    <ArkEditable.CancelTrigger
        ref={ref}
        className={cn(
            'inline-flex size-6 cursor-pointer items-center justify-center rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all',
            className
        )}
        {...props}>
        {children ?? <Icon icon="close" className="size-3.5" />}
    </ArkEditable.CancelTrigger>
));
EditableCancelTrigger.displayName = 'EditableCancelTrigger';

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
                        'h-5 w-full min-w-0 rounded border border-blue-400 bg-zinc-900 px-1 py-0 font-mono text-[11px] text-white shadow-xs outline-none ring-1 ring-blue-500/50',
                        inputClassName
                    )}
                />
                <ArkEditable.Preview
                    className={cn(
                        'h-5 min-w-0 flex-1 truncate rounded px-1 py-0 font-mono text-[11px] leading-5 transition-colors',
                        isActiveRow
                            ? 'text-inherit hover:bg-blue-700/60'
                            : 'hover:bg-zinc-800/80 hover:text-zinc-100',
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
