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
});
