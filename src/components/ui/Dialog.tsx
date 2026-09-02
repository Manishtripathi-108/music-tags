'use client';

import type { ComponentProps } from 'react';

import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';

import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils/cn';

/* ────────────────────────────── Style constants ─────────────────────────────── */

const backdropStyles = [
    'fixed inset-0 z-50',
    'bg-black/60 backdrop-blur-sm',
    // enter
    'data-[state=open]:animate-in data-[state=open]:fade-in-0',
    // exit
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
].join(' ');

const positionerStyles = ['fixed inset-0 z-50', 'flex items-center justify-center', 'overflow-y-auto', 'p-4 sm:p-6'].join(' ');

const contentStyles = [
    'relative z-50',
    'w-full max-w-lg',
    'overflow-hidden',
    'rounded-xl',
    'border border-border',
    'bg-card text-card-foreground',
    'shadow-xl',
    'outline-none',
    // enter
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2',
    // exit
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2',
    // durations
    'data-[state=open]:duration-200 data-[state=closed]:duration-150',
].join(' ');

export function Dialog(props: ComponentProps<typeof ArkDialog.Root>) {
    return <ArkDialog.Root lazyMount unmountOnExit {...props} />;
}

export function DialogTrigger({ className, ...props }: ComponentProps<typeof ArkDialog.Trigger>) {
    return <ArkDialog.Trigger className={cn('cursor-pointer', className)} {...props} />;
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
    return <Portal>{children}</Portal>;
}

export function DialogBackdrop({ className, ...props }: ComponentProps<typeof ArkDialog.Backdrop>) {
    return <ArkDialog.Backdrop className={cn(backdropStyles, className)} {...props} />;
}

export function DialogPositioner({ className, ...props }: ComponentProps<typeof ArkDialog.Positioner>) {
    return <ArkDialog.Positioner className={cn(positionerStyles, className)} {...props} />;
}

export function DialogContent({ className, children, ...props }: ComponentProps<typeof ArkDialog.Content>) {
    return (
        <DialogPortal>
            <DialogBackdrop />
            <DialogPositioner>
                <ArkDialog.Content className={cn(contentStyles, className)} {...props}>
                    {children}
                </ArkDialog.Content>
            </DialogPositioner>
        </DialogPortal>
    );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-2', className)} {...props} />;
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('px-6 py-4', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('border-border flex items-center justify-end gap-2 border-t px-6 py-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof ArkDialog.Title>) {
    return <ArkDialog.Title className={cn('text-base leading-6 font-semibold tracking-tight', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof ArkDialog.Description>) {
    return <ArkDialog.Description className={cn('text-muted-foreground text-sm leading-5', className)} {...props} />;
}

export function DialogClose({ className, children, ...props }: ComponentProps<typeof ArkDialog.CloseTrigger>) {
    return (
        <ArkDialog.CloseTrigger
            className={cn(
                'absolute top-4 right-4',
                'inline-flex size-8 cursor-pointer items-center justify-center',
                'rounded-md',
                'text-muted-foreground',
                'transition-colors duration-150',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                'disabled:pointer-events-none',
                className
            )}
            {...props}>
            {children ?? <Icon icon="close" className="size-4" />}
            <span className="sr-only">Close</span>
        </ArkDialog.CloseTrigger>
    );
}
