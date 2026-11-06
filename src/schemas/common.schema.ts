import { z } from 'zod';

/**
 * Matches strings composed entirely of digits.
 */
export const REGEX_DIGITS = /^\d+$/;

/**
 * Matches exactly four digits representing a year.
 */
export const REGEX_YEAR = /^\d{4}$/;

/**
 * Matches DD/MM/YYYY or DD-MM-YYYY.
 *
 * This validates the numeric ranges for day, month, and year,
 * but does not verify calendar validity such as 31/02/2024.
 */
export const REGEX_DD_MM_YYYY = /^(0[1-9]|[12]\d|3[01])[/\-](0[1-9]|1[0-2])[/\-](1\d{3}|20\d{2})$/;

/**
 * Matches Camelot Wheel notation such as 8A or 11B.
 */
export const REGEX_CAMELOT_KEY = /^(?:[1-9]|1[0-2])[AB]$/i;

/**
 * Matches standard musical key notation such as Am, C#min, or Gmaj.
 */
export const REGEX_MUSICAL_KEY = /^[A-G][#b]?(?:m|min|maj|minor|major)?$/i;

/**
 * Matches combined musical and Camelot notation such as Am / 8A.
 */
export const REGEX_COMBINED_KEY = /^[A-G][#b]?(?:m|min|maj)?\s*[/\\-]\s*(?:[1-9]|1[0-2])[AB]$/i;

/**
 * Matches an LRC timestamp tag such as [02:31.45] or [00:05.123].
 */
export const REGEX_LRC_TIMESTAMP = /\[\d{2}:\d{2}(?:\.\d{1,3})?\]/;

/**
 * Creates a trimmed string validator with a maximum length.
 */
export const trimmedString = (max: number, entity: string) => z.string().trim().max(max, `${entity} must be ${max} characters or less`);

/**
 * Converts empty values to undefined before applying an optional schema.
 */
export const optionalCoercedNumber = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess((value) => (value === '' || value == null ? undefined : value), schema.optional());

const boundedInteger = (entity: string, min: number, max: number, minMessage: string, maxMessage: string) =>
    optionalCoercedNumber(z.coerce.number().int(`${entity} must be a whole number`).min(min, minMessage).max(max, maxMessage));

const positiveIndex = (entity: string) => boundedInteger(entity, 1, 999, `${entity} must be at least 1`, `${entity} must be 999 or less`);

const optionalText = (max: number, entity: string) => trimmedString(max, entity).optional();

export const coreFieldValidators = {
    title: trimmedString(255, 'Title').min(1, 'Title is required'),

    artist: trimmedString(255, 'Artist'),
    albumArtist: trimmedString(255, 'Album artist'),
    album: trimmedString(255, 'Album name'),

    discNumber: positiveIndex('Disc number'),

    trackNumber: positiveIndex('Track number'),

    releaseDate: z
        .date({
            message: 'Release date must be a valid date',
        })
        .refine((d) => !isNaN(d.getTime()), 'Release date must be a valid date')
        .nullish(),

    year: optionalCoercedNumber(
        z.coerce
            .number()
            .int('Year must be a whole number')
            .refine((value) => value >= 1000 && value <= 2099, 'Year must be a 4-digit year (1000-2099)')
    ),

    bpm: optionalCoercedNumber(z.coerce.number().min(20, 'BPM must be at least 20').max(400, 'BPM must be 400 or less')),

    genre: trimmedString(100, 'Genre'),

    initialKey: trimmedString(20, 'Key').refine(
        (value) => value === '' || REGEX_CAMELOT_KEY.test(value) || REGEX_MUSICAL_KEY.test(value) || REGEX_COMBINED_KEY.test(value),
        'Key must be valid notation (e.g. 8A, Am, C#m)'
    ),

    comment: trimmedString(2000, 'Comment'),

    composer: optionalText(255, 'Composer'),
    conductor: optionalText(255, 'Conductor'),
    lyricist: optionalText(255, 'Lyricist'),
    publisher: optionalText(255, 'Publisher'),
    label: optionalText(255, 'Label'),
    copyright: optionalText(255, 'Copyright'),
    isrc: optionalText(50, 'ISRC'),
    barcode: optionalText(50, 'Barcode'),
    catalogNumber: optionalText(50, 'Catalog number'),
    mood: optionalText(100, 'Mood'),

    rating: optionalCoercedNumber(
        z.coerce.number().int('Rating must be a whole number').min(0, 'Rating must be at least 0').max(100, 'Rating must be 100 or less')
    ),

    lyrics: optionalText(50000, 'Lyrics'),
} as const;
