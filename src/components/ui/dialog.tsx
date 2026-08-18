import * as React from 'react';

import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';

import Icon from '@/components/common/Icon';
import { cn } from '@/lib/utils';

export interface DialogProps extends Omit<React.ComponentPropsWithoutRef<typeof ArkDialog.Root>, 'onOpenChange'> {
    onOpenChange?: ((open: boolean) => void) | ((details: { open: boolean }) => void);
}

const Dialog: React.FC<DialogProps> = ({ onOpenChange, lazyMount = true, unmountOnExit = true, ...props }) => {
    return (
        <ArkDialog.Root
            lazyMount={lazyMount}
            unmountOnExit={unmountOnExit}
            onOpenChange={(details) => {
                if (typeof onOpenChange === 'function') {
                    (onOpenChange as any)(details.open);
                }
            }}
            {...props}
        />
    );
};

const DialogTrigger = ArkDialog.Trigger;
const DialogClose = ArkDialog.CloseTrigger;

const DialogOverlay = React.forwardRef<React.ComponentRef<typeof ArkDialog.Backdrop>, React.ComponentPropsWithoutRef<typeof ArkDialog.Backdrop>>(
    ({ className, ...props }, ref) => (
        <ArkDialog.Backdrop
            ref={ref}
            className={cn(
                'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                className
            )}
            {...props}
        />
    )
);
DialogOverlay.displayName = 'DialogOverlay';

const DialogContent = React.forwardRef<React.ComponentRef<typeof ArkDialog.Content>, React.ComponentPropsWithoutRef<typeof ArkDialog.Content>>(
    ({ className, children, ...props }, ref) => (
        <Portal>
            <DialogOverlay />
            <ArkDialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <ArkDialog.Content
                    ref={ref}
                    className={cn(
                        'relative grid w-full max-w-lg gap-4 border border-zinc-800 bg-zinc-950 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
                        className
                    )}
                    {...props}>
                    {children}
                    <ArkDialog.CloseTrigger className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                        <Icon icon="close" className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </ArkDialog.CloseTrigger>
                </ArkDialog.Content>
            </ArkDialog.Positioner>
        </Portal>
    )
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<React.ComponentRef<typeof ArkDialog.Title>, React.ComponentPropsWithoutRef<typeof ArkDialog.Title>>(
    ({ className, ...props }, ref) => (
        <ArkDialog.Title ref={ref} className={cn('text-sm font-semibold leading-none tracking-tight text-zinc-100', className)} {...props} />
    )
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
    React.ComponentRef<typeof ArkDialog.Description>,
    React.ComponentPropsWithoutRef<typeof ArkDialog.Description>
>(({ className, ...props }, ref) => <ArkDialog.Description ref={ref} className={cn('text-xs text-zinc-400', className)} {...props} />);
DialogDescription.displayName = 'DialogDescription';

export { Dialog, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
