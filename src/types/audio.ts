import { z } from 'zod';

/* ────────────────────────────────────────────────────────────
 * Precompiled Regular Expressions
 * Hoisted at module scope to avoid re-compilation on every parse.
 * ──────────────────────────────────────────────────────────── */

export const REGEX_DIGITS = /^\d+$/;
export const REGEX_YEAR = /^\d{4}$/;
export const REGEX_CAMELOT_KEY = /^([1-9]|1[0-2])[a-b]$/i;
export const REGEX_MUSICAL_KEY = /^[a-g][#b]?(m|min|maj|minor|major)?$/i;
export const REGEX_COMBINED_KEY = /^[a-g][#b]?(m|min|maj)?\s*[/\\-]\s*([1-9]|1[0-2])[a-b]$/i;

/* ────────────────────────────────────────────────────────────
 * Audio Extensions Constants & Types
 * ──────────────────────────────────────────────────────────── */

export const SUPPORTED_AUDIO_EXTENSIONS_LIST = [
    '.mp3',
    '.flac',
    '.m4a',
    '.mp4',
    '.aac',
    '.ogg',
    '.opus',
    '.wav',
    '.aiff',
    '.aif',
    '.wma',
    '.alac',
    '.ape',
] as const;

export type SupportedAudioExtension = (typeof SUPPORTED_AUDIO_EXTENSIONS_LIST)[number];

export const SUPPORTED_AUDIO_EXTENSIONS: ReadonlySet<string> = new Set<string>(SUPPORTED_AUDIO_EXTENSIONS_LIST);

export function isSupportedAudioExtension(ext: string): ext is SupportedAudioExtension {
    return SUPPORTED_AUDIO_EXTENSIONS.has(ext.toLowerCase());
}

/* ────────────────────────────────────────────────────────────
 * Track & Metadata Interfaces
 * ──────────────────────────────────────────────────────────── */

export interface Track {
    id: string;
    filename: string;
    filePath?: string;
    title?: string;
    artist?: string;
    albumArtist?: string;
    album?: string;
    trackNumber?: number | null;
    discNumber?: number | null;
    year?: number | null;
    genre?: string;
    bpm?: number | null;
    initialKey?: string;
    comment?: string;
    durationSeconds?: number;
    bitrateKbps?: number;
    sampleRateHz?: number;
    channels?: number;
    channelLayout?: string;
    bitDepth?: number;
    codec?: string;
    extension: string;
    lossless?: boolean;
    hasCoverArt?: boolean;
}

export type TrackField = keyof Track;

export interface RawTag {
    tag: string;
    group: string;
    value: string | number | boolean | null;
    description?: string;
    isWritable?: boolean;
}

export interface RawTagItem extends RawTag {
    description: string;
    isWritable: boolean;
}

export interface ActiveTrackDetail {
    metadata: Track | null;
    rawTags: RawTag[];
    isLoading: boolean;
}

export interface CanonicalAudioMetadata {
    fileId: string;
    title: string | null;
    artist: string | null;
    albumArtist: string | null;
    album: string | null;
    trackNumber: number | null;
    totalTracks: number | null;
    discNumber: number | null;
    totalDiscs: number | null;
    year: number | null;
    dateReleased: string | null;
    releaseDate?: string | null;
    genre: string | null;
    genres?: string[] | null;
    composer: string | null;
    conductor: string | null;
    lyricist: string | null;
    remixer: string | null;
    publisher: string | null;
    label: string | null;
    copyright: string | null;
    isrc: string | null;
    bpm: number | null;
    initialKey: string | null;
    mood: string | null;
    rating: number | null;
    comment: string | null;
    durationSeconds: number | null;
    bitrateKbps: number | null;
    bitrateType: string | null;
    sampleRateHz: number | null;
    channels: number | null;
    channelLayout: string | null;
    bitDepth: number | null;
    codec: string | null;
    lossless: boolean;
    hasCoverArt: boolean;
    coverArtMime: string | null;
}

/* ────────────────────────────────────────────────────────────
 * Scan Job & Progress Models
 * ──────────────────────────────────────────────────────────── */

export type ScanJobStatus = 'IDLE' | 'SCANNING' | 'EXTRACTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BaseScanStats {
    status: ScanJobStatus;
    scannedFiles: number;
    extractedFiles: number;
    totalEstimated: number;
    filesPerSecond: number;
    indexedFiles?: number;
    currentDirectory?: string;
    errorMessage?: string;
}

export interface ScanJob extends BaseScanStats {
    jobId?: string;
}

export interface ScanProgressEvent extends BaseScanStats {
    jobId: string;
    currentFile?: string;
}

export const ScanFolderRequestSchema = z.object({
    folderPath: z.string().min(1, 'Folder path is required'),
    recursive: z.boolean(),
    forceReindex: z.boolean(),
});

export type ScanFolderRequest = z.infer<typeof ScanFolderRequestSchema>;

/* ────────────────────────────────────────────────────────────
 * Modular Zod Field Validators (DRY & Single Source of Truth)
 * ──────────────────────────────────────────────────────────── */

const trimmedString = (max: number, entity: string) => z.string().trim().max(max, `${entity} must be ${max} characters or less`);

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
        .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 20 && Number(val) <= 400), { message: 'BPM must be between 20 and 400' }),
    genre: trimmedString(100, 'Genre'),
    initialKey: z
        .string()
        .trim()
        .max(20, 'Key must be 20 characters or less')
        .refine((val) => !val || REGEX_CAMELOT_KEY.test(val) || REGEX_MUSICAL_KEY.test(val) || REGEX_COMBINED_KEY.test(val), {
            message: 'Key must be valid notation (e.g. 8A, Am, C#m)',
        }),
    comment: trimmedString(2000, 'Comment'),
} as const;

/* ────────────────────────────────────────────────────────────
 * Inspector Tag Form Schema
 * ──────────────────────────────────────────────────────────── */

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
});

export type TagFormValues = z.infer<typeof TagFormSchema>;

/* ────────────────────────────────────────────────────────────
 * Track Patch Schema (API Updates)
 * ──────────────────────────────────────────────────────────── */

export const TrackPatchSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(255),
    artist: z.string().trim().max(255).optional(),
    albumArtist: z.string().trim().max(255).optional(),
    album: z.string().trim().max(255).optional(),
    trackNumber: z.number().int().min(1).max(999).nullable().optional(),
    year: z.number().int().min(1000).max(2099).nullable().optional(),
    genre: z.string().trim().max(100).optional(),
    bpm: z.number().min(20).max(400).nullable().optional(),
    initialKey: z.string().trim().max(20).optional(),
    comment: z.string().trim().max(2000).optional(),
});

export type TrackPatch = z.infer<typeof TrackPatchSchema>;

/* ────────────────────────────────────────────────────────────
 * Inline Cell Edit Schemas
 * Reuses tagFieldValidators for consistency and high performance.
 * ──────────────────────────────────────────────────────────── */

export const InlineEditSchemas = {
    title: tagFieldValidators.title,
    artist: tagFieldValidators.artist,
    album: tagFieldValidators.album,
    year: tagFieldValidators.year,
    bpm: tagFieldValidators.bpm,
} as const;

export type InlineEditField = keyof typeof InlineEditSchemas;
