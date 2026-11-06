import { type Track } from '../media/track';

/**
 * Evaluates the quality score of a track to pick the best recommended keeper among duplicates.
 */
export function scoreTrackQuality(track: Track): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (track.lossless) {
        score += 50;
        reasons.push('Lossless Audio');
    }

    if (track.bitDepth && track.bitDepth > 16) {
        score += 35;
        reasons.push(`${track.bitDepth}-bit Hi-Res`);
    } else if (track.bitDepth === 16) {
        score += 15;
    }

    if (track.sampleRateHz && track.sampleRateHz >= 96000) {
        score += 20;
        reasons.push(`${Math.round(track.sampleRateHz / 1000)}kHz Hi-Res`);
    } else if (track.sampleRateHz && track.sampleRateHz >= 48000) {
        score += 10;
    }

    if (track.bitrateKbps) {
        if (track.bitrateKbps >= 320) {
            score += 25;
            if (!track.lossless) reasons.push('320 kbps');
        } else if (track.bitrateKbps >= 256) {
            score += 15;
        } else if (track.bitrateKbps >= 192) {
            score += 10;
        }
    }

    if (track.hasCoverArt) {
        score += 15;
        if (track.coverArtWidth && track.coverArtWidth >= 1400) {
            score += 20;
            reasons.push(`${track.coverArtWidth}×${track.coverArtHeight} HD Cover`);
        } else if (track.coverArtWidth && track.coverArtWidth >= 600) {
            score += 10;
            reasons.push(`${track.coverArtWidth}×${track.coverArtHeight} Cover`);
        } else {
            reasons.push('Cover Art');
        }
    }

    if (track.lyricsType === 'synced') {
        score += 20;
        reasons.push('Synced Lyrics');
    } else if (track.lyrics) {
        score += 8;
        reasons.push('Lyrics');
    }

    if (track.isrc) {
        score += 5;
        reasons.push('ISRC Tagged');
    }

    if (track.trackNumber) score += 3;
    if (track.year) score += 3;
    if (track.genre) score += 3;

    return { score, reasons };
}
