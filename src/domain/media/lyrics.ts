export const REGEX_LRC_TIMESTAMP = /\[\d{2}:\d{2}(?:\.\d{1,3})?\]/;

export type LyricsType = 'synced' | 'unsynced' | 'none';

/**
 * Checks whether the given string content contains LRC timestamp markers.
 */
export function isLrcContent(content?: string | null): boolean {
    if (!content) return false;
    return REGEX_LRC_TIMESTAMP.test(content);
}

/**
 * Classifies the lyrics type based on content, synced JSON, or explicit type.
 */
export function classifyLyricsType(rawLyrics?: string | null, syncedJson?: string | null): LyricsType {
    if (syncedJson || isLrcContent(rawLyrics)) {
        return 'synced';
    }
    if (rawLyrics && rawLyrics.trim().length > 0) {
        return 'unsynced';
    }
    return 'none';
}

/**
 * Lyrics metadata associated with an audio track.
 */
export interface LyricsInfo {
    lyrics?: string | null;
    lyricsUnsynced?: string | null;
    lyricsSyncedJson?: string | null;
    lyricsLanguage?: string | null;
    lyricsType?: LyricsType;
}
