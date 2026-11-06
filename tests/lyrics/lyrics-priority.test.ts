import { describe, expect, it } from 'vitest';

import { normalizeAudioMetadata } from '@/services/metadata/metadata-normalizer';

describe('normalizeAudioMetadata lyrics priority and release date', () => {
    it('selects rawLyrics as synced if rawLyrics has LRC timestamps', () => {
        const result = normalizeAudioMetadata(
            'file-1',
            {
                Title: 'Test Song',
                Lyrics: '[00:05.12]Synced line in raw lyrics',
                SynchronizedLyrics: '[00:08.00]Other synced line',
            },
            null
        );

        expect(result.canonical.lyrics).toBe('[00:05.12]Synced line in raw lyrics');
        expect(result.canonical.lyricsType).toBe('synced');
    });

    it('selects rawSyncedLyrics as synced if rawLyrics is unsynced but rawSyncedLyrics has LRC timestamps', () => {
        const result = normalizeAudioMetadata(
            'file-2',
            {
                Title: 'Test Song 2',
                Lyrics: 'Plain text unsynced lyrics',
                SynchronizedLyrics: '[00:10.00]Synced in synchronized lyrics tag',
            },
            null
        );

        expect(result.canonical.lyrics).toBe('[00:10.00]Synced in synchronized lyrics tag');
        expect(result.canonical.lyricsType).toBe('synced');
    });

    it('selects rawLyrics as unsynced if neither has timestamps', () => {
        const result = normalizeAudioMetadata(
            'file-3',
            {
                Title: 'Test Song 3',
                Lyrics: 'Plain text 1',
                SynchronizedLyrics: 'Plain text 2',
            },
            null
        );

        expect(result.canonical.lyrics).toBe('Plain text 1');
        expect(result.canonical.lyricsType).toBe('unsynced');
    });

    it('selects rawSyncedLyrics as unsynced if only rawSyncedLyrics is present and non-timestamped', () => {
        const result = normalizeAudioMetadata(
            'file-4',
            {
                Title: 'Test Song 4',
                SynchronizedLyrics: 'Plain text 2',
            },
            null
        );

        expect(result.canonical.lyrics).toBe('Plain text 2');
        expect(result.canonical.lyricsType).toBe('unsynced');
    });

    it('sets null when no lyrics tags are present', () => {
        const result = normalizeAudioMetadata(
            'file-5',
            {
                Title: 'Test Song 5',
            },
            null
        );

        expect(result.canonical.lyrics).toBeNull();
        expect(result.canonical.lyricsType).toBeNull();
    });

    it('normalizes arbitrary date formats to DD-MM-YYYY in canonical metadata', () => {
        const result = normalizeAudioMetadata(
            'file-6',
            {
                Title: 'Dated Track',
                Date: '2023-11-25',
                OriginalDate: '2020',
            },
            null
        );

        expect(result.canonical.releaseDate).toEqual(new Date(Date.UTC(2023, 10, 25)));
        expect(result.canonical.originalReleaseDate).toBe('01-01-2020');
    });
});
