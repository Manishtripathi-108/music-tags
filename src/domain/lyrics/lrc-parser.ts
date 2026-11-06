import { hasLrcTimestamps } from '../media/lyrics';

export interface LrcTrackMetadata {
    title?: string | null;
    album?: string | null;
    artist?: string | null;
    albumArtist?: string | null;
    durationSeconds?: number | null;
    filename?: string | null;
    filePath?: string | null;
}

export interface NormalizeLrcResult {
    success: boolean;
    normalizedLrc: string;
    originalLinesCount: number;
    preservedTimestampCount: number;
    error?: string;
}

/**
 * Formats a duration in seconds into standard LRC length format (mm:ss.xx).
 * Example: 243.15 -> "04:03.15"
 */
export function formatLrcDuration(seconds?: number | null): string {
    if (seconds == null || isNaN(seconds) || seconds <= 0) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const minsStr = String(minutes).padStart(2, '0');
    const secsStr = remainingSeconds.toFixed(2).padStart(5, '0');
    return `${minsStr}:${secsStr}`;
}

const METADATA_TAG_REGEX = /^\[(ti|al|ar|length|au|by|re|ve|offset):.*\]$/i;

/**
 * Normalizes LRC lyrics content into canonical LRC format with clean header tags
 * and preserved timestamped lyrics lines.
 */
export function normalizeLrc(track: LrcTrackMetadata, lrcContent: string): NormalizeLrcResult {
    if (!lrcContent || typeof lrcContent !== 'string') {
        return {
            success: false,
            normalizedLrc: '',
            originalLinesCount: 0,
            preservedTimestampCount: 0,
            error: 'Empty or invalid LRC content',
        };
    }

    const lines = lrcContent.split(/\r?\n/);
    const lyricLines: string[] = [];
    let originalTimestampCount = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        if (hasLrcTimestamps(trimmed)) {
            originalTimestampCount++;
            lyricLines.push(trimmed);
        } else if (METADATA_TAG_REGEX.test(trimmed)) {
            // Discard existing metadata tag to replace with canonical headers
            continue;
        } else if (trimmed.length > 0) {
            // Non-metadata, non-timestamped line
            if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
                lyricLines.push(trimmed);
            }
        }
    }

    // Safety check: ensure original content contains timestamped lines
    if (originalTimestampCount === 0) {
        return {
            success: false,
            normalizedLrc: lrcContent,
            originalLinesCount: lines.length,
            preservedTimestampCount: 0,
            error: 'No valid timestamped lyric lines detected in content',
        };
    }

    const headerLines: string[] = [];

    const title = (track.title || track.filename?.replace(/\.[^/.]+$/, '') || '').trim();
    if (title) {
        headerLines.push(`[ti:${title}]`);
    }

    const album = (track.album || '').trim();
    if (album) {
        headerLines.push(`[al:${album}]`);
    }

    const artist = (track.artist || track.albumArtist || '').trim();
    if (artist) {
        headerLines.push(`[ar:${artist}]`);
    }

    if (track.durationSeconds && track.durationSeconds > 0) {
        const durationFormatted = formatLrcDuration(track.durationSeconds);
        if (durationFormatted) {
            headerLines.push(`[length:${durationFormatted}]`);
        }
    }

    const outputParts: string[] = [];
    if (headerLines.length > 0) {
        outputParts.push(headerLines.join('\n'));
    }
    if (lyricLines.length > 0) {
        outputParts.push(lyricLines.join('\n'));
    }

    const normalizedLrc = outputParts.join('\n\n') + '\n';

    return {
        success: true,
        normalizedLrc,
        originalLinesCount: lines.length,
        preservedTimestampCount: originalTimestampCount,
    };
}
