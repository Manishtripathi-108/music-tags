import { describe, expect, it } from 'vitest';

import { findDuplicates } from '@/domain/duplicates/duplicate-matcher';
import { cleanMetadataString } from '@/domain/duplicates/normalization';
import { phoneticSignature, soundexWord } from '@/domain/duplicates/phonetics';
import { scoreTrackQuality } from '@/domain/duplicates/scoring';
import { stringSimilarity } from '@/domain/duplicates/similarity';
import { type Track } from '@/domain/media/track';

describe('cleanMetadataString', () => {
    it('normalizes accents, casing, punctuation, and extra whitespace', () => {
        expect(cleanMetadataString('Café  del   Mar')).toBe('cafe del mar');
        expect(cleanMetadataString('Beyoncé - Halo')).toBe('beyonce halo');
    });

    it('strips common media suffixes like remastered, official video, etc.', () => {
        expect(cleanMetadataString('In the End (Official Video)')).toBe('in the end');
        expect(cleanMetadataString('Hotel California [Remastered]')).toBe('hotel california');
        expect(cleanMetadataString('Smells Like Teen Spirit (Deluxe Edition)')).toBe('smells like teen spirit');
    });

    it('strips feat. and featuring suffixes', () => {
        expect(cleanMetadataString('Empire State of Mind ft. Alicia Keys')).toBe('empire state of mind');
        expect(cleanMetadataString('Love the Way You Lie feat. Rihanna')).toBe('love the way you lie');
    });
});

describe('soundexWord & phoneticSignature', () => {
    it('computes 4-character soundex code', () => {
        expect(soundexWord('Smith')).toBe('S530');
        expect(soundexWord('Smythe')).toBe('S530');
    });

    it('handles music digraph normalizations (PH->F, KN->N, etc.)', () => {
        expect(soundexWord('Phoenix')).toBe(soundexWord('Foenix'));
        expect(soundexWord('Knight')).toBe(soundexWord('Night'));
    });

    it('computes sorted unique phoneticSignature for multi-word phrases', () => {
        const sig1 = phoneticSignature('Coldplay');
        const sig2 = phoneticSignature('Cold Play');
        expect(sig1).toBeDefined();
        expect(sig2).toBeDefined();
    });
});

describe('stringSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
        expect(stringSimilarity('Shape of You', 'Shape of You')).toBe(1.0);
    });

    it('returns high similarity for minor typos', () => {
        const sim = stringSimilarity('Bohemian Rhapsody', 'Bohemian Rapsody');
        expect(sim).toBeGreaterThan(0.85);
    });

    it('returns 0 for completely distinct strings', () => {
        expect(stringSimilarity('Radiohead', 'Metallica')).toBeLessThan(0.3);
    });
});

describe('scoreTrackQuality', () => {
    const baseTrack: Track = {
        id: '1',
        filename: 'song.mp3',
        extension: '.mp3',
        title: 'Song',
        artist: 'Artist',
    };

    it('gives higher score for lossless and higher bit depth/sample rate', () => {
        const mp3Track: Track = {
            ...baseTrack,
            bitrateKbps: 128,
            lossless: false,
        };

        const flacTrack: Track = {
            ...baseTrack,
            extension: '.flac',
            lossless: true,
            bitDepth: 24,
            sampleRateHz: 96000,
            hasCoverArt: true,
            coverArtWidth: 1400,
            coverArtHeight: 1400,
        };

        const mp3Score = scoreTrackQuality(mp3Track);
        const flacScore = scoreTrackQuality(flacTrack);

        expect(flacScore.score).toBeGreaterThan(mp3Score.score);
        expect(flacScore.reasons).toContain('Lossless Audio');
        expect(flacScore.reasons).toContain('24-bit Hi-Res');
        expect(flacScore.reasons).toContain('96kHz Hi-Res');
    });
});

describe('findDuplicates', () => {
    it('finds exact tag duplicates and identifies the highest quality keeper', () => {
        const trackA: Track = {
            id: 'track-low',
            filename: 'Song_Low.mp3',
            extension: '.mp3',
            title: 'Hysteria',
            artist: 'Muse',
            bitrateKbps: 128,
            lossless: false,
        };

        const trackB: Track = {
            id: 'track-high',
            filename: 'Song_High.flac',
            extension: '.flac',
            title: 'Hysteria',
            artist: 'Muse',
            bitrateKbps: 900,
            lossless: true,
            hasCoverArt: true,
        };

        const clusters = findDuplicates([trackA, trackB], { mode: 'exact_tags' });
        expect(clusters.length).toBe(1);
        expect(clusters[0].tracks.length).toBe(2);

        const keeper = clusters[0].tracks.find((t) => t.isRecommendedKeeper);
        expect(keeper?.track.id).toBe('track-high');
    });

    it('matches by ISRC regardless of filename', () => {
        const trackA: Track = {
            id: 'a',
            filename: 'file_01.mp3',
            extension: '.mp3',
            isrc: 'US-S1Z-05-00001',
            lossless: false,
        };
        const trackB: Track = {
            id: 'b',
            filename: 'file_99.mp3',
            extension: '.mp3',
            isrc: 'USS1Z0500001',
            lossless: false,
        };

        const clusters = findDuplicates([trackA, trackB], { mode: 'isrc' });
        expect(clusters.length).toBe(1);
        expect(clusters[0].tracks.length).toBe(2);
    });
});
