import { type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';

export interface TagLookup {
    get(...keys: string[]): unknown;
    getString(...keys: string[]): string | null;
    getNumber(...keys: string[]): number | null;
    getTotalNumber(...keys: string[]): number | null;
    hasAny(...keys: string[]): boolean;
}

/**
 * Creates a normalized, case-insensitive, group-agnostic lookup map
 * from raw ExifTool and FFprobe metadata.
 */
export function createTagLookup(rawExif: Record<string, unknown>, probeResult?: FFprobeAudioResult | null): TagLookup {
    const map = new Map<string, unknown>();

    // 1. Ingest raw ExifTool tags
    for (const [key, val] of Object.entries(rawExif)) {
        if (val === undefined || val === null || val === '') continue;
        const lowerKey = key.toLowerCase();
        map.set(lowerKey, val);

        // Strip group prefix (e.g. 'vorbis:tracknumber' -> 'tracknumber')
        const colonIdx = lowerKey.indexOf(':');
        if (colonIdx !== -1) {
            const bare = lowerKey.slice(colonIdx + 1);
            if (!map.has(bare)) {
                map.set(bare, val);
            }
        }
    }

    // 2. Ingest FFprobe format tags as secondary fallback
    if (probeResult?.format?.tags) {
        for (const [key, val] of Object.entries(probeResult.format.tags)) {
            if (val === undefined || val === null || val === '') continue;
            const lowerKey = key.toLowerCase();
            if (!map.has(lowerKey)) {
                map.set(lowerKey, val);
            }
            const bare = lowerKey.replace(/[^a-z0-9]/g, '');
            if (!map.has(bare)) {
                map.set(bare, val);
            }
        }
    }

    return {
        get(...keys: string[]): unknown {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (val !== undefined && val !== null && val !== '') {
                    return val;
                }
            }
            return null;
        },

        getString(...keys: string[]): string | null {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (typeof val === 'string' && val.trim().length > 0) {
                    return val.trim();
                }
                if (typeof val === 'number') {
                    return String(val);
                }
            }
            return null;
        },

        getNumber(...keys: string[]): number | null {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (typeof val === 'number' && !isNaN(val)) return val;
                if (typeof val === 'string') {
                    if (val.includes('/')) {
                        const num = parseInt(val.split('/')[0], 10);
                        if (!isNaN(num)) return num;
                    }
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) return parsed;
                }
            }
            return null;
        },

        getTotalNumber(...keys: string[]): number | null {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (typeof val === 'string' && val.includes('/')) {
                    const parts = val.split('/');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1], 10);
                        if (!isNaN(num)) return num;
                    }
                }
                if (typeof val === 'number' && !isNaN(val)) return val;
                if (typeof val === 'string') {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) return parsed;
                }
            }
            return null;
        },

        hasAny(...keys: string[]): boolean {
            for (const k of keys) {
                if (map.has(k.toLowerCase())) return true;
            }
            return false;
        },
    };
}
