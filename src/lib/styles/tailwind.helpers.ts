// Common SVG styling utility
export const SVG_UTILS = '[&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-5 [&_svg]:shrink-0';

// Universal focus ring styling
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-primary/50 focus-visible:ring-offset-1';

// Focus ring when error/invalid
export const FOCUS_RING_ERROR = 'focus-visible:ring-0 focus-visible:ring-danger focus-visible:ring-offset-1';

// Disabled styles
export const DISABLED = 'disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed';

// Data invalid styles
export const DATA_INVALID =
    'user-invalid:border user-invalid:border-danger user-invalid:text-danger user-invalid:ring-red-300 data-[invalid=true]:border data-[invalid=true]:border-danger data-[invalid=true]:text-danger data-[invalid=true]:ring-red-300 aria-[invalid=true]:border aria-[invalid=true]:border-danger aria-[invalid=true]:text-danger aria-[invalid=true]:ring-red-300';
