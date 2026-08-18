import * as React from 'react';

import { ark } from '@ark-ui/react/factory';

import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentPropsWithoutRef<typeof ark.input> {}

const Input = React.forwardRef<React.ComponentRef<typeof ark.input>, InputProps>(({ className, type, ...props }, ref) => {
    return (
        <ark.input
            type={type}
            className={cn(
                'flex h-7 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-red-500/70 data-[invalid]:focus-visible:ring-red-500',
                className
            )}
            ref={ref}
            {...props}
        />
    );
});
Input.displayName = 'Input';

export { Input };
