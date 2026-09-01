'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

import { isBrowser } from '@/lib/utils/core.utils';

type ThemeType = 'light' | 'dark' | 'system';

type ThemeMetaMode = 'css-variable' | 'custom';

type ThemeMetaConfig = {
    mode?: ThemeMetaMode;
    light?: string;
    dark?: string;
    cssVar?: string;
};

type ThemeChangeDetail = {
    theme: ThemeType;
    resolvedTheme: 'light' | 'dark';
    duration: number;
};

const THEME_KEY = 'theme';
const THEME_CHANGE_EVENT = 'meta-tags-theme-change';
const VALID_THEMES: ReadonlySet<string> = new Set(['light', 'dark', 'system']);

/* Read theme from localStorage. Falls back to system. */
const getStoredTheme = (): ThemeType => {
    if (isBrowser) {
        const stored = localStorage.getItem(THEME_KEY);

        if (stored && VALID_THEMES.has(stored)) {
            return stored as ThemeType;
        }
    }

    return 'system';
};

const getSystemTheme = (): 'light' | 'dark' => {
    if (!isBrowser) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Convert system theme to concrete light or dark.
 */
const resolveTheme = (theme: ThemeType): 'light' | 'dark' => (theme === 'system' ? getSystemTheme() : theme);

/**
 * Apply theme to DOM root and update meta theme color.
 */
const applyThemeToDOM = (theme: 'light' | 'dark', metaConfig: ThemeMetaConfig | undefined) => {
    const root = document.documentElement;

    // Avoid unnecessary DOM writes if the theme is already applied.
    if (root.dataset.theme === theme) return;

    // Set data-theme attribute and toggle dark class for Tailwind compatibility.
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');

    // Update meta[name="theme-color"]
    const meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) return;

    let color = '';

    // Apply custom color
    if (metaConfig?.mode === 'custom') {
        color = theme === 'dark' ? (metaConfig.dark ?? '') : (metaConfig.light ?? '');
    } else {
        // Apply css variable
        const variable = metaConfig?.cssVar ?? '--color-primary';
        color = getComputedStyle(root).getPropertyValue(variable);
    }

    if (color) meta.setAttribute('content', color.trim());
};

const getNextTheme = (theme: ThemeType): ThemeType => {
    if (theme === 'light') return 'dark';
    if (theme === 'dark') return 'system';
    return 'light';
};

/**
 * Sync theme across tabs and within the same tab via custom event.
 */
const subscribeToTheme = (onStoreChange: () => void) => {
    if (!isBrowser) {
        return () => undefined;
    }

    const handleStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === THEME_KEY) {
            onStoreChange();
        }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    };
};

/**
 * React hook that manages application color theme.
 *
 * Supports three theme states
 * light
 * dark
 * system
 *
 * Features
 * - Persists theme in localStorage
 * - Syncs theme across browser tabs
 * - Syncs theme within the same tab using a custom event
 * - Resolves system theme using prefers-color-scheme
 * - Updates DOM attributes and Tailwind dark class
 * - Updates meta theme-color for mobile browser UI
 * - Optional animated toggle using the View Transition API
 *
 * DOM changes
 * - Sets data-theme on document.documentElement
 * - Toggles the "dark" class on the root element
 * - Updates meta[name="theme-color"]
 *
 * Storage
 * - Theme is stored under the key "theme"
 *
 * Cross tab sync
 * - Uses the storage event
 *
 * Same tab sync
 * - Uses the custom event "barbell-theme-change"
 *
 * @param options Configuration object
 *
 * @param options.duration
 * Duration of the theme transition animation in milliseconds.
 * Used by the View Transition API animation.
 * Default is 400.
 *
 * @param options.meta
 * Configuration for the browser theme-color meta tag.
 *
 * meta modes
 * - "css-variable"
 *   Reads a CSS variable from the root element.
 *
 * - "custom"
 *   Uses explicit colors for light and dark themes.
 *
 * @example
 * const {
 *   theme,
 *   nextTheme,
 *   setTheme,
 *   cycleTheme,
 *   animateToggleTheme
 * } = useTheme()
 *
 * @returns Object containing theme state and helpers
 *
 * @returns theme
 * Current theme value stored in localStorage.
 * Possible values are "light", "dark", or "system".
 *
 * @returns nextTheme
 * Next theme in the cycle order.
 * light → dark → system → light
 *
 * @returns setTheme
 * Sets the theme directly or via updater function.
 *
 * @example
 * setTheme('dark')
 *
 * @example
 * setTheme(prev => prev === 'dark' ? 'light' : 'dark')
 *
 * @returns cycleTheme
 * Advances the theme to the next value in the cycle.
 *
 * @returns animateToggleTheme
 * Toggles theme with a circular reveal animation using
 * the View Transition API when supported.
 *
 * Accepts optional click coordinates so the animation
 * can start from the interaction point.
 *
 * @param x Optional x coordinate of the animation origin
 * @param y Optional y coordinate of the animation origin
 */
