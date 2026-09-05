import { z } from 'zod';

// --- Regex Constants ---
export const REGEX_DIGITS = /^\d+$/;
export const REGEX_YEAR = /^\d{4}$/;
export const REGEX_CAMELOT_KEY = /^([1-9]|1[0-2])[a-b]$/i;
export const REGEX_MUSICAL_KEY = /^[a-g][#b]?(m|min|maj|minor|major)?$/i;
export const REGEX_COMBINED_KEY = /^[a-g][#b]?(m|min|maj)?\s*[/\\-]\s*([1-9]|1[0-2])[a-b]$/i;
export const REGEX_LRC_TIMESTAMP = /\[\d{2}:\d{2}(?:\.\d{1,3})?\]/;

// --- Reusable Schema Primitives ---

/** Trims string and checks max length */
export const trimmedString = (max: number, entity: string) => z.string().trim().max(max, `${entity} must be ${max} characters or less`);

// --- DRY Core Field Validators ---
export const coreFieldValidators = {
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title must be 255 characters or less'),

    artist: trimmedString(255, 'Artist'),
    albumArtist: trimmedString(255, 'Album artist'),
    album: trimmedString(255, 'Album name'),

    trackNumber: z.coerce
        .number()
        .int('Track number must be a whole number')
        .min(1, 'Track number must be at least 1')
        .max(999, 'Track number must be 999 or less'),

    year: z.coerce
        .number()
        .int('Year must be a whole number')
        .refine((val) => val >= 1000 && val <= 2099, 'Year must be a 4-digit year (1000-2099)'),

    bpm: z.coerce.number().refine((val) => val >= 20 && val <= 400, 'BPM must be between 20 and 400'),

    genre: trimmedString(100, 'Genre'),

    initialKey: z
        .string()
        .trim()
        .max(20, 'Key must be 20 characters or less')
        .refine(
            (val) => !val || REGEX_CAMELOT_KEY.test(val) || REGEX_MUSICAL_KEY.test(val) || REGEX_COMBINED_KEY.test(val),
            'Key must be valid notation (e.g. 8A, Am, C#m)'
        ),

    comment: trimmedString(2000, 'Comment'),

    composer: trimmedString(255, 'Composer').optional(),
    conductor: trimmedString(255, 'Conductor').optional(),
    lyricist: trimmedString(255, 'Lyricist').optional(),
    publisher: trimmedString(255, 'Publisher').optional(),
    label: trimmedString(255, 'Label').optional(),
    copyright: trimmedString(255, 'Copyright').optional(),
    isrc: trimmedString(50, 'ISRC').optional(),
    barcode: trimmedString(50, 'Barcode').optional(),
    catalogNumber: trimmedString(50, 'Catalog number').optional(),
    mood: trimmedString(100, 'Mood').optional(),

    lyrics: z.string().trim().max(50000, 'Lyrics must be 50000 characters or less').optional(),
} as const;
