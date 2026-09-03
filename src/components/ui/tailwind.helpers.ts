import { cn } from './cn';

/**
 * Makes SVGs inside buttons/controls behave consistently.
 */
export const SVG_UTILS = '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-5';

/**
 * Keyboard-only focus treatment.
 */
export const FOCUS_RING = [
    'focus-visible:outline-hidden',
    'focus-visible:ring-2',
    'focus-visible:ring-primary/20',
    'focus-visible:ring-offset-1',
].join(' ');

/**
 * Primary form-control focus.
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
    'focus-visible:border-destructive',
    'focus-visible:bg-background',
    'focus-visible:outline-hidden',
    'focus-visible:ring-2',
    'focus-visible:ring-destructive/20',
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
 */
export const DATA_INVALID = [
    'data-[invalid]:border-destructive',
    'data-[invalid]:text-destructive',
    'data-[invalid]:ring-destructive/10',
    'aria-[invalid=true]:border-destructive',
    'aria-[invalid=true]:text-destructive',
    'aria-[invalid=true]:ring-destructive/10',
].join(' ');

/**
 * Optional success state for controls that explicitly expose `data-valid`.
 */
export const DATA_VALID = ['data-[valid]:border-success', 'data-[valid]:ring-success/10'].join(' ');

const FIELD_STYLES = [
    'flex w-full',
    'h-8',
    'px-2.5 py-1',
    'rounded-md',
    'border',
    'border-border',
    'bg-input',
    'text-foreground',
    'placeholder:text-muted-foreground/60',
    'text-xs',
    'shadow-2xs',
    'transition-[border-color,background-color,box-shadow,opacity]',
    'duration-150',
    'ease-out',
].join(' ');

/**
 * Complete style preset for standard field controls.
 */
export const FIELD_CONTROL_STYLES = cn(FIELD_STYLES, FOCUS_RING_PRIMARY, DATA_INVALID, DISABLED);
