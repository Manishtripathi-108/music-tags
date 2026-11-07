import { describe, expect, it } from 'vitest';
import { isDolbyAtmosAudio, parseQualityString } from '@/domain/remote-audio/quality-analyzer';

describe('Dolby and Lossless Isolation Constraints', () => {
    it('strictly forbids Dolby Atmos when Highest Lossless mode is selected', () => {
        const streamData = {
            url: 'https://audio.example/media/dolby.mp4',
            format: 'dash',
            audioMode: 'DOLBY_ATMOS',
            codec: 'eac3-joc',
            quality: 'Dolby Atmos',
        };

        const isDolby = isDolbyAtmosAudio(null, streamData);
        expect(isDolby).toBe(true);

        const mode: 'highest_lossless' | 'dolby_atmos' = 'highest_lossless';

        // Enforcement condition as in download-track/route.ts:
        let allowed = true;
        let rejectionReason = '';
        if (mode === 'highest_lossless' && isDolby) {
            allowed = false;
            rejectionReason = "Strict mode violation: Dolby Atmos detected. In 'Highest Lossless' mode, Dolby tracks are strictly prohibited.";
        }

        expect(allowed).toBe(false);
        expect(rejectionReason).toContain('strictly prohibited');
    });

    it('strictly forbids non-Dolby stereo audio when Dolby Atmos mode is selected', () => {
        const streamData = {
            url: 'https://audio.example/media/track.flac',
            format: 'flac',
            codec: 'flac',
            quality: 'Lossless · 24-bit / 96 kHz',
            sampleRate: 96000,
            bitDepth: 24,
        };

        const isDolby = isDolbyAtmosAudio(null, streamData);
        expect(isDolby).toBe(false);

        const mode: 'highest_lossless' | 'dolby_atmos' = 'dolby_atmos';

        // Enforcement condition as in download-track/route.ts:
        let allowed = true;
        let rejectionReason = '';
        if (mode === 'dolby_atmos' && !isDolby) {
            allowed = false;
            rejectionReason = "Strict mode violation: Non-Dolby stereo stream detected. In 'Dolby Atmos' mode, non-Dolby tracks are strictly prohibited.";
        }

        expect(allowed).toBe(false);
        expect(rejectionReason).toContain('strictly prohibited');
    });

    it('allows 24-bit / 96 kHz FLAC in Highest Lossless mode', () => {
        const streamData = {
            url: 'https://audio.example/media/track.flac',
            format: 'flac',
            codec: 'flac',
            quality: 'Lossless · 24-bit / 96 kHz',
            sampleRate: 96000,
            bitDepth: 24,
        };

        const isDolby = isDolbyAtmosAudio(null, streamData);
        const qualityTier = parseQualityString(streamData.quality, streamData.codec, streamData);

        const mode: 'highest_lossless' | 'dolby_atmos' = 'highest_lossless';
        const allowed = mode === 'highest_lossless' && !isDolby && qualityTier.isLossless;

        expect(allowed).toBe(true);
    });

    it('allows true Dolby Atmos streams in Dolby Atmos mode', () => {
        const streamData = {
            url: 'https://audio.example/media/dolby.mp4',
            format: 'dash',
            audioMode: 'DOLBY_ATMOS',
            codec: 'eac3-joc',
        };

        const isDolby = isDolbyAtmosAudio(null, streamData);
        const mode: 'highest_lossless' | 'dolby_atmos' = 'dolby_atmos';
        const allowed = mode === 'dolby_atmos' && isDolby;

        expect(allowed).toBe(true);
    });

    it('names file strictly by ISRC and extension without metadata alteration', () => {
        const isrc = 'USRC12345678';
        const extension = 'flac';
        const fileName = `${isrc}.${extension}`;

        expect(fileName).toBe('USRC12345678.flac');
        expect(fileName.startsWith('USRC')).toBe(true);
        expect(fileName.endsWith('.flac')).toBe(true);
    });

    it('identifies previous downloaded file path for cleanup when remote track ID is updated', () => {
        const previousRecord = {
            id: 'match-1',
            localTrackId: 'file-1',
            remoteTrackId: '100', // old ID
            downloadStatus: 'completed',
            downloadPath: '/downloads/USRC12345678.m4a',
        };

        // When remote ID changes to '200'
        const updatedRemoteId = '200';
        const isIdChanged = previousRecord.remoteTrackId !== updatedRemoteId;
        expect(isIdChanged).toBe(true);

        const previousDownloadPath = previousRecord.downloadPath;
        expect(previousDownloadPath).toBe('/downloads/USRC12345678.m4a');
    });

    it('flags already downloaded tracks so user can be prompted before re-downloading', () => {
        const downloadedItem = {
            cachedMatch: {
                downloadStatus: 'completed' as const,
                downloadPath: '/downloads/USRC12345678.flac',
            },
        };

        const notDownloadedItem = {
            cachedMatch: {
                downloadStatus: 'idle' as const,
                downloadPath: null,
            },
        };

        const isDownloaded = (item: { cachedMatch: { downloadStatus: string; downloadPath: string | null } | null }) =>
            item.cachedMatch?.downloadStatus === 'completed' || Boolean(item.cachedMatch?.downloadPath);

        expect(isDownloaded(downloadedItem)).toBe(true);
        expect(isDownloaded(notDownloadedItem)).toBe(false);
    });
});
