'use client';

import React from 'react';

import Icon from '@/components/ui/Icon';
import useTheme from '@/hooks/useTheme';
import cn from '@/lib/utils/cn';

type ThemeTogglerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const ThemeToggler = ({ className, onClick, ...props }: ThemeTogglerProps) => {
    const { theme, nextTheme, animateToggleTheme } = useTheme();

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
            return;
        }

        animateToggleTheme(event.clientX, event.clientY);
    };

    const icon = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'desktop';
    const text = theme === 'system' ? 'System' : theme[0].toUpperCase() + theme.slice(1);

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={`Theme: ${text}. Switch to ${nextTheme} mode.`}
            title={`Theme: ${text}. Click to switch to ${nextTheme} mode.`}
            className={cn(
                'group border-border bg-card text-card-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/60 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-semibold tracking-[0.08em] uppercase shadow-sm transition-all duration-200 select-none focus-visible:ring-2 focus-visible:outline-none active:scale-95',
                className
            )}
            {...props}>
            <Icon icon={icon} className="size-4 transition-transform duration-200 group-hover:rotate-12" />
            <span className="font-mono text-[11px]">{text}</span>
        </button>
    );
};

export { ThemeToggler };
export default ThemeToggler;
