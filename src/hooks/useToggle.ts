'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type T_ToggleActions<T> = {
    /** Set value to default (initial value) */
    setDefault: () => void;

    /** Set value to alternate */
    setAlternate: () => void;

    /** Toggle value between default and alternate, or to a specific value */
    toggle: (value?: T) => void;
};

type T_Equals<T> = (a: T, b: T) => boolean;

export type T_UseToggleOptions<T> = {
    /**
     * Callback triggered when value changes
     */
    onChange?: (value: T) => void;

    /**
     * Custom equality checker for values
     * @default (a, b) => a === b
     */
    equals?: T_Equals<T>;

    /**
     * Keyboard key that will trigger the toggle when pressed.
     * @example 'Escape', 'Enter', ' ' (space), 'Tab'
     */
    keybind?: string;

    /**
     * Specific value to set when the keybind is triggered.
     * If not provided, the keybind will perform a normal toggle operation.
     */
    toggleOnKeyTo?: T;
};

/**
 * Hook overload for boolean toggles with optional alternate value.
 * @param defaultVal - The default boolean value (defaults to false)
 * @param alternateVal - The alternate boolean value (defaults to !defaultVal)
 * @param options - Configuration options
 * @returns Tuple containing current boolean state and toggle actions
 */
export function useToggle(defaultVal?: boolean, alternateVal?: boolean, options?: T_UseToggleOptions<boolean>): [boolean, T_ToggleActions<boolean>];

/**
 * Hook overload for strongly-typed two-value toggles.
 * @template D - Type of the default value
 * @template A - Type of the alternate value
 * @param defaultVal - The default value
 * @param alternateVal - The alternate value
 * @param options - Configuration options
 * @returns Tuple containing current state and toggle actions
 */
export function useToggle<const D, const A>(defaultVal: D, alternateVal: A, options?: T_UseToggleOptions<D | A>): [D | A, T_ToggleActions<D | A>];

/**
 * A React hook for managing state that toggles between two values.
 *
 * This hook provides a simple interface for toggling between two predefined values,
 * with additional features like keyboard shortcuts and change callbacks.
 *
 * @template T - The type of values being toggled between
 * @param defaultVal - The primary/initial value of the toggle
 * @param alternateVal - The secondary value to toggle to. For boolean types, defaults to !defaultVal
 * @param options - Additional configuration options including callbacks and keyboard shortcuts
 *
 * @returns A tuple containing:
 *   - `[0]` The current toggle state value
 *   - `[1]` An object with toggle manipulation functions (toggle, setDefault, setAlternate)
 *
 * @example
 * // Simple boolean toggle
 * const [isOpen, { toggle }] = useToggle(false);
 *
 * @example
 * // String value toggle with change handler
 * const [theme, { toggle, setDefault }] = useToggle('light', 'dark', {
 *   onChange: (value) => console.log('Theme changed to:', value)
 * });
 *
 * @example
 * // Toggle with keyboard shortcut
 * const [isVisible, { toggle }] = useToggle(false, true, {
 *   keybind: 'Escape',
 *   toggleOnKeyTo: false // Always hide on Escape
 * });
 *
 * @example
 * // Custom equality for complex objects
 * const [selectedItem, { toggle }] = useToggle(
 *   { id: 1, name: 'Item 1' },
 *   { id: 2, name: 'Item 2' },
 *   {
 *     equals: (a, b) => a.id === b.id
 *   }
 * );
 */
export function useToggle<T>(defaultVal: T, alternateVal?: T, options?: T_UseToggleOptions<T>): [T, T_ToggleActions<T>] {
    const [state, setState] = useState<T>(defaultVal);

    // Resolve alternate value with intelligent defaults for boolean types
    const resolvedAlt = alternateVal ?? ((typeof defaultVal === 'boolean' || defaultVal === undefined ? !defaultVal : null) as T);

    const { onChange, equals, keybind, toggleOnKeyTo } = options ?? {};

    // Memoize equality function to prevent unnecessary re-renders
    const isEqual: T_Equals<T> = useMemo(() => equals ?? ((a, b) => a === b), [equals]);

    // Centralized state update function with change callback
    const update = useCallback(
        (val: T | ((prev: T) => T)) => {
            setState((prev) => {
                const next = typeof val === 'function' ? (val as (p: T) => T)(prev) : val;
                onChange?.(next);
                return next;
            });
        },
        [onChange]
    );

    // Main toggle function with optional specific value setting
    const toggle = useCallback(
        (value?: T) => {
            if (value !== undefined) {
                // If specific value provided and it's valid, set it directly
                if (isEqual(value, defaultVal) || isEqual(value, resolvedAlt)) {
                    update(value);
                    return;
                }
            }
            // Toggle between default and alternate
            update((prev) => (isEqual(prev, defaultVal) ? resolvedAlt : defaultVal));
        },
        [update, isEqual, defaultVal, resolvedAlt]
    );

    // Action functions
    const setDefault = useCallback(() => update(defaultVal), [update, defaultVal]);

    const setAlternate = useCallback(() => update(resolvedAlt), [update, resolvedAlt]);

    // Keybind support
    useEffect(() => {
        if (!keybind) return;

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === keybind) {
                toggle(toggleOnKeyTo);
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [toggle, keybind, toggleOnKeyTo]);

    // Return state and memoized actions object
    return [state, useMemo(() => ({ toggle, setDefault, setAlternate }), [toggle, setDefault, setAlternate])];
}

export default useToggle;
