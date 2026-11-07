import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkLibraryQualityForTrack } from '@/services/eclipse/qualityChecker';
import { db } from '@/infrastructure/database/client';

vi.mock('@/infrastructure/database/init', () => ({
    ensureDatabaseInitialized: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/infrastructure/database/client', () => {
    return {
        db: {
            select: vi.fn(),
        },
    };
});

describe('Eclipse Library Quality Checker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockStreamHires = {
        url: 'https://im-cf.manifest.tidal.com/1/manifests/test.mpd',
        format: 'FLAC 24-bit/48kHz',
        quality: '24-bit / 48kHz FLAC (1647kbps)',
        codec: 'flac',
        tier: 'FLAC_HIRES',
        sampleRate: 48000,
        bitDepth: 24,
        isrc: 'QT6672603052',
    };

    it('skips download if existing local track in library has same quality (24/48 FLAC)', async () => {
        // Mock DB returning a matched track with 24-bit 48kHz FLAC
        (db.select as any).mockReturnValue({
            from: () => ({
                innerJoin: () => ({
                    where: () => ({
                        limit: () => [
                            {
                                audio_files: {
                                    id: 'file-1',
                                    path: '/music/track.flac',
                                    extension: 'flac',
                                },
                                canonical_audio_metadata: {
                                    title: 'Test Song',
                                    artist: 'Test Artist',
                                    isrc: 'QT6672603052',
                                    bitDepth: 24,
                                    sampleRateHz: 48000,
                                    lossless: true,
                                    codec: 'flac',
                                },
                            },
                        ],
                    }),
                }),
            }),
        });

        const result = await checkLibraryQualityForTrack({
            isrc: 'QT6672603052',
            title: 'Test Song',
            artist: 'Test Artist',
            streamInfo: mockStreamHires,
        });

        expect(result.canDownload).toBe(false);
        expect(result.skipped).toBe(true);
        expect(result.hasSameOrHigher).toBe(true);
        expect(result.reason).toBe('same_or_higher_quality');
        expect(result.message).toContain('Already have same or higher quality');
    });

    it('skips download if existing local track has higher quality (24/96 FLAC > 24/48 FLAC)', async () => {
        (db.select as any).mockReturnValue({
            from: () => ({
                innerJoin: () => ({
                    where: () => ({
                        limit: () => [
                            {
                                audio_files: {
                                    id: 'file-2',
                                    path: '/music/track96.flac',
                                    extension: 'flac',
                                },
                                canonical_audio_metadata: {
                                    title: 'Test Song',
                                    artist: 'Test Artist',
                                    isrc: 'QT6672603052',
                                    bitDepth: 24,
                                    sampleRateHz: 96000,
                                    lossless: true,
                                    codec: 'flac',
                                },
                            },
                        ],
                    }),
                }),
            }),
        });

        const result = await checkLibraryQualityForTrack({
            isrc: 'QT6672603052',
            title: 'Test Song',
            artist: 'Test Artist',
            streamInfo: mockStreamHires,
        });

        expect(result.canDownload).toBe(false);
        expect(result.skipped).toBe(true);
        expect(result.hasSameOrHigher).toBe(true);
        expect(result.reason).toBe('same_or_higher_quality');
    });

    it('allows download as upgrade if local track is lower quality (MP3 320kbps vs 24/48 FLAC)', async () => {
        (db.select as any).mockReturnValue({
            from: () => ({
                innerJoin: () => ({
                    where: () => ({
                        limit: () => [
                            {
                                audio_files: {
                                    id: 'file-3',
                                    path: '/music/track.mp3',
                                    extension: 'mp3',
                                },
                                canonical_audio_metadata: {
                                    title: 'Test Song',
                                    artist: 'Test Artist',
                                    isrc: 'QT6672603052',
                                    bitDepth: null,
                                    sampleRateHz: 44100,
                                    bitrateKbps: 320,
                                    lossless: false,
                                    codec: 'mp3',
                                },
                            },
                        ],
                    }),
                }),
            }),
        });

        const result = await checkLibraryQualityForTrack({
            isrc: 'QT6672603052',
            title: 'Test Song',
            artist: 'Test Artist',
            streamInfo: mockStreamHires,
        });

        expect(result.canDownload).toBe(true);
        expect(result.skipped).toBe(false);
        expect(result.hasSameOrHigher).toBe(false);
        expect(result.reason).toBe('upgrade_available');
        expect(result.message).toContain('Quality upgrade available');
    });

    it('allows download when track is not in library', async () => {
        (db.select as any).mockReturnValue({
            from: () => ({
                innerJoin: () => ({
                    where: () => ({
                        limit: () => [],
                    }),
                }),
            }),
        });

        const result = await checkLibraryQualityForTrack({
            isrc: 'NEW_ISRC',
            title: 'New Track',
            artist: 'New Artist',
            streamInfo: mockStreamHires,
        });

        expect(result.canDownload).toBe(true);
        expect(result.skipped).toBe(false);
        expect(result.hasSameOrHigher).toBe(false);
        expect(result.reason).toBe('not_in_library');
    });

    it('bypasses quality skip when forceRedownload is true', async () => {
        (db.select as any).mockReturnValue({
            from: () => ({
                innerJoin: () => ({
                    where: () => ({
                        limit: () => [
                            {
                                audio_files: { id: 'file-1', path: '/music/track.flac', extension: 'flac' },
                                canonical_audio_metadata: {
                                    title: 'Test Song',
                                    artist: 'Test Artist',
                                    isrc: 'QT6672603052',
                                    bitDepth: 24,
                                    sampleRateHz: 48000,
                                    lossless: true,
                                    codec: 'flac',
                                },
                            },
                        ],
                    }),
                }),
            }),
        });

        const result = await checkLibraryQualityForTrack({
            isrc: 'QT6672603052',
            title: 'Test Song',
            artist: 'Test Artist',
            streamInfo: mockStreamHires,
            forceRedownload: true,
        });

        expect(result.canDownload).toBe(true);
        expect(result.skipped).toBe(false);
        expect(result.reason).toBe('force_redownload');
    });
});
