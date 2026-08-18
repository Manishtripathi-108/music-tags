import * as React from 'react';

import { Tabs as ArkTabs } from '@ark-ui/react/tabs';

import { cn } from '@/lib/utils';

const Tabs = ArkTabs.Root;

const TabsList = React.forwardRef<React.ComponentRef<typeof ArkTabs.List>, React.ComponentPropsWithoutRef<typeof ArkTabs.List>>(
    ({ className, ...props }, ref) => (
        <ArkTabs.List
            ref={ref}
            className={cn('inline-flex h-7 items-center justify-start rounded border border-zinc-800 bg-zinc-900 p-0.5 text-zinc-400', className)}
            {...props}
        />
    )
);
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<React.ComponentRef<typeof ArkTabs.Trigger>, React.ComponentPropsWithoutRef<typeof ArkTabs.Trigger>>(
    ({ className, ...props }, ref) => (
        <ArkTabs.Trigger
            ref={ref}
            className={cn(
                'ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-zinc-800 data-[selected]:text-zinc-100 data-[selected]:shadow-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100',
                className
            )}
            {...props}
        />
    )
);
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<React.ComponentRef<typeof ArkTabs.Content>, React.ComponentPropsWithoutRef<typeof ArkTabs.Content>>(
    ({ className, ...props }, ref) => (
        <ArkTabs.Content
            ref={ref}
            className={cn('ring-offset-background focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none', className)}
            {...props}
        />
    )
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
