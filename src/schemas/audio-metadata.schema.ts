import { z } from 'zod';

export const canonicalAudioMetadataInputSchema = z.object({
    fileId: z.string().min(1),

    // Track identity
    title: z.coerce.string().trim().max(255).nullable(),
    artist: z.coerce.string().trim().max(255).nullable(),
    albumArtist: z.coerce.string().trim().max(255).nullable(),
    album: z.coerce.string().trim().max(255).nullable(),

    // Track and disc numbering
    trackNumber: z.coerce.number().int().min(1).max(999).nullable(),
    totalTracks: z.coerce.number().int().min(1).max(999).nullable(),
    discNumber: z.coerce.number().int().min(1).max(99).nullable(),
    totalDiscs: z.coerce.number().int().min(1).max(99).nullable(),

    // Release & compilation
    releaseDate: z.coerce.string().trim().max(50).nullable(),
    originalReleaseDate: z.coerce.string().trim().max(50).nullable(),
    compilation: z.coerce.boolean().nullable(),

    // Genre
    genre: z.coerce.string().trim().max(100).nullable(),

    // Credits
    composer: z.coerce.string().trim().max(255).nullable(),
    conductor: z.coerce.string().trim().max(255).nullable(),
    lyricist: z.coerce.string().trim().max(255).nullable(),

    // Publishing & identifiers
    publisher: z.coerce.string().trim().max(255).nullable(),
    label: z.coerce.string().trim().max(255).nullable(),
    catalogNumber: z.coerce.string().trim().max(50).nullable(),
    barcode: z.coerce.string().trim().max(50).nullable(),
    copyright: z.coerce.string().trim().max(255).nullable(),
    isrc: z.coerce.string().trim().max(50).nullable(),

    // Mood & comment
    mood: z.coerce.string().trim().max(100).nullable(),
    comment: z.coerce.string().trim().max(2000).nullable(),

    // Lyrics
    lyrics: z.coerce.string().trim().max(50_000).nullable(),
    lyricsUnsynced: z.coerce.string().trim().max(50_000).nullable(),
    lyricsSyncedJson: z.coerce.string().trim().max(100_000).nullable(),

    // Musical / playback
    bpm: z.coerce.number().min(20).max(400).nullable(),
    initialKey: z.coerce.string().trim().max(20).nullable(),
    rating: z.coerce.number().int().min(0).max(100).nullable(),

    // Technical specifications
    durationSeconds: z.coerce.number().nonnegative().nullable(),
    containerFormat: z.coerce.string().trim().max(50).nullable(),
    codec: z.coerce.string().trim().max(50).nullable(),
    encoder: z.coerce.string().trim().max(255).nullable(),
    bitrateKbps: z.coerce.number().int().positive().nullable(),
    variableBitrate: z.coerce.boolean().nullable(),
    sampleRateHz: z.coerce.number().int().min(1_000).nullable(),
    channels: z.coerce.number().int().min(1).max(16).nullable(),
    channelLayout: z.coerce.string().trim().max(50).nullable(),
    bitDepth: z.coerce.number().int().min(1).max(64).nullable(),
    lossless: z.coerce.boolean(),

    // Artwork
    hasCoverArt: z.coerce.boolean(),
    coverArtMime: z.coerce.string().trim().max(100).nullable(),
    coverArtType: z.coerce.string().trim().max(100).nullable(),
    coverArtDescription: z.coerce.string().trim().max(255).nullable(),
    coverArtWidth: z.coerce.number().int().positive().nullable(),
    coverArtHeight: z.coerce.number().int().positive().nullable(),

    // Record timestamps
    updatedAt: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(() => Date.now()),
});

export type CanonicalAudioMetadataInput = z.infer<typeof canonicalAudioMetadataInputSchema>;
