export const REGEX_DIGITS = /^\d+$/;
export const REGEX_YEAR = /^\d{4}$/;
export const REGEX_CAMELOT_KEY = /^([1-9]|1[0-2])[a-b]$/i;
export const REGEX_MUSICAL_KEY = /^[a-g][#b]?(m|min|maj|minor|major)?$/i;
export const REGEX_COMBINED_KEY = /^[a-g][#b]?(m|min|maj)?\s*[/\\-]\s*([1-9]|1[0-2])[a-b]$/i;

/**
 * Editorial and descriptive metadata for an audio track.
 */
export interface AudioMetadata {
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
