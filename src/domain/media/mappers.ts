import { type Track } from './track';
import { classifyLyricsType } from './lyrics';

export interface AudioFileDbRecord {
    id: string;
    path: string;
    filename: string;
    directory: string;
    extension: string;
    sizeBytes: number;
    mtimeMs?: number;
    createdAt?: number;
    updatedAt?: number;
}

export interface CanonicalAudioMetadataDbRecord {
    fileId?: string;
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
    dateReleased?: string | null;
    genre?: string | null;
    bpm?: number | null;
    initialKey?: string | null;
    comment?: string | null;
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
    durationSeconds?: number | null;
    bitrateKbps?: number | null;
    sampleRateHz?: number | null;
    channels?: number | null;
    channelLayout?: string | null;
    bitDepth?: number | null;
    codec?: string | null;
    lossless?: boolean | null;
    hasCoverArt?: boolean | null;
    coverArtMime?: string | null;
    coverArtWidth?: number | null;
    coverArtHeight?: number | null;
    coverArtType?: string | null;
    coverArtDescription?: string | null;
    createdAt?: number | null;
    updatedAt?: number | null;
}

/**
 * Strips file extension from a filename to derive a sensible default title.
 */
export function sanitizeFilenameTitle(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Determines whether metadata has been modified since initial ingestion.
 */
export function isTrackModified(
    meta?: { createdAt?: number | null; updatedAt?: number | null } | null
): boolean {
    if (!meta?.updatedAt || !meta?.createdAt) return false;
    return meta.updatedAt - meta.createdAt > 1000;
}

/**
 * Canonical transformation from database rows (audioFiles + canonicalAudioMetadata)
 * into a strongly-typed Track presentation aggregate.
 *
 * This guarantees consistent defaulting and normalization across all API routes and services.
 */
export function buildTrackFromDb(
    file: AudioFileDbRecord,
    meta?: CanonicalAudioMetadataDbRecord | null,
    options: { forceModified?: boolean } = {}
): Track {
    const rawLyrics = meta?.lyrics || meta?.lyricsUnsynced || null;
    const lyricsType = classifyLyricsType(rawLyrics, meta?.lyricsSyncedJson);
    const isModified = options.forceModified !== undefined ? options.forceModified : isTrackModified(meta);

    // Title resolution: meta.title > filename without extension
    const title = meta?.title && meta.title.trim().length > 0
        ? meta.title.trim()
        : sanitizeFilenameTitle(file.filename);

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
        year: meta?.year ?? null,
        releaseDate: meta?.releaseDate ?? meta?.dateReleased ?? null,
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
        description: meta?.description ?? '',

        // Lyrics
        lyrics: meta?.lyrics ?? '',
        lyricsUnsynced: meta?.lyricsUnsynced ?? '',
        lyricsSyncedJson: meta?.lyricsSyncedJson ?? null,
        lyricsLanguage: meta?.lyricsLanguage ?? null,
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
    if (meta.year != null) tagsToWrite.Year = meta.year;
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
