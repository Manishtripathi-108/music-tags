import { z } from 'zod';

import { parseDateSafe } from '@/domain/media/date';
import { hasLrcTimestamps } from '@/domain/media/lyrics';
import { type Track } from '@/domain/media/track';

/**
 * Strips file extension from a filename to derive a sensible default title.
 * Used by `trackOutputSchema` when a track has no embedded title tag.
 * Re-exported via `mappers.ts` for use in domain layer.
 */
export function sanitizeFilenameTitle(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Derives a 4-digit release year from a release date string or Date object.
 * Searches for patterns like "2024" or "1999" within freeform date strings.
 * Used by `trackOutputSchema` to populate the derived `year` field and by
 * `mappers.ts` → `toExifToolWriteTags()` for write-back.
 */
export function deriveYearFromDate(dateStr?: string | Date | null): number | null {
    if (!dateStr) return null;
    if (dateStr instanceof Date) {
        const y = dateStr.getUTCFullYear();
        return isNaN(y) ? null : y;
    }
    const match = String(dateStr).match(/\b(19\d\d|20\d\d)\b/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Determines whether metadata has been modified since initial ingestion
 * by comparing `createdAt` and `updatedAt` timestamps (>1 second delta).
 * Used by `trackOutputSchema` to set the `isModified` flag on Track objects.
 */
export function isTrackModified(meta?: { createdAt?: number | Date | null; updatedAt?: number | Date | null } | null): boolean {
    if (!meta?.updatedAt || !meta?.createdAt) return false;
    const updatedMs = meta.updatedAt instanceof Date ? meta.updatedAt.getTime() : Number(meta.updatedAt);
    const createdMs = meta.createdAt instanceof Date ? meta.createdAt.getTime() : Number(meta.createdAt);
    if (isNaN(updatedMs) || isNaN(createdMs)) return false;
    return updatedMs - createdMs > 1000;
}

import { mediaFileSchema } from './media-file.schema';

/**
 * Schema representing the joined database row for Track construction.
 * Composes `mediaFileSchema` (the `file` field) with a relaxed metadata
 * sub-schema (the `meta` field).
 *
 * **Why `meta` is defined inline rather than derived from `canonicalAudioMetadataInputSchema`:**
 * The canonical schema uses `z.coerce` + `.trim()` + `.max()` because it validates
 * raw, untrusted input from ExifTool/FFprobe. The `meta` sub-schema here validates
 * *already-parsed, trusted DB rows* — coercion and trimming are unnecessary and would
 * add overhead. The field names intentionally mirror the canonical schema to ensure
 * the two stay in sync.
 *
 * Used by:
 * - `trackOutputSchema` — input schema before the `.transform()` step.
 * - `parseTrackFromDb()` — convenience wrapper that feeds into `trackOutputSchema`.
 * - `mappers.ts` → `buildTrackFromDb()` — domain-layer entry point.
 */
export const trackDbRowInputSchema = z.object({
    file: mediaFileSchema,
    meta: z
        .object({
            fileId: z.string().optional().nullable(),
            title: z.string().optional().nullable(),
            artist: z.string().optional().nullable(),
            albumArtist: z.string().optional().nullable(),
            album: z.string().optional().nullable(),
            trackNumber: z.number().optional().nullable(),
            totalTracks: z.number().optional().nullable(),
            discNumber: z.number().optional().nullable(),
            totalDiscs: z.number().optional().nullable(),
            releaseDate: z.preprocess(parseDateSafe, z.date().nullish()),
            originalReleaseDate: z.string().optional().nullable(),
            compilation: z.boolean().optional().nullable(),
            genre: z.string().optional().nullable(),
            composer: z.string().optional().nullable(),
            conductor: z.string().optional().nullable(),
            lyricist: z.string().optional().nullable(),
            publisher: z.string().optional().nullable(),
            label: z.string().optional().nullable(),
            catalogNumber: z.string().optional().nullable(),
            barcode: z.string().optional().nullable(),
            copyright: z.string().optional().nullable(),
            isrc: z.string().optional().nullable(),
            mood: z.string().optional().nullable(),
            comment: z.string().optional().nullable(),
            lyrics: z.string().optional().nullable(),
            lyricsType: z.enum(['synced', 'unsynced']).optional().nullable(),
            bpm: z.number().optional().nullable(),
            initialKey: z.string().optional().nullable(),
            rating: z.number().optional().nullable(),
            durationSeconds: z.number().optional().nullable(),
            containerFormat: z.string().optional().nullable(),
            codec: z.string().optional().nullable(),
            encoder: z.string().optional().nullable(),
            bitrateKbps: z.number().optional().nullable(),
            variableBitrate: z.boolean().optional().nullable(),
            sampleRateHz: z.number().optional().nullable(),
            channels: z.number().optional().nullable(),
            channelLayout: z.string().optional().nullable(),
            bitDepth: z.number().optional().nullable(),
            lossless: z.boolean().optional().nullable(),
            hasCoverArt: z.boolean().optional().nullable(),
            coverArtMime: z.string().optional().nullable(),
            coverArtType: z.string().optional().nullable(),
            coverArtDescription: z.string().optional().nullable(),
            coverArtWidth: z.number().optional().nullable(),
            coverArtHeight: z.number().optional().nullable(),
            createdAt: z.preprocess(parseDateSafe, z.date().nullish()),
            updatedAt: z.preprocess(parseDateSafe, z.date().nullish()),
        })
        .optional()
        .nullable(),
    options: z
        .object({
            forceModified: z.boolean().optional(),
        })
        .optional(),
});

/**
 * Output transform schema that validates raw database rows (via `trackDbRowInputSchema`)
 * and maps them into clean, presentation-ready `Track` domain objects.
 *
 * Applies business logic:
 * - Falls back to sanitised filename when title is missing.
 * - Derives `year` from `releaseDate` / `originalReleaseDate`.
 * - Classifies lyrics type (synced, unsynced, none).
 * - Computes `isModified` flag from timestamp delta.
 *
 * Used exclusively through `parseTrackFromDb()` below, which is the
 * public entry point consumed by `mappers.ts` → `buildTrackFromDb()`.
 */
export const trackOutputSchema = trackDbRowInputSchema.transform((data): Track => {
    const { file, meta, options } = data;

    const rawLyrics = meta?.lyrics ?? null;
    const lyricsType: 'synced' | 'unsynced' | null =
        (meta?.lyricsType as 'synced' | 'unsynced' | null) ?? (rawLyrics ? (hasLrcTimestamps(rawLyrics) ? 'synced' : 'unsynced') : null);
    const isModified = options?.forceModified !== undefined ? options.forceModified : isTrackModified(meta);

    // Derived fields: title fallback to filename, year derived from releaseDate
    const title = meta?.title && meta.title.trim().length > 0 ? meta.title.trim() : sanitizeFilenameTitle(file.filename);

    const year = deriveYearFromDate(meta?.releaseDate) ?? deriveYearFromDate(meta?.originalReleaseDate);

    return {
        // Physical File
        id: file.id,
        filename: file.filename,
        filePath: file.path,
        directory: file.directory,
        extension: file.extension,
        sizeBytes: file.sizeBytes,
        mtimeMs: file.mtimeMs ?? undefined,
        ctimeMs: file.ctimeMs ?? null,
        birthtimeMs: file.birthtimeMs ?? null,
        fileHash: file.fileHash ?? null,
        audioHash: file.audioHash ?? null,

        isMissing: Boolean(file.isMissing),
        isReadOnly: Boolean(file.isReadOnly),
        isLocked: Boolean(file.isLocked),
        isCorrupt: Boolean(file.isCorrupt),
        isSymlink: Boolean(file.isSymlink),

        scanStatus: file.scanStatus ?? null,
        scanError: file.scanError ?? null,
        lastScannedAt: file.lastScannedAt ?? null,
        lastVerifiedAt: file.lastVerifiedAt ?? null,
        isModified,

        // Editorial Metadata
        title,
        artist: meta?.artist ?? '',
        albumArtist: meta?.albumArtist ?? '',
        album: meta?.album ?? '',
        trackNumber: meta?.trackNumber ?? null,
        totalTracks: meta?.totalTracks ?? null,
        discNumber: meta?.discNumber ?? null,
        totalDiscs: meta?.totalDiscs ?? null,
        year,
        releaseDate: meta?.releaseDate ?? null,
        genre: meta?.genre ?? '',
        bpm: meta?.bpm ?? null,
        initialKey: meta?.initialKey ?? '',
        comment: meta?.comment ?? '',
        composer: meta?.composer ?? '',
        conductor: meta?.conductor ?? '',
        lyricist: meta?.lyricist ?? '',
        publisher: meta?.publisher ?? '',
        label: meta?.label ?? '',
        copyright: meta?.copyright ?? '',
        isrc: meta?.isrc ?? '',
        barcode: meta?.barcode ?? '',
        catalogNumber: meta?.catalogNumber ?? '',
        mood: meta?.mood ?? '',
        rating: meta?.rating ?? null,
        description: meta?.comment ?? '',

        // Lyrics
        lyrics: meta?.lyrics ?? '',
        lyricsLanguage: null,
        lyricsType,

        // Technical Audio Specs
        durationSeconds: meta?.durationSeconds ?? undefined,
        bitrateKbps: meta?.bitrateKbps ?? undefined,
        sampleRateHz: meta?.sampleRateHz ?? undefined,
        channels: meta?.channels ?? undefined,
        channelLayout: meta?.channelLayout || undefined,
        bitDepth: meta?.bitDepth ?? undefined,
        codec: meta?.codec || undefined,
        lossless: meta?.lossless ?? false,

        // Artwork
        hasCoverArt: meta?.hasCoverArt ?? false,
        coverArtMime: meta?.coverArtMime ?? null,
        coverArtWidth: meta?.coverArtWidth ?? null,
        coverArtHeight: meta?.coverArtHeight ?? null,
        coverArtType: meta?.coverArtType ?? null,
        coverArtDescription: meta?.coverArtDescription ?? null,
    };
});

/**
 * Convenience wrapper that parses and transforms a database file row + metadata
 * row into a fully validated `Track` domain object.
 *
 * This is the **primary public entry point** — callers should prefer this over
 * using `trackOutputSchema.parse()` directly.
 *
 * Used by `mappers.ts` → `buildTrackFromDb()`.
 */
export function parseTrackFromDb(
    file: z.input<typeof trackDbRowInputSchema>['file'],
    meta?: z.input<typeof trackDbRowInputSchema>['meta'],
    options?: { forceModified?: boolean }
): Track {
    return trackOutputSchema.parse({ file, meta, options });
}
