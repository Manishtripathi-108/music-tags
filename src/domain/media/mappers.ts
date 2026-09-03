import { type Track } from './track';
import {
    parseTrackFromDb,
    sanitizeFilenameTitle,
    isTrackModified,
    deriveYearFromDate,
} from '@/schemas/track-output.schema';

export { sanitizeFilenameTitle, isTrackModified, deriveYearFromDate };

export type AudioFileDbRecord = {
    id: string;
    path: string;
    filename: string;
    directory: string;
    extension: string;
    sizeBytes: number;
    mtimeMs?: number | null;
    createdAt?: number | null;
    updatedAt?: number | null;
};

export type CanonicalAudioMetadataDbRecord = {
    fileId?: string | null;
    title?: string | null;
    artist?: string | null;
    albumArtist?: string | null;
    album?: string | null;
    trackNumber?: number | null;
    totalTracks?: number | null;
    discNumber?: number | null;
    totalDiscs?: number | null;
    year?: number | null;
    releaseDate?: string | null;
    originalReleaseDate?: string | null;
    compilation?: boolean | null;
    genre?: string | null;
    composer?: string | null;
    conductor?: string | null;
    lyricist?: string | null;
    publisher?: string | null;
    label?: string | null;
    catalogNumber?: string | null;
    barcode?: string | null;
    copyright?: string | null;
    isrc?: string | null;
    mood?: string | null;
    comment?: string | null;
    lyrics?: string | null;
    lyricsUnsynced?: string | null;
    lyricsSyncedJson?: string | null;
    bpm?: number | null;
    initialKey?: string | null;
    rating?: number | null;
    durationSeconds?: number | null;
    containerFormat?: string | null;
    codec?: string | null;
    encoder?: string | null;
    bitrateKbps?: number | null;
    variableBitrate?: boolean | null;
    sampleRateHz?: number | null;
    channels?: number | null;
    channelLayout?: string | null;
    bitDepth?: number | null;
    lossless?: boolean | null;
    hasCoverArt?: boolean | null;
    coverArtMime?: string | null;
    coverArtType?: string | null;
    coverArtDescription?: string | null;
    coverArtWidth?: number | null;
    coverArtHeight?: number | null;
    createdAt?: number | null;
    updatedAt?: number | null;
};

/**
 * Parses raw database rows through trackOutputSchema into a verified, modified Track.
 */
export function buildTrackFromDb(
    file: AudioFileDbRecord,
    meta?: CanonicalAudioMetadataDbRecord | null,
    options: { forceModified?: boolean } = {}
): Track {
    return parseTrackFromDb(file, meta, options);
}

/**
 * Maps metadata values to ExifTool tag arguments for writing back to files.
 */
export function toExifToolWriteTags(
    meta: Partial<CanonicalAudioMetadataDbRecord>
): Record<string, string | number | null> {
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

    const lyricsContent = meta.lyrics || meta.lyricsUnsynced;
    if (lyricsContent) {
        tagsToWrite.Lyrics = lyricsContent;
    }

    return tagsToWrite;
}
