/**
 * Safe domain utilities for Eclipse audio streaming and URL normalization.
 * Safe for both Client Components and Server code (no Node.js fs/child_process imports).
 */

/**
 * Checks whether a URL or content string represents an MPEG-DASH manifest (.mpd).
 */
export function isDashManifestUrl(url?: string, contentType?: string): boolean {
    if (!url) return false;
    if (contentType && (contentType.includes('dash+xml') || contentType.includes('application/xml') || contentType.includes('text/xml'))) {
        return true;
    }
    const clean = url.trim();
    if (clean.startsWith('<?xml') || clean.startsWith('<MPD') || clean.includes('<MPD xmlns=')) {
        return true;
    }
    try {
        const parsed = new URL(url);
        if (parsed.pathname.toLowerCase().endsWith('.mpd')) {
            return true;
        }
    } catch {}
    return false;
}

/**
 * Generates the local API stream proxy URL for an external audio stream or DASH manifest.
 * Ensures bypass of CORS restrictions, allows Range requests, and preserves playback reliability.
 * Supports mode='stream' for progressive native FLAC playback in browsers without MSE FLAC support.
 */
export function getAudioProxyUrl(
    streamUrl: string,
    headers?: Record<string, string>,
    mode?: 'manifest' | 'stream'
): string {
    if (!streamUrl) return '';
    // If it's already a relative / local URL, return as-is
    if (streamUrl.startsWith('/api/') || streamUrl.startsWith('/')) {
        return streamUrl;
    }

    const params = new URLSearchParams();
    params.set('url', streamUrl);

    if (mode) {
        params.set('mode', mode);
    }

    if (headers && Object.keys(headers).length > 0) {
        // Forward essential token / auth headers if present
        if (headers['x-eclipse-access']) {
            params.set('x-eclipse-access', headers['x-eclipse-access']);
        }
        if (headers['authorization']) {
            params.set('authorization', headers['authorization']);
        }
    }

    return `/api/eclipse/stream-proxy?${params.toString()}`;
}
