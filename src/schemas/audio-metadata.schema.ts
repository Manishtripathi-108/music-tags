import { z } from 'zod';
import {
    coercedBoolean,
    nullableCoercedInt,
    nullableCoercedNumber,
    nullableTrimmedString,
} from './common.schema';

/**
 * Input schema for canonical audio metadata before persisting to SQLite.
 * Automatically coerces, trims, validates, and sets safe defaults.
 */
export const canonicalAudioMetadataInputSchema = z.object({
    fileId: z.string().min(1),

    // Track identity
    title: nullableTrimmedString(255),
    artist: nullableTrimmedString(255),
    albumArtist: nullableTrimmedString(255),
    album: nullableTrimmedString(255),

    // Track and disc numbering
    trackNumber: nullableCoercedInt(1, 999),
    totalTracks: nullableCoercedInt(1, 999),
    discNumber: nullableCoercedInt(1, 99),
    totalDiscs: nullableCoercedInt(1, 99),

    // Release & compilation
    releaseDate: nullableTrimmedString(50),
    originalReleaseDate: nullableTrimmedString(50),
    compilation: coercedBoolean(false).nullable(),

    // Genre
    genre: nullableTrimmedString(100),

    // Credits (musically meaningful)
    composer: nullableTrimmedString(255),
    conductor: nullableTrimmedString(255),
    lyricist: nullableTrimmedString(255),

    // Publishing & identifiers
    publisher: nullableTrimmedString(255),
    label: nullableTrimmedString(255),
    catalogNumber: nullableTrimmedString(50),
    barcode: nullableTrimmedString(50),
    copyright: nullableTrimmedString(255),
    isrc: nullableTrimmedString(50),

    // Mood & comment
    mood: nullableTrimmedString(100),
    comment: nullableTrimmedString(2000),

    // Lyrics
    lyrics: nullableTrimmedString(50000),
    lyricsUnsynced: nullableTrimmedString(50000),
    lyricsSyncedJson: nullableTrimmedString(100000),

    // Musical / playback
    bpm: nullableCoercedNumber(20, 400),
    initialKey: nullableTrimmedString(20),
    rating: nullableCoercedInt(0, 100),

    // Technical specifications
    durationSeconds: nullableCoercedNumber(0),
    containerFormat: nullableTrimmedString(50),
    codec: nullableTrimmedString(50),
    encoder: nullableTrimmedString(255),
    bitrateKbps: nullableCoercedInt(1),
    variableBitrate: coercedBoolean(false).nullable(),
    sampleRateHz: nullableCoercedInt(1000),
    channels: nullableCoercedInt(1, 16),
    channelLayout: nullableTrimmedString(50),
    bitDepth: nullableCoercedInt(1, 64),
    lossless: coercedBoolean(false),

    // Artwork
    hasCoverArt: coercedBoolean(false),
    coverArtMime: nullableTrimmedString(100),
    coverArtType: nullableTrimmedString(100),
    coverArtDescription: nullableTrimmedString(255),
    coverArtWidth: nullableCoercedInt(1),
    coverArtHeight: nullableCoercedInt(1),

    // Record timestamps
    createdAt: z.number().int().default(() => Date.now()),
    updatedAt: z.number().int().default(() => Date.now()),
});

export type CanonicalAudioMetadataInput = z.infer<typeof canonicalAudioMetadataInputSchema>;
