import { describe, expect, it } from 'vitest';

import { buildTrackFromDb, isTrackModified, sanitizeFilenameTitle, toExifToolWriteTags } from '@/domain/media/mappers';
import {
    filterTracks,
    isHiRes,
    isLossless,
    isLowResolutionArt,
    isMissingArt,
    isMissingBpm,
    isMissingLyrics,
    isSyncedLyrics,
    isUnsyncedLyrics,
} from '@/domain/media/predicates';
import { type Track } from '@/domain/media/track';

describe('mappers', () => {
    it('sanitizes filename title by removing extension', () => {
        expect(sanitizeFilenameTitle('01 - Song Name.flac')).toBe('01 - Song Name');
        expect(sanitizeFilenameTitle('track.mp3')).toBe('track');
    });

    it('detects isTrackModified based on updatedAt and createdAt difference', () => {
        expect(isTrackModified({ createdAt: 1000, updatedAt: 1500 })).toBe(false);
        expect(isTrackModified({ createdAt: 1000, updatedAt: 2500 })).toBe(true);
        expect(isTrackModified(null)).toBe(false);
    });

    it('builds canonical Track from DB records with proper fallbacks', () => {
        const file = {
            id: 'f1',
            filename: '01_intro.mp3',
            path: '/music/01_intro.mp3',
            directory: '/music',
            extension: '.mp3',
            sizeBytes: 5000000,
        };

        const meta = {
            title: null,
            artist: 'Test Artist',
            album: 'Test Album',
            trackNumber: 1,
            bpm: 120,
            hasCoverArt: true,
            lossless: false,
            lyrics: '[00:01.00]Hello world',
        };

        const track = buildTrackFromDb(file, meta);

        expect(track.id).toBe('f1');
        // Falls back to filename without extension
        expect(track.title).toBe('01_intro');
        expect(track.artist).toBe('Test Artist');
        expect(track.album).toBe('Test Album');
        expect(track.trackNumber).toBe(1);
        expect(track.bpm).toBe(120);
        expect(track.hasCoverArt).toBe(true);
        expect(track.lossless).toBe(false);
        expect(track.lyricsType).toBe('synced');
    });

    it('serializes tags to ExifTool format', () => {
        const tags = toExifToolWriteTags({
            title: 'New Title',
            artist: 'New Artist',
            trackNumber: 5,
            bpm: 124,
        });

        expect(tags.Title).toBe('New Title');
        expect(tags.Artist).toBe('New Artist');
        expect(tags.TrackNumber).toBe(5);
        expect(tags.BPM).toBe(124);
    });
});

describe('predicates & filtering', () => {
    const sampleTracks: Track[] = [
        {
            id: '1',
            filename: 'song1.flac',
            extension: '.flac',
            lossless: true,
            bitDepth: 24,
            bpm: 128,
            hasCoverArt: true,
            coverArtWidth: 1200,
            coverArtHeight: 1200,
            lyrics: '[00:05.00]Line 1',
            lyricsType: 'synced',
        },
        {
            id: '2',
            filename: 'song2.mp3',
            extension: '.mp3',
            lossless: false,
            bitDepth: 16,
            bpm: null,
            hasCoverArt: false,
            lyrics: 'Plain lyrics',
            lyricsType: 'unsynced',
        },
        {
            id: '3',
            filename: 'song3.mp3',
            extension: '.mp3',
            lossless: false,
            bitDepth: 16,
            bpm: 100,
            hasCoverArt: true,
            coverArtWidth: 500,
            coverArtHeight: 500,
            lyrics: null,
            lyricsType: 'none',
        },
    ];

    it('filters lossless tracks', () => {
        const filtered = filterTracks(sampleTracks, { activeFilter: 'lossless' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('1');
    });

    it('filters hi-res tracks', () => {
        const filtered = filterTracks(sampleTracks, { activeFilter: 'hi-res' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('1');
    });

    it('filters missing cover art tracks', () => {
        const filtered = filterTracks(sampleTracks, { activeFilter: 'missing-art' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('2');
    });

    it('filters low resolution art (<800px)', () => {
        const filtered = filterTracks(sampleTracks, { activeFilter: 'low-res-art' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('3');
    });

    it('filters missing bpm tracks', () => {
        const filtered = filterTracks(sampleTracks, { activeFilter: 'missing-bpm' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('2');
    });

    it('filters missing lyrics tracks', () => {
        const filtered = filterTracks(sampleTracks, { activeFilter: 'missing-lyrics' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('3');
    });

    it('filters synced and unsynced lyrics tracks', () => {
        expect(filterTracks(sampleTracks, { activeFilter: 'lyrics-synced' }).length).toBe(1);
        expect(filterTracks(sampleTracks, { activeFilter: 'lyrics-unsynced' }).length).toBe(1);
    });

    it('evaluates individual domain predicates directly', () => {
        expect(isLossless(sampleTracks[0])).toBe(true);
        expect(isLossless(sampleTracks[1])).toBe(false);

        expect(isHiRes(sampleTracks[0])).toBe(true);
        expect(isHiRes(sampleTracks[1])).toBe(false);

        expect(isMissingArt(sampleTracks[0])).toBe(false);
        expect(isMissingArt(sampleTracks[1])).toBe(true);

        expect(isLowResolutionArt(sampleTracks[2])).toBe(true);
        expect(isLowResolutionArt(sampleTracks[0])).toBe(false);

        expect(isMissingBpm(sampleTracks[1])).toBe(true);
        expect(isMissingBpm(sampleTracks[0])).toBe(false);

        expect(isMissingLyrics(sampleTracks[2])).toBe(true);
        expect(isMissingLyrics(sampleTracks[0])).toBe(false);

        expect(isSyncedLyrics(sampleTracks[0])).toBe(true);
        expect(isSyncedLyrics(sampleTracks[1])).toBe(false);

        expect(isUnsyncedLyrics(sampleTracks[1])).toBe(true);
        expect(isUnsyncedLyrics(sampleTracks[0])).toBe(false);
    });
});
