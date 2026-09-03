/**
 * Formats a duration in seconds into mm:ss or hh:mm:ss.
 */
export function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null || isNaN(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats a byte count into a readable string (e.g. "5.2 MB").
 */
export function formatFileSize(bytes: number | null | undefined): string {
    if (bytes == null || isNaN(bytes) || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Formats audio bitrate in kbps (e.g. "320 kbps").
 */
export function formatBitrate(kbps: number | null | undefined): string {
    if (kbps == null || isNaN(kbps) || kbps <= 0) return '-';
    return `${Math.round(kbps)} kbps`;
}

/**
 * Formats audio sample rate in Hz to kHz or Hz (e.g. "44.1 kHz").
 */
export function formatSampleRate(hz: number | null | undefined): string {
    if (hz == null || isNaN(hz) || hz <= 0) return '-';
    if (hz >= 1000) {
        return `${(hz / 1000).toFixed(1)} kHz`;
    }
    return `${hz} Hz`;
}
