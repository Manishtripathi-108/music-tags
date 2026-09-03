'use client';

import type { ComponentProps } from 'react';
import { Tabs as ArkTabs } from '@ark-ui/react/tabs';
import { cn } from './cn';

export const Tabs = ({ className, ...props }: ComponentProps<typeof ArkTabs.Root>) => {
    return <ArkTabs.Root lazyMount unmountOnExit className={cn('w-full', className)} {...props} />;
};

export const TabsList = ({ className, ...props }: ComponentProps<typeof ArkTabs.List>) => {
    return (
        <ArkTabs.List
            className={cn(
                'bg-muted relative isolate inline-flex w-fit items-center gap-0.5 rounded-lg border p-0.5 backdrop-blur-xs select-none',
                className
            )}
            {...props}
        />
    );
};

export const TabsTrigger = ({ className, ...props }: ComponentProps<typeof ArkTabs.Trigger>) => {
    return (
        <ArkTabs.Trigger
            className={cn(
                'min-h-7 gap-1.5 rounded-md px-2.5 py-1 text-xs',
                'relative z-10 inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap select-none',
                'transition-colors duration-150 outline-none',
                'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1',
                'text-muted-foreground hover:text-foreground',
                'data-[state=active]:text-foreground data-selected:text-foreground',
                className
            )}
            {...props}
        />
    );
};

export const TabsIndicator = ({ className, ...props }: ComponentProps<typeof ArkTabs.Indicator>) => {
    return (
        <ArkTabs.Indicator
            style={{
                transitionDuration: '200ms',
                transitionTimingFunction: 'ease-out',
            }}
            className={cn(
                'pointer-events-none absolute z-0',
                'top-(--top) left-(--left) h-(--height) w-(--width)',
                'border-border/80 text-card-foreground rounded-md border bg-white shadow-xs dark:bg-black',
                'transition-[transform,width,height,left,top] duration-200 ease-out',
                className
            )}
            {...props}
        />
    );
};

export const TabsContent = ({ className, ...props }: ComponentProps<typeof ArkTabs.Content>) => {
    return (
        <ArkTabs.Content
            className={cn(
                'ring-offset-background mt-3 outline-none',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
                className
            )}
            {...props}
        />
    );
};
