'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => {
    return (
        <input
            type={type}
            ref={ref}
            className={cn(
                'flex h-8 w-full rounded-md border border-border bg-input/40 px-2.5 py-1 text-xs text-foreground shadow-2xs transition-all duration-150 placeholder:text-muted-foreground/60',
                'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        />
    );
});
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
    return (
        <textarea
            ref={ref}
            className={cn(
                'flex min-h-[64px] w-full rounded-md border border-border bg-input/40 px-2.5 py-1.5 text-xs text-foreground shadow-2xs transition-all duration-150 placeholder:text-muted-foreground/60',
                'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        />
    );
});
Textarea.displayName = 'Textarea';

export default Input;
