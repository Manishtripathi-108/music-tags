import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind CSS conflict resolution.
 * @param {...ClassValue[]} inputs - Class names to merge.
 * @returns {string} - Merged class names.
 */
export const cn = (...inputs: ClassValue[]): string => {
    return twMerge(clsx(...inputs));
};

export default cn;
