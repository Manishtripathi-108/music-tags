import { cn } from '../utils';

/**
 * Makes SVGs inside buttons/controls behave consistently.
 */
export const SVG_UTILS = '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-5';

/**
 * Keyboard-only focus treatment.
 *
 * `focus-visible` is preferred over `focus` so mouse clicks don't create
 * unnecessary focus rings.
 */
export const FOCUS_RING = [
    'focus-visible:outline-hidden',
    'focus-visible:ring-2',
    'focus-visible:ring-primary/20',
    'focus-visible:ring-offset-1',
].join(' ');

/**
 * Primary form-control focus.
 *
 * Subtle background + border transition makes inputs feel more responsive
 * without being visually heavy.
 */
export const FOCUS_RING_PRIMARY = [
    'focus-visible:border-primary',
    'focus-visible:bg-background',
    'focus-visible:outline-hidden',
    'focus-visible:ring-2',
    'focus-visible:ring-primary/20',
    'focus-visible:ring-offset-1',
].join(' ');

/**
 * Error / invalid focus.
 */
export const FOCUS_RING_ERROR = [
    'focus-visible:border-danger',
    'focus-visible:bg-background',
    'focus-visible:outline-hidden',
    'focus-visible:ring-2',
    'focus-visible:ring-danger/20',
    'focus-visible:ring-offset-1',
].join(' ');

/**
 * Works for native disabled controls.
 */
export const DISABLED = [
    'disabled:pointer-events-none',
    'disabled:cursor-not-allowed',
    'disabled:opacity-40',

    'data-disabled:pointer-events-none',
    'data-disabled:opacity-40',
].join(' ');

export const READONLY = ['read-only:cursor-default', 'read-only:bg-muted/40', 'read-only:opacity-80'].join(' ');

/**
 * Ark UI Field exposes `[data-invalid]` when the field is invalid.
 *
 * `aria-invalid` is kept as a fallback for components/forms that don't use
 * Ark UI.
 *
 * Native `user-invalid` is intentionally omitted here because React Hook Form
 * + Zod/Ark validation should be the source of truth for this component.
 */
export const DATA_INVALID = [
    'data-[invalid]:border-danger',
    'data-[invalid]:text-danger',
    'data-[invalid]:ring-danger/10',

    'aria-[invalid=true]:border-danger',
    'aria-[invalid=true]:text-danger',
    'aria-[invalid=true]:ring-danger/10',
].join(' ');

/**
 * Optional success state for controls that explicitly expose `data-valid`.
 */
export const DATA_VALID = ['data-[valid]:border-success', 'data-[valid]:ring-success/10'].join(' ');

const FIELD_STYLES = [
    'flex w-full',

    // Size
    'h-8',
    'px-2.5 py-1',

    // Shape
    'rounded-md',
    'border',

    // Colors
    'border-border',
    'bg-input',
    'text-foreground',
    'placeholder:text-muted-foreground/60',

    // Typography
    'text-xs',

    // Depth
    'shadow-2xs',

    // Interaction
    'transition-[border-color,background-color,box-shadow,opacity]',
    'duration-150',
    'ease-out',
].join(' ');

/**
 * Complete style preset for standard field controls.
 */
export const FIELD_CONTROL_STYLES = cn(FIELD_STYLES, FOCUS_RING_PRIMARY, DATA_INVALID, DISABLED);
