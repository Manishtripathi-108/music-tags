import { z } from 'zod';

import { classifyLyricsType } from '@/domain/media/lyrics';
import { type Track } from '@/domain/media/track';

/**
 * Strips file extension from a filename to derive a sensible default title.
 */
export function sanitizeFilenameTitle(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Derives a 4-digit release year from a release date string.
 */
export function deriveYearFromDate(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(19\d\d|20\d\d)\b/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Determines whether metadata has been modified since initial ingestion.
 */
export function isTrackModified(meta?: { createdAt?: number | null; updatedAt?: number | null } | null): boolean {
    if (!meta?.updatedAt || !meta?.createdAt) return false;
    return meta.updatedAt - meta.createdAt > 1000;
}

/**
 * Schema representing the joined database row or input for track construction.
 */
export const trackDbRowInputSchema = z.object({
    file: z.object({
        id: z.string(),
        path: z.string(),
        filename: z.string(),
        directory: z.string(),
        extension: z.string(),
        sizeBytes: z.number().int().nonnegative(),
        mtimeMs: z.number().optional().nullable(),
        createdAt: z.number().optional().nullable(),
        updatedAt: z.number().optional().nullable(),
    }),
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
            releaseDate: z.string().optional().nullable(),
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
            lyricsUnsynced: z.string().optional().nullable(),
            lyricsSyncedJson: z.string().optional().nullable(),
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
            createdAt: z.number().optional().nullable(),
            updatedAt: z.number().optional().nullable(),
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
 * Output transform schema that validates and modifies raw database records
 * into clean, presentation-ready Track domain objects.
 */
export const trackOutputSchema = trackDbRowInputSchema.transform((data): Track => {
    const { file, meta, options } = data;

    const rawLyrics = meta?.lyrics || meta?.lyricsUnsynced || null;
    const lyricsType = classifyLyricsType(rawLyrics, meta?.lyricsSyncedJson);
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
        lyricsUnsynced: meta?.lyricsUnsynced ?? '',
        lyricsSyncedJson: meta?.lyricsSyncedJson ?? null,
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
 * Modifier helper to parse and transform database row data into a verified Track.
 */
export function parseTrackFromDb(
    file: z.infer<typeof trackDbRowInputSchema>['file'],
    meta?: z.infer<typeof trackDbRowInputSchema>['meta'],
    options?: { forceModified?: boolean }
): Track {
    return trackOutputSchema.parse({ file, meta, options });
}
