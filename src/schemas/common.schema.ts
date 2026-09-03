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
export const trimmedString = (max: number, entity: string) =>
    z.string().trim().max(max, `${entity} must be ${max} characters or less`);

/** Optional trimmed string that coerces empty strings or null to null */
export const nullableTrimmedString = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .optional()
        .nullable()
        .transform((val) => (val && val.length > 0 ? val : null));

/** Integer coercion that accepts number or string, returns integer or null */
export const nullableCoercedInt = (min = 0, max = Number.MAX_SAFE_INTEGER) =>
    z
        .union([z.number(), z.string()])
        .optional()
        .nullable()
        .transform((val) => {
            if (val === null || val === undefined || val === '') return null;
            const parsed = typeof val === 'number' ? Math.floor(val) : parseInt(val, 10);
            return isNaN(parsed) || parsed < min || parsed > max ? null : parsed;
        });

/** Float coercion that accepts number or string, returns float or null */
export const nullableCoercedNumber = (min = 0, max = Number.MAX_SAFE_INTEGER) =>
    z
        .union([z.number(), z.string()])
        .optional()
        .nullable()
        .transform((val) => {
            if (val === null || val === undefined || val === '') return null;
            const parsed = typeof val === 'number' ? val : parseFloat(val);
            return isNaN(parsed) || parsed < min || parsed > max ? null : parsed;
        });

/** Boolean coercion that accepts boolean, number (0/1), or string ('true'/'false') */
export const coercedBoolean = (defaultValue = false) =>
    z
        .union([z.boolean(), z.number(), z.string()])
        .optional()
        .nullable()
        .transform((val) => {
            if (val === null || val === undefined) return defaultValue;
            if (typeof val === 'boolean') return val;
            if (typeof val === 'number') return val === 1;
            return val.toLowerCase() === 'true' || val === '1';
        });

// --- DRY Core Field Validators ---
export const coreFieldValidators = {
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title must be 255 characters or less'),
    artist: trimmedString(255, 'Artist'),
    albumArtist: trimmedString(255, 'Album artist'),
    album: trimmedString(255, 'Album name'),
    trackNumber: z
        .string()
        .refine((val) => !val || (REGEX_DIGITS.test(val) && Number(val) >= 1 && Number(val) <= 999), {
            message: 'Track # must be between 1 and 999',
        }),
    year: z
        .string()
        .refine((val) => !val || (REGEX_YEAR.test(val) && Number(val) >= 1000 && Number(val) <= 2099), {
            message: 'Year must be a 4-digit year (1000–2099)',
        }),
    bpm: z
        .string()
        .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 20 && Number(val) <= 400), {
            message: 'BPM must be between 20 and 400',
        }),
    genre: trimmedString(100, 'Genre'),
    initialKey: z
        .string()
        .trim()
        .max(20, 'Key must be 20 characters or less')
        .refine(
            (val) => !val || REGEX_CAMELOT_KEY.test(val) || REGEX_MUSICAL_KEY.test(val) || REGEX_COMBINED_KEY.test(val),
            { message: 'Key must be valid notation (e.g. 8A, Am, C#m)' }
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
