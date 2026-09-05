import { describe, expect, it } from 'vitest';

import { type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';
import { normalizeAudioMetadata } from '@/services/metadata/metadata-normalizer';

describe('normalizeAudioMetadata', () => {
    it('extracts canonical metadata from raw ExifTool and FFprobe structures', () => {
        const rawExif = {
            'ID3:Title': 'Test Song',
            'ID3:Artist': 'Test Artist',
            'ID3:Album': 'Test Album',
            'ID3:Track': '3/10',
            'ID3:Year': '2023',
            'ID3:Genre': 'Rock',
            'ID3:BPM': 128,
            'ID3:Picture': '(Binary data)',
            'ID3:PictureMIMEType': 'image/jpeg',
            'ID3:PictureWidth': 1200,
            'ID3:PictureHeight': 1200,
        };

        const probeResult = {
            format: {
                duration: '185.5',
                bit_rate: '320000',
            },
            streams: [
                {
                    codec_type: 'audio',
                    codec_name: 'mp3',
                    sample_rate: '44100',
                    channels: 2,
                    channel_layout: 'stereo',
                    bits_per_sample: 16,
                },
            ],
        };

        const { canonical, rawTags } = normalizeAudioMetadata('file-123', rawExif, probeResult as unknown as FFprobeAudioResult);

        expect(canonical.fileId).toBe('file-123');
        expect(canonical.title).toBe('Test Song');
        expect(canonical.artist).toBe('Test Artist');
        expect(canonical.album).toBe('Test Album');
        expect(canonical.trackNumber).toBe(3);
        expect(canonical.totalTracks).toBe(10);
        expect(canonical.releaseDate).toBe('2023');
        expect(canonical.genre).toBe('Rock');
        expect(canonical.bpm).toBe(128);
        expect(canonical.durationSeconds).toBe(185.5);
        expect(canonical.bitrateKbps).toBe(320);
        expect(canonical.sampleRateHz).toBe(44100);
        expect(canonical.hasCoverArt).toBe(true);
        expect(canonical.coverArtMime).toBe('image/jpeg');
        expect(canonical.coverArtWidth).toBe(1200);
        expect(canonical.lossless).toBe(false);

        expect(rawTags.length).toBeGreaterThan(0);
        const titleTag = rawTags.find((t) => t.tag.toLowerCase().includes('title'));
        expect(titleTag).toBeDefined();
    });

    it('identifies lossless audio formats correctly', () => {
        const probeFlac = {
            streams: [
                {
                    codec_type: 'audio',
                    codec_name: 'flac',
                },
            ],
        };

        const { canonical } = normalizeAudioMetadata('flac-1', {}, probeFlac as unknown as FFprobeAudioResult);
        expect(canonical.codec).toBe('flac');
        expect(canonical.lossless).toBe(true);
    });

    it('cleans up genre prefixes and "none"', () => {
        const rawExif = {
            Genre: 'genre: Electronic',
        };
        const { canonical } = normalizeAudioMetadata('genre-test', rawExif);
        expect(canonical.genre).toBe('Electronic');
    });
});
