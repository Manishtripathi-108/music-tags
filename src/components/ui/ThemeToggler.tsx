'use client';

import React from 'react';

import Icon from '@/components/ui/Icon';
import useTheme from '@/hooks/useTheme';

import { Button } from './Button';

type ThemeTogglerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const ThemeToggler = ({ onClick, ...props }: ThemeTogglerProps) => {
    const { theme, nextTheme, animateToggleTheme } = useTheme();

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
            return;
        }

        animateToggleTheme(event.clientX, event.clientY);
    };

    const icon = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'desktop';
    const text = theme[0].toUpperCase() + theme.slice(1);

    return (
        <Button
            size="sm"
            variant="ghost"
            onClick={handleClick}
            aria-label={`Theme: ${text}. Switch to ${nextTheme} mode.`}
            title={`Theme: ${text}. Click to switch to ${nextTheme} mode.`}
            className="size-6 min-h-0 rounded-full p-0 text-yellow-400 dark:text-gray-300"
            innerClassName="size-full rounded-full p-0"
            {...props}>
            <Icon icon={icon} className="size-5 transition-transform duration-200 group-hover:rotate-12" />
        </Button>
    );
};

export { ThemeToggler };
export default ThemeToggler;
