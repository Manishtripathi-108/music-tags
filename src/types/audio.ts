import { z } from 'zod';

export const REGEX_DIGITS = /^\d+$/;
export const REGEX_YEAR = /^\d{4}$/;
export const REGEX_CAMELOT_KEY = /^([1-9]|1[0-2])[a-b]$/i;
export const REGEX_MUSICAL_KEY = /^[a-g][#b]?(m|min|maj|minor|major)?$/i;
export const REGEX_COMBINED_KEY = /^[a-g][#b]?(m|min|maj)?\s*[/\\-]\s*([1-9]|1[0-2])[a-b]$/i;
export const REGEX_LRC_TIMESTAMP = /\[\d{2}:\d{2}(?:\.\d{1,3})?\]/;

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

/**
 * Normalized track presentation model used in workstation views and tables.
 */
export interface Track {
    id: string;
    filename: string;
    filePath?: string;
    directory?: string;
    isModified?: boolean;
    title?: string;
    artist?: string;
    albumArtist?: string;
    album?: string;
    trackNumber?: number | null;
    totalTracks?: number | null;
    discNumber?: number | null;
    totalDiscs?: number | null;
    year?: number | null;
    releaseDate?: string | null;
    genre?: string;
    bpm?: number | null;
    initialKey?: string | null;
    sizeBytes?: number;
    comment?: string;
    composer?: string | null;
    conductor?: string | null;
    lyricist?: string | null;
    publisher?: string | null;
    label?: string | null;
    copyright?: string | null;
    isrc?: string | null;
    barcode?: string | null;
    catalogNumber?: string | null;
    mood?: string | null;
    rating?: number | null;
    description?: string | null;
    lyrics?: string | null;
    lyricsUnsynced?: string | null;
    lyricsSyncedJson?: string | null;
    lyricsLanguage?: string | null;
    lyricsType?: 'synced' | 'unsynced' | 'none';
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
    coverArtMime?: string | null;
    coverArtWidth?: number | null;
    coverArtHeight?: number | null;
    coverArtType?: string | null;
    coverArtDescription?: string | null;
}

export type TrackField = keyof Track;

/**
 * Raw key-value tag entry read from extractors.
 */
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

/**
 * Canonical normalized schema persisted in SQLite metadata tables.
 */
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
    releaseTitle?: string | null;
    releaseDate: string | null;
    dateReleased?: string | null;
    originalReleaseDate?: string | null;
    releaseCountry?: string | null;
    releaseType?: string | null;
    mediaType?: string | null;
    compilation?: boolean | null;
    year: number | null;
    originalYear?: number | null;
    genre: string | null;
    genres?: string[] | null;
    composer: string | null;
    conductor: string | null;
    lyricist: string | null;
    arranger?: string | null;
    remixer: string | null;
    engineer?: string | null;
    producer?: string | null;
    mixer?: string | null;
    masteringEngineer?: string | null;
    publisher: string | null;
    label: string | null;
    catalogNumber?: string | null;
    barcode?: string | null;
    copyright: string | null;
    productionCopyright?: string | null;
    language?: string | null;
    script?: string | null;
    country?: string | null;
    mood: string | null;
    description?: string | null;
    comment: string | null;
    lyrics: string | null;
    lyricsLanguage?: string | null;
    lyricsUnsynced: string | null;
    lyricsSyncedJson: string | null;
    isrc: string | null;
    musicBrainzRecordingId?: string | null;
    musicBrainzTrackId?: string | null;
    musicBrainzReleaseId?: string | null;
    musicBrainzReleaseGroupId?: string | null;
    musicBrainzArtistId?: string | null;
    musicBrainzAlbumArtistId?: string | null;
    musicBrainzWorkId?: string | null;
    acoustId?: string | null;
    bpm: number | null;
    initialKey: string | null;
    rating: number | null;
    durationSeconds: number | null;
    durationMilliseconds?: number | null;
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
    coverArtWidth: number | null;
    coverArtHeight: number | null;
    coverArtType: string | null;
    coverArtDescription: string | null;
}

export type ScanJobStatus = 'IDLE' | 'SCANNING' | 'EXTRACTING' | 'NORMALIZING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

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
    currentFile?: string;
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

export interface TracksApiResponse {
    tracks: Track[];
    total: number;
}

export interface TrackDetailApiResponse {
    metadata: Track;
    rawTags: RawTagItem[];
}

export interface TrackPatchApiResponse {
    success: boolean;
    track: Track;
    message?: string;
}

export interface ScanApiResponse {
    success: boolean;
    jobId: string;
    message: string;
}

export interface StatusApiResponse {
    binaries: {
        exiftool?: { found: boolean; version?: string; path?: string; error?: string };
        ffprobe?: { found: boolean; version?: string; path?: string; error?: string };
        ffmpeg?: { found: boolean; version?: string; path?: string; error?: string };
    };
    allReady: boolean;
}

export const RemoveFolderRequestSchema = z.object({
    directory: z.string().min(1, 'Directory path is required'),
    syncBeforeDelete: z.boolean().default(false),
});

export type RemoveFolderRequest = z.infer<typeof RemoveFolderRequestSchema>;

export interface RemoveFolderApiResponse {
    success: boolean;
    removedCount: number;
    syncedCount: number;
    message: string;
}

export const NormalizeLrcRequestSchema = z.object({
    trackId: z.string().min(1, 'Track ID is required'),
    lrcContent: z.string().optional(),
});

export type NormalizeLrcRequest = z.infer<typeof NormalizeLrcRequestSchema>;

export interface NormalizeLrcApiResponse {
    success: boolean;
    trackId: string;
    normalizedLrc: string;
    lrcPath?: string;
    message: string;
}

export const NormalizeAllLyricsRequestSchema = z.object({
    folderPath: z.string().optional(),
});

export type NormalizeAllLyricsRequest = z.infer<typeof NormalizeAllLyricsRequestSchema>;

export interface NormalizeAllLyricsApiResponse {
    success: boolean;
    jobId: string;
    message: string;
}

export type DuplicateMatchMode = 'all' | 'isrc' | 'hash' | 'exact_tags' | 'similar_tags' | 'phonetic';

export interface DuplicateTrackComparison {
    track: Track;
    isRecommendedKeeper: boolean;
    qualityScore: number;
    reasons: string[];
}

export interface DuplicateCluster {
    id: string;
    matchReason: 'isrc' | 'file_hash' | 'exact_tags' | 'similar_tags' | 'phonetic';
    matchReasonLabel: string;
    confidence: number;
    displayTitle: string;
    displayArtist: string;
    tracks: DuplicateTrackComparison[];
}

export interface DuplicateFindOptions {
    mode: DuplicateMatchMode;
    similarityThreshold?: number;
    durationToleranceSec?: number;
    folderPath?: string;
}

export interface DuplicateFindApiResponse {
    clusters: DuplicateCluster[];
    totalDuplicateTracks: number;
    totalClusters: number;
    mode: DuplicateMatchMode;
}

export const ResolveDuplicatesRequestSchema = z.object({
    clusterId: z.string().optional(),
    removeTrackIds: z.array(z.string()).min(1, 'At least one track ID is required'),
    deleteFiles: z.boolean().default(false),
});

export type ResolveDuplicatesRequest = z.infer<typeof ResolveDuplicatesRequestSchema>;

export interface ResolveDuplicatesApiResponse {
    success: boolean;
    removedCount: number;
    deletedFilesCount: number;
    message: string;
}
