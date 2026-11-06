export const REGEX_LRC_TIMESTAMP = /\[\d{2}:\d{2}(?:\.\d{1,3})?\]/;

/**
 * Format classification for lyrics: 'synced' (LRC timestamped) or 'unsynced' (plain text).
 */
export type LyricsType = 'synced' | 'unsynced';

/**
 * Checks whether the given string content contains LRC timestamp markers (e.g. [00:12.34]).
 */
export function hasLrcTimestamps(content?: string | null): boolean {
    if (!content) return false;
    return REGEX_LRC_TIMESTAMP.test(content);
}

/**
 * Lyrics metadata associated with an audio track.
 */
export interface LyricsInfo {
    lyrics?: string | null;
    lyricsType?: LyricsType | null;
    lyricsLanguage?: string | null;
}
