import { type EclipseTrack } from '@/app/api/eclipse/route';
import { isDolbyAtmosAudio, parseQualityString } from './quality-analyzer';

export type EclipseQualityFilter = 'all' | 'dolby' | 'hires' | 'lossless' | 'lossy';
export type EclipseSortOption = 'default' | 'dolby' | 'quality' | 'title' | 'artist' | 'duration';

export interface FormattedEclipseQuality {
    isDolbyAtmos: boolean;
    isHiRes: boolean;
    isLossless: boolean;
    bitDepth: number | null;
    sampleRateHz: number | null;
    sampleRateKhz: string | null;
    displayQuality: string;
    badgeLabel: 'DOLBY ATMOS' | 'HI-RES' | 'CD LOSSLESS' | 'LOSSY';
    badgeColor: 'dolby' | 'hires' | 'lossless' | 'lossy';
    score: number;
}

/**
 * Checks if a track indicates Dolby Atmos in any format, audioModes, flags, or tags.
 */
export function isTrackDolbyAtmos(track?: Partial<EclipseTrack> | any): boolean {
    if (!track) return false;
    if (track.isAtmos === true || track.atmos === true) return true;

    // Check audioModes array (e.g. ["STEREO", "DOLBY_ATMOS"])
    if (Array.isArray(track.audioModes) && track.audioModes.some((m: any) => {
        const str = String(m).toUpperCase();
        return str.includes('DOLBY') || str.includes('ATMOS');
    })) {
        return true;
    }

    // Check mediaMetadata tags (e.g. { tags: ["DOLBY_ATMOS"] })
    if (Array.isArray(track.mediaMetadata?.tags) && track.mediaMetadata.tags.some((t: any) => {
        const str = String(t).toUpperCase();
        return str.includes('DOLBY') || str.includes('ATMOS');
    })) {
        return true;
    }

    // Check audioQuality, format, codec, quality
    const qStr = String(track.audioQuality || track.format || track.quality || track.codec || '').toLowerCase();
    if (qStr.includes('dolby') || qStr.includes('atmos') || qStr.includes('eac3-joc') || qStr.includes('e-ac-3') || qStr.includes('ec-3')) {
        return true;
    }

    return false;
}

/**
 * Formats track quality specs into structured bit depth, sample rate, badges, and score.
 */
export function formatEclipseTrackQuality(track?: Partial<EclipseTrack> | any): FormattedEclipseQuality {
    if (!track) {
        return {
            isDolbyAtmos: false,
            isHiRes: false,
            isLossless: false,
            bitDepth: null,
            sampleRateHz: null,
            sampleRateKhz: null,
            displayQuality: 'Standard',
            badgeLabel: 'LOSSY',
            badgeColor: 'lossy',
            score: 0,
        };
    }

    const isDolby = isTrackDolbyAtmos(track);
    const rawQuality = String(track.audioQuality || track.format || track.quality || '').trim();
    const isHiResFlag = Boolean(track.isHiRes || track.hiRes);

    let bitDepth: number | null = track.bitDepth ?? null;
    let sampleRateHz: number | null = track.sampleRate || track.sampleRateHz || null;

    // Detect bit depth from string e.g. "24-bit" or "16-bit"
    if (bitDepth === null) {
        const bitMatch = rawQuality.match(/(\d{2})\s*[- ]?bit/i);
        if (bitMatch) {
            bitDepth = parseInt(bitMatch[1], 10);
        }
    }

    // Detect bitrate from string e.g. "320 kbps", "256 kbps"
    let bitrateKbps: number | null = null;
    const kbpsMatch = rawQuality.match(/(\d+)\s*kbps/i);
    if (kbpsMatch) {
        bitrateKbps = parseInt(kbpsMatch[1], 10);
    }

    // Detect sample rate from string e.g. "96 kHz", "48kHz", "44.1 kHz", "192 kHz"
    if (sampleRateHz === null) {
        const khzMatch = rawQuality.match(/([\d.]+)\s*kHz/i);
        if (khzMatch) {
            sampleRateHz = Math.round(parseFloat(khzMatch[1]) * 1000);
        } else {
            const hzMatch = rawQuality.match(/(\d{5,6})\s*Hz/i);
            if (hzMatch) {
                sampleRateHz = parseInt(hzMatch[1], 10);
            }
        }
    }

    const lower = rawQuality.toLowerCase();
    const isHiResText = lower.includes('hi_res') || lower.includes('hires') || lower.includes('hi-res') || lower.includes('master') || lower.includes('max');
    const isHiRes = isHiResFlag || isHiResText || (bitDepth !== null && bitDepth >= 24) || (sampleRateHz !== null && sampleRateHz > 48000);

    const isLosslessText = isHiRes || lower.includes('flac') || lower.includes('lossless') || lower.includes('alac') || lower.includes('wav');
    const isLossless = isLosslessText || (bitDepth !== null && bitDepth >= 16);

    // Apply defaults for Hi-Res or CD Lossless if specific numbers were omitted
    if (isHiRes) {
        if (!bitDepth) bitDepth = 24;
        if (!sampleRateHz) sampleRateHz = 48000;
    } else if (isLossless) {
        if (!bitDepth) bitDepth = 16;
        if (!sampleRateHz) sampleRateHz = 44100;
    }

    const sampleRateKhz = sampleRateHz ? `${sampleRateHz / 1000} kHz` : null;

    // 1. Dolby Atmos
    if (isDolby) {
        return {
            isDolbyAtmos: true,
            isHiRes: false,
            isLossless: false,
            bitDepth,
            sampleRateHz,
            sampleRateKhz,
            displayQuality: 'Dolby Atmos (Spatial Audio)',
            badgeLabel: 'DOLBY ATMOS',
            badgeColor: 'dolby',
            score: 3000,
        };
    }

    // 2. Hi-Res Lossless (24-bit / 48kHz, 96kHz, 192kHz)
    if (isHiRes) {
        const bits = `${bitDepth || 24}-bit`;
        const rate = sampleRateKhz || '48 kHz';
        const displayQuality = `${bits} / ${rate} FLAC`;
        const score = 1500 + (bitDepth || 24) * 20 + (sampleRateHz ? sampleRateHz / 1000 : 48);

        return {
            isDolbyAtmos: false,
            isHiRes: true,
            isLossless: true,
            bitDepth,
            sampleRateHz,
            sampleRateKhz,
            displayQuality,
            badgeLabel: 'HI-RES',
            badgeColor: 'hires',
            score,
        };
    }

    // 3. CD Lossless (16-bit / 44.1kHz)
    if (isLossless) {
        const bits = `${bitDepth || 16}-bit`;
        const rate = sampleRateKhz || '44.1 kHz';
        const displayQuality = `${bits} / ${rate} FLAC`;
        const score = 1000 + (bitDepth || 16) * 10;

        return {
            isDolbyAtmos: false,
            isHiRes: false,
            isLossless: true,
            bitDepth,
            sampleRateHz,
            sampleRateKhz,
            displayQuality,
            badgeLabel: 'CD LOSSLESS',
            badgeColor: 'lossless',
            score,
        };
    }

    // 4. Lossy (AAC / MP3 / High Quality)
    let displayQuality = 'Lossy';
    if (rawQuality) {
        displayQuality = rawQuality;
    } else if (track.format) {
        displayQuality = track.format.toUpperCase();
    } else {
        displayQuality = '320 kbps';
    }

    return {
        isDolbyAtmos: false,
        isHiRes: false,
        isLossless: false,
        bitDepth: null,
        sampleRateHz: null,
        sampleRateKhz: null,
        displayQuality,
        badgeLabel: 'LOSSY',
        badgeColor: 'lossy',
        score: 320,
    };
}

