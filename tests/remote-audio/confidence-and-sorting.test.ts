import { describe, expect, it } from 'vitest';
import { calculateMatchConfidence } from '@/domain/remote-audio/track-matcher';
import { type Track } from '@/domain/media/track';
import { type RemoteTrackSummary } from '@/domain/remote-audio/types';

describe('Match Confidence Calculation and Sorting', () => {
    const localTrack: Track = {
        id: 'track-1',
        filePath: '/music/Kalyani.flac',
        filename: 'Kalyani.flac',
        extension: '.flac',
        sizeBytes: 25000000,
        mtimeMs: 1700000000000,
        birthtimeMs: 1700000000000,
        title: 'Kalyani',
        artist: 'ARJN',
        album: 'Kalyani Single',
        durationSeconds: 234,
        isrc: 'INXX12345678',
        isCorrupt: false,
        lossless: true,
        codec: 'flac',
        bitDepth: 24,
        sampleRateHz: 96000,
    };

    it('calculates near 100% confidence for exact title, artist, and duration match', () => {
        const candidate: RemoteTrackSummary = {
            id: 'remote-100',
            title: 'Kalyani',
            artist: 'ARJN',
            album: 'Kalyani Single',
            duration: 234,
            audioQuality: '24-bit / 96 kHz',
            format: 'flac',
        };

        const confidence = calculateMatchConfidence(localTrack, candidate);
        expect(confidence).toBeGreaterThanOrEqual(0.95);
        expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('penalizes confidence when artist is different or duration is wildly mismatched', () => {
        const candidateDifferentArtist: RemoteTrackSummary = {
            id: 'remote-200',
            title: 'Kalyani',
            artist: 'Different Artist',
            album: 'Other Album',
            duration: 234,
        };

        const candidateWildDuration: RemoteTrackSummary = {
            id: 'remote-300',
            title: 'Kalyani',
            artist: 'ARJN',
            duration: 1400, // 23 minutes vs ~4 minutes
        };

        const confDifferent = calculateMatchConfidence(localTrack, candidateDifferentArtist);
        const confWild = calculateMatchConfidence(localTrack, candidateWildDuration);

        expect(confDifferent).toBeLessThan(0.8);
        expect(confWild).toBeLessThan(0.9);
    });

    it('returns 0 confidence when candidate is null or has empty title', () => {
        expect(calculateMatchConfidence(localTrack, null)).toBe(0);
        expect(calculateMatchConfidence(localTrack, { id: 'x', title: '' })).toBe(0);
    });

    it('correctly sorts comparison items by confidence descending and ascending', () => {
        const items = [
            { id: 'a', confidence: 0.45 },
            { id: 'b', confidence: 0.98 },
            { id: 'c', confidence: 0.72 },
            { id: 'd', confidence: 0.0 },
        ];

        // Descending sort (default High to Low)
        const descSorted = [...items].sort((x, y) => y.confidence - x.confidence);
        expect(descSorted.map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);

        // Ascending sort (Low to High)
        const ascSorted = [...items].sort((x, y) => x.confidence - y.confidence);
        expect(ascSorted.map((i) => i.id)).toEqual(['d', 'a', 'c', 'b']);
    });

    it('correctly sorts comparison items by remote available quality (Dolby Atmos & Hi-Res first)', () => {
        const items = [
            { id: 'cd-lossless', remoteQuality: { score: 1200 }, isDolbyAvailable: false },
            { id: 'dolby-spatial', remoteQuality: { score: 1650 }, isDolbyAvailable: true },
            { id: 'hi-res-96k', remoteQuality: { score: 2000 }, isDolbyAvailable: false },
            { id: 'lossy-mp3', remoteQuality: { score: 320 }, isDolbyAvailable: false },
            { id: 'no-match', remoteQuality: null, isDolbyAvailable: false },
        ];

        const getRemoteScore = (item: any) => {
            if (!item.remoteQuality) return -1;
            let s = item.remoteQuality.score;
            if (item.isDolbyAvailable) s += 5000;
            return s;
        };

        // Descending sort (Highest quality first: Dolby Atmos -> Hi-Res -> CD -> MP3 -> No Match)
        const descSorted = [...items].sort((a, b) => getRemoteScore(b) - getRemoteScore(a));
        expect(descSorted.map((i) => i.id)).toEqual(['dolby-spatial', 'hi-res-96k', 'cd-lossless', 'lossy-mp3', 'no-match']);

        // Ascending sort
        const ascSorted = [...items].sort((a, b) => getRemoteScore(a) - getRemoteScore(b));
        expect(ascSorted.map((i) => i.id)).toEqual(['no-match', 'lossy-mp3', 'cd-lossless', 'hi-res-96k', 'dolby-spatial']);
    });

    it('correctly sorts comparison items by local quality to find low-bitrate tracks to upgrade', () => {
        const items = [
            { id: 'local-flac-24b', localQuality: { score: 2000 } },
            { id: 'local-mp3-128', localQuality: { score: 128 } },
            { id: 'local-cd-16b', localQuality: { score: 1200 } },
            { id: 'local-mp3-320', localQuality: { score: 320 } },
        ];

        // Ascending sort (lowest quality local first -> prime upgrade targets)
        const ascSorted = [...items].sort((a, b) => a.localQuality.score - b.localQuality.score);
        expect(ascSorted.map((i) => i.id)).toEqual(['local-mp3-128', 'local-mp3-320', 'local-cd-16b', 'local-flac-24b']);

        // Descending sort (highest quality local first)
        const descSorted = [...items].sort((a, b) => b.localQuality.score - a.localQuality.score);
        expect(descSorted.map((i) => i.id)).toEqual(['local-flac-24b', 'local-cd-16b', 'local-mp3-320', 'local-mp3-128']);
    });
});
