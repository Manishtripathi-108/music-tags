import { type Track } from '@/domain/media/track';
import { type AudioComparisonItem, type AudioComparisonStatus, type AudioQualityTier, type RemoteStreamInfo, type RemoteTrackSummary } from './types';

/**
 * Checks if a track, format, codec, or audioModes indicates Dolby Atmos.
 */
export function isDolbyAtmosAudio(
    track?: Partial<RemoteTrackSummary> | null,
    stream?: Partial<RemoteStreamInfo> | null
): boolean {
    if (!track && !stream) return false;

    // Check direct boolean flag
    if (track?.atmos === true) return true;

    // Check audioModes array
    if (Array.isArray(track?.audioModes) && track.audioModes.some((m) => String(m).toUpperCase().includes('DOLBY') || String(m).toUpperCase().includes('ATMOS'))) {
        return true;
    }

    // Check stream audioMode
    if (stream?.audioMode && String(stream.audioMode).toUpperCase().includes('DOLBY')) {
        return true;
    }

    // Check codec indicators (e.g. eac3-joc, ec-3 joc)
    const codecStr = (stream?.codec || track?.format || '').toLowerCase();
    if (codecStr.includes('eac3-joc') || codecStr.includes('e-ac-3') || codecStr.includes('atmos')) {
        return true;
    }

    // Check quality string
    const qualityStr = (stream?.quality || track?.audioQuality || '').toLowerCase();
    if (qualityStr.includes('dolby') || qualityStr.includes('atmos')) {
        return true;
    }

    return false;
}

/**
 * Parses free-text quality strings such as "24-bit / 96 kHz", "16-bit / 44.1 kHz", "LOSSLESS", "HIGH", etc.
 */
export function parseQualityString(
    qualityStr?: string | null,
    formatStr?: string | null,
    stream?: Partial<RemoteStreamInfo> | null
): AudioQualityTier {
    const raw = (qualityStr || '').trim();
    const format = (formatStr || stream?.format || stream?.codec || '').trim().toLowerCase();
    const isDolby = isDolbyAtmosAudio({ format: formatStr ?? undefined, audioQuality: qualityStr ?? undefined }, stream);

    let bitDepth: number | null = stream?.bitDepth ?? null;
    let sampleRateHz: number | null = stream?.sampleRate ? (stream.sampleRate < 1000 ? stream.sampleRate * 1000 : stream.sampleRate) : null;
    let bitrateKbps: number | null = stream?.bitrate ? (stream.bitrate > 10000 ? Math.round(stream.bitrate / 1000) : stream.bitrate) : null;
    let isLossless = false;

    // Detect bit depth from string e.g. "24-bit" or "16-bit" or "32-bit"
    if (bitDepth === null) {
        const bitMatch = raw.match(/(\d{2})\s*[- ]?bit/i);
        if (bitMatch) {
            bitDepth = parseInt(bitMatch[1], 10);
        }
    }

    // Detect sample rate from string e.g. "96 kHz", "44.1 kHz", "192kHz", "44100 Hz"
    if (sampleRateHz === null) {
        const khzMatch = raw.match(/([\d.]+)\s*k(?:Hz)?/i);
        if (khzMatch) {
            sampleRateHz = Math.round(parseFloat(khzMatch[1]) * 1000);
        } else {
            const hzMatch = raw.match(/(\d{5,6})\s*Hz/i);
            if (hzMatch) {
                sampleRateHz = parseInt(hzMatch[1], 10);
            }
        }
    }

    // Detect bitrate from string e.g. "320 kbps", "256 kbps"
    if (bitrateKbps === null) {
        const kbpsMatch = raw.match(/(\d{2,4})\s*kbps/i);
        if (kbpsMatch) {
            bitrateKbps = parseInt(kbpsMatch[1], 10);
        }
    }

    // Lossless detection
    const losslessFormats = ['flac', 'alac', 'wav', 'aiff', 'ape', 'dsd'];
    const losslessKeywords = ['lossless', 'hi-res', 'hires', 'max', 'master', 'cd'];
    const lowerRaw = raw.toLowerCase();

    if (
        losslessFormats.includes(format) ||
        bitDepth !== null && bitDepth >= 16 ||
        losslessKeywords.some((kw) => lowerRaw.includes(kw))
    ) {
        isLossless = true;
    }

    // Default bit depth & sample rate if lossless keyword is present but numbers omitted
    if (isLossless) {
        if (!bitDepth) bitDepth = 16;
        if (!sampleRateHz) sampleRateHz = 44100;
    }

    // Score computation
    let score = 0;
    if (isLossless) {
        score = 1000;
        if (bitDepth) {
            if (bitDepth >= 24) score += 500;
            else if (bitDepth >= 16) score += 100;
        }
        if (sampleRateHz) {
            if (sampleRateHz >= 192000) score += 800;
            else if (sampleRateHz >= 176400) score += 700;
            else if (sampleRateHz >= 96000) score += 500;
            else if (sampleRateHz >= 88200) score += 400;
            else if (sampleRateHz >= 48000) score += 150;
            else if (sampleRateHz >= 44100) score += 100;
        }
    } else {
        score = bitrateKbps ?? 256;
    }

    // Label formatting
    let label = '';
    if (isDolby) {
        label = 'Dolby Atmos';
    } else if (isLossless) {
        if (bitDepth && sampleRateHz) {
            const khz = sampleRateHz / 1000;
            label = `${bitDepth}-bit / ${khz} kHz`;
            if (bitDepth > 16 || sampleRateHz > 48000) {
                label = `Hi-Res (${label})`;
            } else {
                label = `CD Lossless (${label})`;
            }
        } else {
            label = raw || 'Lossless';
        }
    } else {
        label = bitrateKbps ? `${bitrateKbps} kbps Lossy` : (raw || format.toUpperCase() || 'Lossy');
    }

    return {
        isLossless,
        bitDepth,
        sampleRateHz,
        bitrateKbps,
        isDolbyAtmos: isDolby,
        codec: format || (isLossless ? 'flac' : 'aac'),
        score,
        label,
    };
}

