import { describe, expect, it } from 'vitest';
import { isDolbyAtmosAudio, parseQualityString, evaluateQualityComparison, getLocalTrackQuality } from '@/domain/remote-audio/quality-analyzer';
import { selectBestTrackMatch } from '@/domain/remote-audio/track-matcher';
import { type Track } from '@/domain/media/track';
import { type RemoteTrackSummary } from '@/domain/remote-audio/types';

describe('quality-analyzer', () => {
    it('correctly parses 24-bit / 96 kHz lossless tier', () => {
        const tier = parseQualityString('24-bit / 96 kHz', 'flac');
        expect(tier.isLossless).toBe(true);
        expect(tier.bitDepth).toBe(24);
        expect(tier.sampleRateHz).toBe(96000);
        expect(tier.isDolbyAtmos).toBe(false);
        expect(tier.score).toBeGreaterThan(1500);
    });

    it('correctly parses 16-bit / 44.1 kHz CD tier', () => {
        const tier = parseQualityString('16-bit / 44.1 kHz', 'flac');
        expect(tier.isLossless).toBe(true);
        expect(tier.bitDepth).toBe(16);
        expect(tier.sampleRateHz).toBe(44100);
        expect(tier.score).toBe(1200);
    });

    it('identifies Dolby Atmos tracks from flags and formats', () => {
        expect(isDolbyAtmosAudio({ atmos: true })).toBe(true);
        expect(isDolbyAtmosAudio({ audioModes: ['DOLBY_ATMOS'] })).toBe(true);
        expect(isDolbyAtmosAudio({ format: 'dash' }, { codec: 'eac3-joc' })).toBe(true);
        expect(isDolbyAtmosAudio({ audioQuality: 'Dolby Atmos' })).toBe(true);
        expect(isDolbyAtmosAudio({ audioQuality: '24-bit / 96 kHz', format: 'flac' })).toBe(false);
    });

    it('evaluates upgrade correctly when remote has higher resolution lossless', () => {
        const localTrack: Track = {
            id: '1',
            filename: 'song.flac',
            extension: '.flac',
            lossless: true,
            bitDepth: 16,
            sampleRateHz: 44100,
            codec: 'flac',
        };
        const localQuality = getLocalTrackQuality(localTrack);
        const remoteQuality = parseQualityString('24-bit / 96 kHz', 'flac');

        const result = evaluateQualityComparison(localQuality, remoteQuality, false);
        expect(result.status).toBe('upgrade_available');
        expect(result.canDownloadLossless).toBe(true);
        expect(result.canDownloadDolby).toBe(false);
    });

    it('evaluates upgrade when local is lossy and remote is lossless', () => {
        const localTrack: Track = {
            id: '2',
            filename: 'song.mp3',
            extension: '.mp3',
            lossless: false,
            bitrateKbps: 320,
            codec: 'mp3',
        };
        const localQuality = getLocalTrackQuality(localTrack);
        const remoteQuality = parseQualityString('16-bit / 44.1 kHz', 'flac');

        const result = evaluateQualityComparison(localQuality, remoteQuality, false);
        expect(result.status).toBe('upgrade_available');
        expect(result.canDownloadLossless).toBe(true);
    });

    it('flags dolby available when atmos exists', () => {
        const localTrack: Track = {
            id: '3',
            filename: 'song.flac',
            extension: '.flac',
            lossless: true,
            bitDepth: 24,
            sampleRateHz: 96000,
            codec: 'flac',
        };
        const localQuality = getLocalTrackQuality(localTrack);
        const remoteQuality = parseQualityString('Dolby Atmos', 'dash');

        const result = evaluateQualityComparison(localQuality, remoteQuality, true);
        expect(result.status).toBe('dolby_available');
        expect(result.canDownloadDolby).toBe(true);
    });
});

describe('track-matcher', () => {
    it('matches user candidate tracks and detects highest resolution and dolby', () => {
        const localTrack: Track = {
            id: '100',
            filename: 'Kalyani.flac',
            extension: '.flac',
            title: 'KALYANI',
            artist: 'ARJN',
            durationSeconds: 234,
            lossless: true,
            bitDepth: 16,
            sampleRateHz: 44100,
        };

        const candidates: RemoteTrackSummary[] = [
            {
                id: '1',
                title: 'Kalyani Leaves',
                artist: 'Mychael Danna',
                duration: 141,
                audioQuality: '16-bit / 44.1 kHz',
            },
            {
                id: '2',
                title: 'KALYANI',
                artist: 'ARJN',
                album: 'KALYANI',
                duration: 234,
                audioQuality: '24-bit / 96 kHz',
                format: 'flac',
            },
            {
                id: '3',
                title: 'KALYANI (Dolby Mix)',
                artist: 'ARJN',
                duration: 234,
                audioQuality: 'Dolby Atmos',
                atmos: true,
            },
        ];

        const match = selectBestTrackMatch(localTrack, candidates, false);
        expect(match.bestMatch?.id).toBe('2');
        expect(match.hasDolby).toBe(true);
        expect(match.bestDolbyMatch?.id).toBe('3');
        expect(match.confidence).toBeGreaterThan(0.7);
    });
});
