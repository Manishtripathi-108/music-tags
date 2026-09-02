'use client';

import { Editable as ArkEditable } from '@ark-ui/react/editable';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { DISABLED, FIELD_CONTROL_STYLES } from '@/lib/styles/tailwind.helpers';

export function Editable({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Root>) {
    return (
        <ArkEditable.Root
            {...props}
            ref={ref}
            className={cn('group relative flex w-full flex-col gap-1 text-xs data-disabled:opacity-60', className)}
        />
    );
}

export function EditableLabel({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Label>) {
    return (
        <ArkEditable.Label
            {...props}
            ref={ref}
            className={cn('text-muted-foreground flex items-center gap-1 font-mono text-[11px] font-semibold select-none', className)}
        />
    );
}

export function EditableArea({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Area>) {
    return <ArkEditable.Area {...props} ref={ref} className={cn('relative flex w-full items-center', className)} />;
}

export function EditableInput({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Input>) {
    return <ArkEditable.Input {...props} ref={ref} className={cn(DISABLED, FIELD_CONTROL_STYLES, className)} />;
}

export function EditablePreview({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Preview>) {
    return (
        <ArkEditable.Preview
            {...props}
            ref={ref}
            className={cn(
                'text-foreground flex min-h-6 w-full items-center truncate rounded px-1.5 py-0.5 text-xs transition-colors select-text',
                'hover:bg-muted/50 data-placeholder:text-muted-foreground/60 cursor-text',
                className
            )}
        />
    );
}

export function EditableControl({ ref, className, ...props }: React.ComponentProps<typeof ArkEditable.Control>) {
    return <ArkEditable.Control {...props} ref={ref} className={cn('flex items-center gap-1', className)} />;
}

export function EditableEditTrigger({ ref, className, children, ...props }: React.ComponentProps<typeof ArkEditable.EditTrigger>) {
    return (
        <ArkEditable.EditTrigger
            {...props}
            ref={ref}
            className={cn(
                'text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-6 cursor-pointer items-center justify-center rounded transition-all active:scale-95',
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
                'bg-primary text-primary-foreground inline-flex size-6 cursor-pointer items-center justify-center rounded shadow-2xs transition-all hover:brightness-110 active:scale-95',
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
                'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-6 cursor-pointer items-center justify-center rounded border transition-all active:scale-95',
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
export type InlineTableCellEditableProps = {
    inputClassName?: string;
    previewClassName?: string;
    isActiveRow?: boolean;
} & React.ComponentProps<typeof ArkEditable.Root>;

export function InlineTableCellEditable({
    className,
    inputClassName,
    previewClassName,
    isActiveRow = false,
    ...props
}: InlineTableCellEditableProps) {
    return (
        <ArkEditable.Root
            activationMode="dblclick"
            selectOnFocus
            submitMode="both"
            className={cn('group/edit relative flex min-w-0 flex-1 items-center font-mono', className)}
            {...props}>
            <ArkEditable.Area className="flex min-w-0 flex-1 items-center">
                <ArkEditable.Input
                    className={cn(
                        'border-primary/60 bg-input text-foreground ring-primary/30 h-5 w-full min-w-0 rounded border px-1 py-0 font-mono text-[11px] shadow-xs ring-1 outline-none',
                        inputClassName
                    )}
                />
                <ArkEditable.Preview
                    className={cn(
                        'h-5 min-w-0 flex-1 truncate rounded px-1 py-0 font-mono text-[11px] leading-5 transition-colors',
                        isActiveRow ? 'hover:bg-primary/20 text-inherit' : 'hover:bg-muted/80 hover:text-foreground',
                        previewClassName
                    )}></ArkEditable.Preview>
            </ArkEditable.Area>
        </ArkEditable.Root>
    );
}

export default Editable;