/**
 * Parses the local track's technical specs into an AudioQualityTier.
 */
export function getLocalTrackQuality(track: Track): AudioQualityTier {
    const isLossless = Boolean(track.lossless);
    const bitDepth = track.bitDepth ?? (isLossless ? 16 : null);
    const sampleRateHz = track.sampleRateHz ?? (isLossless ? 44100 : null);
    const bitrateKbps = track.bitrateKbps ?? null;
    const codec = (track.codec || track.extension || '').replace(/^\./, '').toLowerCase();

    let score = 0;
    if (isLossless) {
        score = 1000;
        if (bitDepth) {
            if (bitDepth >= 24) score += 500;
            else if (bitDepth >= 16) score += 100;
        }
        if (sampleRateHz) {
            if (sampleRateHz >= 192000) score += 800;
            else if (sampleRateHz >= 176400) score += 700;
            else if (sampleRateHz >= 96000) score += 500;
            else if (sampleRateHz >= 88200) score += 400;
            else if (sampleRateHz >= 48000) score += 150;
            else if (sampleRateHz >= 44100) score += 100;
        }
    } else {
        score = bitrateKbps ?? 256;
    }

    let label = '';
    if (isLossless) {
        if (bitDepth && sampleRateHz) {
            const khz = sampleRateHz / 1000;
            label = `${bitDepth}-bit / ${khz} kHz ${codec.toUpperCase() || 'FLAC'}`;
            if (bitDepth > 16 || sampleRateHz > 48000) {
                label = `Hi-Res (${label})`;
            }
        } else {
            label = `${codec.toUpperCase() || 'Lossless'}`;
        }
    } else {
        label = bitrateKbps ? `${bitrateKbps} kbps ${codec.toUpperCase() || 'Lossy'}` : (codec.toUpperCase() || 'Lossy');
    }

    return {
        isLossless,
        bitDepth,
        sampleRateHz,
        bitrateKbps,
        isDolbyAtmos: false,
        codec,
        score,
        label,
    };
}

/**
 * Compares local audio quality with remote audio quality and determines status.
 */
export function evaluateQualityComparison(
    localQuality: AudioQualityTier,
    remoteQuality: AudioQualityTier | null,
    isDolbyAvailable: boolean
): { status: AudioComparisonStatus; statusMessage: string; canDownloadLossless: boolean; canDownloadDolby: boolean } {
    if (!remoteQuality) {
        return {
            status: 'not_searched',
            statusMessage: 'Not searched yet',
            canDownloadLossless: false,
            canDownloadDolby: false,
        };
    }

    const canDownloadDolby = isDolbyAvailable;
    const canDownloadLossless = remoteQuality.isLossless && !remoteQuality.isDolbyAtmos;

    // Case 1: Remote is Lossless and Local is Lossy -> Upgrade
    if (remoteQuality.isLossless && !localQuality.isLossless) {
        return {
            status: 'upgrade_available',
            statusMessage: `Upgrade: Lossy (${localQuality.label}) → Lossless (${remoteQuality.label})`,
            canDownloadLossless,
            canDownloadDolby,
        };
    }

    // Case 2: Both Lossless, Remote has higher score (higher bit depth or sample rate) -> Upgrade
    if (remoteQuality.isLossless && localQuality.isLossless && remoteQuality.score > localQuality.score) {
        return {
            status: 'upgrade_available',
            statusMessage: `Hi-Res Upgrade: ${localQuality.label} → ${remoteQuality.label}`,
            canDownloadLossless,
            canDownloadDolby,
        };
    }

    // Case 3: Dolby Atmos available on remote
    if (isDolbyAvailable) {
        return {
            status: 'dolby_available',
            statusMessage: `Dolby Atmos mix available (${remoteQuality.label})`,
            canDownloadLossless,
            canDownloadDolby,
        };
    }

    // Case 4: Equal quality
    if (Math.abs(remoteQuality.score - localQuality.score) <= 20) {
        return {
            status: 'same_quality',
            statusMessage: `Same Quality: ${localQuality.label}`,
            canDownloadLossless,
            canDownloadDolby,
        };
    }

    // Case 5: Local is higher quality
    if (localQuality.score > remoteQuality.score) {
        return {
            status: 'local_higher',
            statusMessage: `Local is higher quality (${localQuality.label} vs ${remoteQuality.label})`,
            canDownloadLossless,
            canDownloadDolby,
        };
    }

    return {
        status: 'same_quality',
        statusMessage: `Comparable: ${remoteQuality.label}`,
        canDownloadLossless,
        canDownloadDolby,
    };
}
