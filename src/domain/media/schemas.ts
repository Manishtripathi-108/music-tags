import { z } from 'zod';
import {
    REGEX_CAMELOT_KEY,
    REGEX_COMBINED_KEY,
    REGEX_DIGITS,
    REGEX_MUSICAL_KEY,
    REGEX_YEAR,
} from './audio-metadata';

const trimmedString = (max: number, entity: string) =>
    z.string().trim().max(max, `${entity} must be ${max} characters or less`);

export const tagFieldValidators = {
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
    publisher: trimmedString(255, 'Publisher').optional(),
    copyright: trimmedString(255, 'Copyright').optional(),
    isrc: trimmedString(50, 'ISRC').optional(),
    lyrics: z.string().trim().max(50000, 'Lyrics must be 50000 characters or less').optional(),
} as const;

export const TagFormSchema = z.object({
    title: tagFieldValidators.title,
    artist: tagFieldValidators.artist,
    albumArtist: tagFieldValidators.albumArtist,
    album: tagFieldValidators.album,
    trackNumber: tagFieldValidators.trackNumber,
    year: tagFieldValidators.year,
    bpm: tagFieldValidators.bpm,
    genre: tagFieldValidators.genre,
    initialKey: tagFieldValidators.initialKey,
    comment: tagFieldValidators.comment,
    composer: tagFieldValidators.composer,
    publisher: tagFieldValidators.publisher,
    copyright: tagFieldValidators.copyright,
    isrc: tagFieldValidators.isrc,
    lyrics: tagFieldValidators.lyrics,
});

export type TagFormValues = z.infer<typeof TagFormSchema>;

export const TrackPatchSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(255).optional(),
    artist: z.string().trim().max(255).optional(),
    albumArtist: z.string().trim().max(255).optional(),
    album: z.string().trim().max(255).optional(),
    trackNumber: z.number().int().min(1).max(999).nullable().optional(),
    discNumber: z.number().int().min(1).max(99).nullable().optional(),
    year: z.number().int().min(1000).max(2099).nullable().optional(),
    releaseDate: z.string().trim().max(50).nullable().optional(),
    genre: z.string().trim().max(100).optional(),
    bpm: z.number().min(20).max(400).nullable().optional(),
    initialKey: z.string().trim().max(20).optional(),
    comment: z.string().trim().max(2000).optional(),
    composer: z.string().trim().max(255).nullable().optional(),
    conductor: z.string().trim().max(255).nullable().optional(),
    lyricist: z.string().trim().max(255).nullable().optional(),
    publisher: z.string().trim().max(255).nullable().optional(),
    label: z.string().trim().max(255).nullable().optional(),
    copyright: z.string().trim().max(255).nullable().optional(),
    isrc: z.string().trim().max(50).nullable().optional(),
    barcode: z.string().trim().max(50).nullable().optional(),
    catalogNumber: z.string().trim().max(50).nullable().optional(),
    mood: z.string().trim().max(100).nullable().optional(),
    rating: z.number().int().min(0).max(100).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    lyrics: z.string().max(50000).nullable().optional(),
    lyricsUnsynced: z.string().max(50000).nullable().optional(),
    lyricsSyncedJson: z.string().max(100000).nullable().optional(),
});

export type TrackPatch = z.infer<typeof TrackPatchSchema>;

export const InlineEditSchemas = {
    title: tagFieldValidators.title,
    artist: tagFieldValidators.artist,
    album: tagFieldValidators.album,
    year: tagFieldValidators.year,
    bpm: tagFieldValidators.bpm,
} as const;

export type InlineEditField = keyof typeof InlineEditSchemas;

export const ScanFolderRequestSchema = z.object({
    folderPath: z.string().min(1, 'Folder path is required'),
    recursive: z.boolean(),
    forceReindex: z.boolean(),
});

export type ScanFolderRequest = z.infer<typeof ScanFolderRequestSchema>;

export const RemoveFolderRequestSchema = z.object({
    directory: z.string().min(1, 'Directory path is required'),
    syncBeforeDelete: z.boolean().default(false),
});

export type RemoveFolderRequest = z.infer<typeof RemoveFolderRequestSchema>;
