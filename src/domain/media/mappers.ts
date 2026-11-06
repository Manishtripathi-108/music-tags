import { deriveYearFromDate, isTrackModified, parseTrackFromDb, sanitizeFilenameTitle } from '@/schemas/track-output.schema';

import { type Track } from './track';

export { sanitizeFilenameTitle, isTrackModified, deriveYearFromDate };

import { type CanonicalAudioMetadataOutput } from '@/schemas/audio-metadata.schema';
import { type MediaFileInput } from '@/schemas/media-file.schema';

/**
 * Makes every property of T both optional and nullable.
 * Used to represent loose DB row shapes where any field may be absent or null.
 */
type NullablePartial<T> = { [K in keyof T]?: T[K] | null };

/**
 * Loose representation of a canonical audio metadata DB row.
 * Derived from `CanonicalAudioMetadataOutput` (Zod schema output) with every
 * field made optional and nullable, plus `year` which is a derived/computed
 * field not present in the canonical schema.
 *
 * Used by:
 * - `buildTrackFromDb()` — types the `meta` parameter.
 * - `toExifToolWriteTags()` — types the input for tag write-back.
 */
export type CanonicalAudioMetadataDbRecord = NullablePartial<CanonicalAudioMetadataOutput> & {
    year?: number | null;
};

/**
 * Parses raw database rows through trackOutputSchema into a verified, modified Track.
 */
export function buildTrackFromDb(
    file: MediaFileInput,
    meta?: CanonicalAudioMetadataDbRecord | null,
    options: { forceModified?: boolean } = {}
): Track {
    return parseTrackFromDb(file, meta, options);
}

/**
 * Maps metadata values to ExifTool tag arguments for writing back to files.
 */
export function toExifToolWriteTags(meta: Partial<CanonicalAudioMetadataDbRecord>): Record<string, string | number | null> {
    const tagsToWrite: Record<string, string | number | null> = {};

    if (meta.title) tagsToWrite.Title = meta.title;
    if (meta.artist) tagsToWrite.Artist = meta.artist;
    if (meta.album) tagsToWrite.Album = meta.album;
    if (meta.albumArtist) tagsToWrite.AlbumArtist = meta.albumArtist;
    if (meta.trackNumber != null) tagsToWrite.TrackNumber = meta.trackNumber;
    if (meta.discNumber != null) tagsToWrite.DiscNumber = meta.discNumber;
    if (meta.year != null) {
        tagsToWrite.Year = meta.year;
    } else if (meta.releaseDate) {
        const year = deriveYearFromDate(meta.releaseDate);
        if (year != null) tagsToWrite.Year = year;
    }
    if (meta.genre) tagsToWrite.Genre = meta.genre;
    if (meta.bpm != null) tagsToWrite.BPM = meta.bpm;
    if (meta.initialKey) tagsToWrite.InitialKey = meta.initialKey;
    if (meta.composer) tagsToWrite.Composer = meta.composer;
    if (meta.publisher) tagsToWrite.Publisher = meta.publisher;
    if (meta.copyright) tagsToWrite.Copyright = meta.copyright;
    if (meta.comment) tagsToWrite.Comment = meta.comment;
    if (meta.isrc) tagsToWrite.ISRC = meta.isrc;

    if (meta.lyrics) {
        tagsToWrite.Lyrics = meta.lyrics;
    }

    return tagsToWrite;
}

import { parseDateSafe } from './date';

/**
 * Ensures all date fields on a Track (which may be ISO strings after JSON deserialization over HTTP)
 * are revived into real native JavaScript Date instances or null.
 */
export function hydrateTrackDates(track: Track): Track {
    return {
        ...track,
        releaseDate: parseDateSafe(track.releaseDate),
        createdAt: parseDateSafe(track.createdAt),
        updatedAt: parseDateSafe(track.updatedAt),
        lastScannedAt: parseDateSafe(track.lastScannedAt),
        lastVerifiedAt: parseDateSafe(track.lastVerifiedAt),
    };
}

