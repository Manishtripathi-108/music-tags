import { z } from 'zod';

import { parseDateOrNow, parseDateSafe } from '@/domain/media/date';

/**
 * Canonical schema for normalised audio metadata as persisted in the
 * `audio_metadata` SQLite table. Uses `z.coerce` throughout because input
 * arrives from heterogeneous sources (ExifTool JSON, FFprobe output, raw tag
 * strings) and must be coerced into consistent types.
 *
 * Used by:
 * - `metadata-normalizer.ts` — parses merged ExifTool + FFprobe output into
 *   this canonical shape before persistence.
 * - `audio-repository.ts` — validates canonical metadata before INSERT/UPDATE
 *   into the `audio_metadata` table.
 * - `metadata-normalizer.ts` — types the normalised output as
 *   `CanonicalAudioMetadataInput`.
 */
export const canonicalAudioMetadataInputSchema = z.object({
    fileId: z.string().min(1),

    // Track identity
    title: z.coerce.string().trim().max(255).nullish(),
    artist: z.coerce.string().trim().max(255).nullish(),
    albumArtist: z.coerce.string().trim().max(255).nullish(),
    album: z.coerce.string().trim().max(255).nullish(),

    // Track and disc numbering
    trackNumber: z.coerce.number().int().min(1).max(999).nullish(),
    totalTracks: z.coerce.number().int().min(1).max(999).nullish(),
    discNumber: z.coerce.number().int().min(1).max(99).nullish(),
    totalDiscs: z.coerce.number().int().min(1).max(99).nullish(),

    // Release & compilation
    releaseDate: z.preprocess(parseDateSafe, z.date().nullish()),
    originalReleaseDate: z.coerce.string().trim().max(50).nullish(),
    compilation: z.coerce.boolean().nullish(),

    // Genre
    genre: z.coerce.string().trim().max(100).nullish(),

    // Credits
    composer: z.coerce.string().trim().max(255).nullish(),
    conductor: z.coerce.string().trim().max(255).nullish(),
    lyricist: z.coerce.string().trim().max(255).nullish(),

    // Publishing & identifiers
    publisher: z.coerce.string().trim().max(255).nullish(),
    label: z.coerce.string().trim().max(255).nullish(),
    catalogNumber: z.coerce.string().trim().max(50).nullish(),
    barcode: z.coerce.string().trim().max(50).nullish(),
    copyright: z.coerce.string().trim().max(255).nullish(),
    isrc: z.coerce.string().trim().max(50).nullish(),

    // Mood & comment
    mood: z.coerce.string().trim().max(100).nullish(),
    comment: z.coerce.string().trim().max(2000).nullish(),

    // Lyrics
    lyrics: z.coerce.string().trim().max(100_000).nullish(),
    lyricsType: z.enum(['synced', 'unsynced']).nullish(),

    // Musical / playback
    bpm: z.coerce.number().min(20).max(400).nullish(),
    initialKey: z.coerce.string().trim().max(20).nullish(),
    rating: z.coerce.number().int().min(0).max(100).nullish(),

    // Technical specifications
    durationSeconds: z.coerce.number().nonnegative().nullish(),
    containerFormat: z.coerce.string().trim().max(50).nullish(),
    codec: z.coerce.string().trim().max(50).nullish(),
    encoder: z.coerce.string().trim().max(255).nullish(),
    bitrateKbps: z.coerce.number().int().positive().nullish(),
    variableBitrate: z.coerce.boolean().nullish(),
    sampleRateHz: z.coerce.number().int().min(1_000).nullish(),
    channels: z.coerce.number().int().min(1).max(16).nullish(),
    channelLayout: z.coerce.string().trim().max(50).nullish(),
    bitDepth: z.coerce.number().int().min(1).max(64).nullish(),
    lossless: z.coerce.boolean().default(false),

    // Artwork
    hasCoverArt: z.coerce.boolean().default(false),
    coverArtMime: z.coerce.string().trim().max(100).nullish(),
    coverArtType: z.coerce.string().trim().max(100).nullish(),
    coverArtDescription: z.coerce.string().trim().max(255).nullish(),
    coverArtWidth: z.coerce.number().int().positive().nullish(),
    coverArtHeight: z.coerce.number().int().positive().nullish(),

    // Record timestamps
    createdAt: z.preprocess(parseDateOrNow, z.date().default(() => new Date())),
    updatedAt: z.preprocess(parseDateOrNow, z.date().default(() => new Date())),
});

/**
 * Pre-parse input type — accepts raw heterogeneous values before coercion.
 * Used as the parameter type in `audio-repository.upsertCanonicalMetadata()`.
 */
export type CanonicalAudioMetadataInput = z.input<typeof canonicalAudioMetadataInputSchema>;

/**
 * Post-parse output type — all values coerced, trimmed, and defaults applied.
 * Used by `CanonicalAudioMetadataDbRecord` (derived in `mappers.ts`) for
 * typed access to validated DB rows.
 */
export type CanonicalAudioMetadataOutput = z.infer<typeof canonicalAudioMetadataInputSchema>;