const useTheme = ({
    duration = 400,
    meta,
}: {
    duration?: number;
    meta?: ThemeMetaConfig;
} = {}) => {
    const theme = useSyncExternalStore<ThemeType>(subscribeToTheme, getStoredTheme, () => 'system');
    const resolvedTheme = resolveTheme(theme);
    const nextTheme = getNextTheme(theme);

    const applyTheme = useCallback(
        (themeValue: ThemeType) => {
            const resolved = resolveTheme(themeValue);

            applyThemeToDOM(resolved, meta);

            if (isBrowser) {
                localStorage.setItem(THEME_KEY, themeValue);

                const event = new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, {
                    detail: {
                        theme: themeValue,
                        resolvedTheme: resolved,
                        duration,
                    },
                });

                window.dispatchEvent(event);
            }
        },
        [duration, meta]
    );

    const setTheme = useCallback(
        (value: ThemeType | ((theme: ThemeType) => ThemeType)) => {
            const nextThemeValue = typeof value === 'function' ? value(getStoredTheme()) : value;

            applyTheme(nextThemeValue);
        },
        [applyTheme]
    );

    // Sync DOM on mount and when theme changes.
    // Only touches the DOM - does NOT write to localStorage,
    // so it can't overwrite the user's stored preference during hydration.
    useEffect(() => {
        if (!isBrowser) return;

        const resolved = resolveTheme(theme);
        applyThemeToDOM(resolved, meta);

        // When theme is system listen to OS preference changes.
        if (theme !== 'system') return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            const resolved = resolveTheme('system');
            applyThemeToDOM(resolved, meta);
        };

        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, [theme, meta]);

    const cycleTheme = useCallback(() => {
        setTheme((currentTheme) => getNextTheme(currentTheme));
    }, [setTheme]);

    const animateToggleTheme = useCallback(
        (x?: number, y?: number) => {
            // Fallback when View Transition API is not supported.
            if (typeof document === 'undefined' || !('startViewTransition' in document)) {
                cycleTheme();
                return;
            }

            const transition = document.startViewTransition(() => {
                flushSync(cycleTheme);
            });

            transition?.ready?.then(() => {
                const cx = x ?? window.innerWidth / 2;
                const cy = y ?? window.innerHeight / 2;

                const radius = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));

                document.documentElement.animate(
                    {
                        clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${radius}px at ${cx}px ${cy}px)`],
                    },
                    {
                        duration,
                        easing: 'ease-in-out',
                        pseudoElement: '::view-transition-new(root)',
                    }
                );
            });
        },
        [cycleTheme, duration]
    );

    return {
        theme,
        resolvedTheme,
        nextTheme,
        setTheme,
        cycleTheme,
        animateToggleTheme,
    };
};

/**
 * Inline script that runs before React hydration.
 *
 * Prevents a flash of incorrect theme by applying
 * the stored theme immediately during page load.
 *
 * Behavior
 * - Reads theme from localStorage
 * - Falls back to system preference when needed
 * - Applies data-theme attribute to the root element
 * - Toggles the dark class for Tailwind compatibility
 *
 * This component should be rendered inside the document
 * head so the theme is applied before React mounts.
 */
export const ThemeScript = () => {
    return (
        <script
            dangerouslySetInnerHTML={{
                __html: `
                    (function () {
                        try {
                            var stored = localStorage.getItem('theme') || 'system';
                            var theme = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
                            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                            var appliedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

                            document.documentElement.setAttribute('data-theme', appliedTheme);
                            document.documentElement.classList.toggle('dark', appliedTheme === 'dark');
                        } catch (e) {
                            console.error("Error applying theme:", e);
                        }
                    })();
                `,
            }}
        />
    );
};

export default useTheme;