/**
 * Filters Eclipse tracks by quality tier.
 */
export function filterEclipseTracks(tracks: EclipseTrack[], filter: EclipseQualityFilter): EclipseTrack[] {
    if (!tracks || tracks.length === 0) return [];
    if (filter === 'all') return tracks;

    return tracks.filter((track) => {
        const q = formatEclipseTrackQuality(track);
        if (filter === 'dolby') return q.isDolbyAtmos;
        if (filter === 'hires') return q.isHiRes && !q.isDolbyAtmos;
        if (filter === 'lossless') return q.isLossless && !q.isHiRes && !q.isDolbyAtmos;
        if (filter === 'lossy') return !q.isLossless && !q.isDolbyAtmos;
        return true;
    });
}

/**
 * Sorts Eclipse tracks by option (Dolby first, highest quality, title, artist, duration).
 */
export function sortEclipseTracks(
    tracks: EclipseTrack[],
    sortBy: EclipseSortOption,
    sortOrder: 'asc' | 'desc' = 'asc'
): EclipseTrack[] {
    if (!tracks || tracks.length <= 1) return tracks;
    if (sortBy === 'default') return tracks;

    const copy = [...tracks];

    copy.sort((a, b) => {
        if (sortBy === 'dolby') {
            const aDolby = isTrackDolbyAtmos(a) ? 1 : 0;
            const bDolby = isTrackDolbyAtmos(b) ? 1 : 0;
            if (aDolby !== bDolby) {
                // Dolby first by default
                return sortOrder === 'desc' ? aDolby - bDolby : bDolby - aDolby;
            }
            // Tie-breaker: quality score
            return formatEclipseTrackQuality(b).score - formatEclipseTrackQuality(a).score;
        }

        if (sortBy === 'quality') {
            const aScore = formatEclipseTrackQuality(a).score;
            const bScore = formatEclipseTrackQuality(b).score;
            return sortOrder === 'desc' ? aScore - bScore : bScore - aScore;
        }

        if (sortBy === 'title') {
            const cmp = (a.title || '').localeCompare(b.title || '');
            return sortOrder === 'desc' ? -cmp : cmp;
        }

        if (sortBy === 'artist') {
            const cmp = (a.artist || '').localeCompare(b.artist || '');
            return sortOrder === 'desc' ? -cmp : cmp;
        }

        if (sortBy === 'duration') {
            const aDur = a.duration || 0;
            const bDur = b.duration || 0;
            return sortOrder === 'desc' ? bDur - aDur : aDur - bDur;
        }

        return 0;
    });

    return copy;
}
