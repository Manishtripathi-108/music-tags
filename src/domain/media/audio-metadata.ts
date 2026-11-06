import { REGEX_CAMELOT_KEY, REGEX_COMBINED_KEY, REGEX_DIGITS, REGEX_MUSICAL_KEY, REGEX_YEAR } from '@/schemas';

export { REGEX_CAMELOT_KEY, REGEX_COMBINED_KEY, REGEX_DIGITS, REGEX_MUSICAL_KEY, REGEX_YEAR };

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
    releaseDate?: Date | null;
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
    createdAt?: Date | null;
    updatedAt?: Date | null;
}
