import * as React from 'react';

import { Field as ArkField } from '@ark-ui/react/field';

import { cn } from '@/lib/utils';

const Field = React.forwardRef<React.ComponentRef<typeof ArkField.Root>, React.ComponentPropsWithoutRef<typeof ArkField.Root>>(
    ({ className, ...props }, ref) => <ArkField.Root ref={ref} className={cn('flex w-full flex-col gap-1', className)} {...props} />
);
Field.displayName = 'Field';

const FieldLabel = React.forwardRef<React.ComponentRef<typeof ArkField.Label>, React.ComponentPropsWithoutRef<typeof ArkField.Label>>(
    ({ className, ...props }, ref) => (
        <ArkField.Label
            ref={ref}
            className={cn('text-[10px] font-semibold tracking-wider text-zinc-400 uppercase select-none', className)}
            {...props}
        />
    )
);
FieldLabel.displayName = 'FieldLabel';

const FieldInput = React.forwardRef<React.ComponentRef<typeof ArkField.Input>, React.ComponentPropsWithoutRef<typeof ArkField.Input>>(
    ({ className, ...props }, ref) => (
        <ArkField.Input
            ref={ref}
            className={cn(
                'flex h-7 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-red-500/70 data-[invalid]:focus-visible:ring-red-500',
                className
            )}
            {...props}
        />
    )
);
FieldInput.displayName = 'FieldInput';

const FieldTextarea = React.forwardRef<React.ComponentRef<typeof ArkField.Textarea>, React.ComponentPropsWithoutRef<typeof ArkField.Textarea>>(
    ({ className, ...props }, ref) => (
        <ArkField.Textarea
            ref={ref}
            className={cn(
                'flex min-h-[60px] w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-red-500/70 data-[invalid]:focus-visible:ring-red-500',
                className
            )}
            {...props}
        />
    )
);
FieldTextarea.displayName = 'FieldTextarea';

const FieldError = React.forwardRef<React.ComponentRef<typeof ArkField.ErrorText>, React.ComponentPropsWithoutRef<typeof ArkField.ErrorText>>(
    ({ className, ...props }, ref) => <ArkField.ErrorText ref={ref} className={cn('text-[11px] font-medium text-red-400', className)} {...props} />
);
FieldError.displayName = 'FieldError';

const FieldHelper = React.forwardRef<React.ComponentRef<typeof ArkField.HelperText>, React.ComponentPropsWithoutRef<typeof ArkField.HelperText>>(
    ({ className, ...props }, ref) => <ArkField.HelperText ref={ref} className={cn('text-[11px] text-zinc-500', className)} {...props} />
);
FieldHelper.displayName = 'FieldHelper';

const FieldRequiredIndicator = React.forwardRef<
    React.ComponentRef<typeof ArkField.RequiredIndicator>,
    React.ComponentPropsWithoutRef<typeof ArkField.RequiredIndicator>
>(({ className, ...props }, ref) => <ArkField.RequiredIndicator ref={ref} className={cn('ml-0.5 text-red-400', className)} {...props} />);
FieldRequiredIndicator.displayName = 'FieldRequiredIndicator';

export { Field, FieldLabel, FieldInput, FieldTextarea, FieldError, FieldHelper, FieldRequiredIndicator };
