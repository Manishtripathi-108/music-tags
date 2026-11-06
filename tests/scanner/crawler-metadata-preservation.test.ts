import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { AudioRepository } from '@/infrastructure/database/audio-repository';
import { DirectoryCrawler, type DiscoveredAudioFile } from '@/infrastructure/filesystem/directory-crawler';
import { AudioMetadataReader } from '@/infrastructure/media-tools/metadata-reader';
import { type ScanProgressEvent } from '@/domain/scanner/types';
import { AudioLibraryScanner } from '@/services/scanner/scanner-service';
import { ScanJobManager } from '@/services/scanner/job-manager';
import {
    hasScanError,
    isMissingFile,
    isLockedFile,
    isReadOnlyFile,
    isCorruptFile,
    isSymlinkFile,
    hasAnyFileProblem,
    filterTracks,
} from '@/domain/media/predicates';
import { type Track } from '@/domain/media/track';
import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/infrastructure/database/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

describe('Crawler Metadata Preservation & File Status', () => {
    beforeAll(async () => {
        await ensureDatabaseInitialized();
    });

    const repository = new AudioRepository();

    const sampleFile: DiscoveredAudioFile = {
        path: '/test/music/song1.mp3',
        filename: 'song1.mp3',
        directory: '/test/music',
        extension: '.mp3',
        sizeBytes: 4000000,
        mtimeMs: 1700000000000,
        ctimeMs: 1699990000000,
        birthtimeMs: 1699980000000,
        isSymlink: false,
        isReadOnly: false,
        isLocked: false,
        isMissing: false,
        scanError: null,
    };

    beforeEach(async () => {
        // Clean up test paths and referenced child records before each test
        const existing = await db.select({ id: audioFiles.id }).from(audioFiles).where(eq(audioFiles.path, sampleFile.path));
        for (const row of existing) {
            await db.delete(canonicalAudioMetadata).where(eq(canonicalAudioMetadata.fileId, row.id));
            await db.delete(rawAudioMetadata).where(eq(rawAudioMetadata.fileId, row.id));
            await db.delete(audioFiles).where(eq(audioFiles.id, row.id));
        }
    });

    it('preserves all 12 metadata and status fields when file on disk is unchanged', async () => {
        // 1. Ingest initial file
        const { fileId } = await repository.upsertAudioFile(sampleFile);

        // 2. Simulate existing custom metadata & status fields (e.g. from prior scan or tool)
        await db
            .update(audioFiles)
            .set({
                mtimeMs: 1700000000000,
                ctimeMs: 1699990000000,
                birthtimeMs: 1699980000000,
                fileHash: 'sha256-existing-file-hash',
                audioHash: 'chromaprint-existing-audio-hash',
                isMissing: false,
                isReadOnly: true,
                isLocked: true,
                isCorrupt: true,
                isSymlink: true,
                scanStatus: 'CUSTOM_STATUS',
                scanError: 'Prior verified error',
            })
            .where(eq(audioFiles.id, fileId));

        // 3. Re-crawl the file with the same mtimeMs and sizeBytes
        const crawlResult = await repository.upsertAudioFile({
            ...sampleFile,
            // Crawler tries to provide defaults, but repository MUST preserve existing values
            isReadOnly: false,
            isLocked: false,
            isSymlink: false,
            scanError: null,
        });

        expect(crawlResult.needsMetadata).toBe(false);

        // 4. Verify that none of the 12 fields were mutated or overwritten
        const rows = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);
        const saved = rows[0];

        expect(saved.mtimeMs).toBe(1700000000000);
        expect(saved.ctimeMs).toBe(1699990000000);
        expect(saved.birthtimeMs).toBe(1699980000000);
        expect(saved.fileHash).toBe('sha256-existing-file-hash');
        expect(saved.audioHash).toBe('chromaprint-existing-audio-hash');
        expect(saved.isMissing).toBe(false);
        expect(saved.isReadOnly).toBe(true);
        expect(saved.isLocked).toBe(true);
        expect(saved.isCorrupt).toBe(true);
        expect(saved.isSymlink).toBe(true);
        expect(saved.scanStatus).toBe('CUSTOM_STATUS');
        expect(saved.scanError).toBe('Prior verified error');
    });

    it('updates file stats, resets stale errors, and triggers metadata re-extraction when file is re-downloaded/modified', async () => {
        // 1. Initial file with previous corrupt status and error
        const { fileId } = await repository.upsertAudioFile(sampleFile);
        await repository.recordScanFailure(fileId, 'Corrupt file header', { isCorrupt: true });

        // 2. The file is downloaded again: same filename and path, but new mtimeMs and sizeBytes
        const reDownloadedFile: DiscoveredAudioFile = {
            ...sampleFile,
            mtimeMs: 1700050000000, // Newer timestamp
            sizeBytes: 4500000,      // Different size
            scanError: null,
        };

        const result = await repository.upsertAudioFile(reDownloadedFile);
        expect(result.needsMetadata).toBe(true);

        // 3. Verify that disk stats updated, stale hash cleared, and prior error/corruption reset for fresh scan
        const rows = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);
        const updated = rows[0];

        expect(updated.mtimeMs).toBe(1700050000000);
        expect(updated.sizeBytes).toBe(4500000);
        expect(updated.fileHash).toBeNull();
        expect(updated.audioHash).toBeNull();
        expect(updated.isCorrupt).toBe(false);
        expect(updated.scanError).toBeNull();
        expect(updated.scanStatus).toBe('PENDING');
        expect(updated.isMissing).toBe(false);
    });

    it('records scan failure and preserves crawler isolation when processing individual file error', async () => {
        const { fileId } = await repository.upsertAudioFile(sampleFile);

        await repository.recordScanFailure(fileId, 'FFprobe parse failure', { isCorrupt: true, isLocked: true });

        const rows = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);
        const record = rows[0];

        expect(record.scanStatus).toBe('ERROR');
        expect(record.scanError).toBe('FFprobe parse failure');
        expect(record.isCorrupt).toBe(true);
        expect(record.isLocked).toBe(true);
    });

    it('validates canonical and raw metadata with Zod schemas on upsertTrackMetadata', async () => {
        const { fileId } = await repository.upsertAudioFile(sampleFile);

        await repository.upsertTrackMetadata(
            fileId,
            {
                fileId,
                title: 'Clean Track',
                artist: 'Clean Artist',
                album: 'Clean Album',
                trackNumber: 1,
                totalTracks: 5,
                discNumber: 1,
                totalDiscs: 1,
                releaseDate: '2024',
                originalReleaseDate: null,
                compilation: false,
                genre: 'Electronic',
                composer: null,
                conductor: null,
                lyricist: null,
                publisher: null,
                label: null,
                catalogNumber: null,
                barcode: null,
                copyright: null,
                isrc: null,
                mood: null,
                comment: null,
                lyrics: null,
                lyricsType: null,
                bpm: 125,
                initialKey: '8A',
                rating: null,
                durationSeconds: 210,
                containerFormat: 'mp3',
                codec: 'mp3',
                encoder: null,
                bitrateKbps: 320,
                variableBitrate: false,
                sampleRateHz: 44100,
                channels: 2,
                channelLayout: 'stereo',
                bitDepth: 16,
                lossless: false,
                hasCoverArt: false,
                coverArtMime: null,
                coverArtType: null,
                coverArtDescription: null,
                coverArtWidth: null,
                coverArtHeight: null,
            },
            { 'ID3:Title': 'Raw Title' },
            null
        );

        const rows = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);
        expect(rows[0].scanStatus).toBe('COMPLETED');
        expect(rows[0].scanError).toBeNull();
    });

    it('DirectoryCrawler captures inaccessible file errors in scanError without halting crawl', async () => {
        const crawler = new DirectoryCrawler();
        const statSpy = vi.spyOn(fs.promises, 'stat');

        // Simulate stat error on a specific file
        statSpy.mockImplementation(async (filePath) => {
            if (String(filePath).includes('bad-file.mp3')) {
                const err = new Error('Permission denied') as NodeJS.ErrnoException;
                err.code = 'EACCES';
                throw err;
            }
            return {
                size: 1000,
                mtimeMs: 1700000000000,
                ctimeMs: 1700000000000,
                birthtimeMs: 1700000000000,
            } as fs.Stats;
        });

        // Mock opendir returning 2 files: one good, one bad
        const opendirSpy = vi.spyOn(fs.promises, 'opendir');
        opendirSpy.mockResolvedValueOnce({
            async *[Symbol.asyncIterator]() {
                yield { name: 'bad-file.mp3', isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false } as unknown as fs.Dirent;
                yield { name: 'good-file.mp3', isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false } as unknown as fs.Dirent;
            },
            close: async () => {},
        } as unknown as fs.Dir);

        const discovered = await crawler.crawl({
            rootPath: '/dummy/path',
            recursive: false,
        });

        expect(discovered.length).toBe(2);

        const bad = discovered.find((f) => f.filename === 'bad-file.mp3');
        const good = discovered.find((f) => f.filename === 'good-file.mp3');

        expect(bad).toBeDefined();
        expect(bad?.scanError).toContain('Permission denied');
        expect(bad?.isReadOnly).toBe(true);

        expect(good).toBeDefined();
        expect(good?.scanError).toBeNull();

        statSpy.mockRestore();
        opendirSpy.mockRestore();
    });

    it('AudioLibraryScanner gracefully isolates extraction failures so valid files succeed', async () => {
        const mockManager = new ScanJobManager();
        const mockRepo = {
            upsertAudioFile: vi.fn().mockImplementation(async (f: DiscoveredAudioFile) => ({
                fileId: f.filename,
                needsMetadata: true,
            })),
            upsertTrackMetadata: vi.fn().mockResolvedValue(undefined),
            recordScanFailure: vi.fn().mockResolvedValue(undefined),
            recordFileErrorByPath: vi.fn().mockResolvedValue(undefined),
        } as unknown as AudioRepository;

        const mockCrawler = {
            crawl: vi.fn().mockImplementation(async (opts) => {
                opts.onFileDiscovered({
                    path: '/path/good1.mp3',
                    filename: 'good1.mp3',
                    directory: '/path',
                    extension: '.mp3',
                    sizeBytes: 1000,
                    mtimeMs: 1000,
                });
                opts.onFileDiscovered({
                    path: '/path/bad.mp3',
                    filename: 'bad.mp3',
                    directory: '/path',
                    extension: '.mp3',
                    sizeBytes: 1000,
                    mtimeMs: 1000,
                });
            }),
        } as unknown as DirectoryCrawler;

        const mockMetadataReader = {
            extractBatch: vi.fn().mockImplementation(async (paths: string[]) => {
                // If batch contains bad.mp3, simulate batch failure
                if (paths.length > 1 && paths.includes('/path/bad.mp3')) {
                    throw new Error('Batch parser crashed on corrupted audio file');
                }
                // Individual extraction fallback
                if (paths.includes('/path/bad.mp3')) {
                    throw new Error('Corrupt audio header');
                }
                return [
                    {
                        rawExif: { 'ID3:Title': 'Good 1' },
                        probeResult: null,
                    },
                ];
            }),
        };

        const scanner = new AudioLibraryScanner(
            mockManager,
            mockCrawler,
            mockRepo,
            mockMetadataReader as unknown as AudioMetadataReader
        );

        const jobId = scanner.createJob();
        const events: ScanProgressEvent[] = [];
        scanner.subscribe(jobId, (evt) => events.push(evt));

        await scanner.scanDirectory(jobId, '/path', false);

        // Verify that good file was persisted
        expect(mockRepo.upsertTrackMetadata).toHaveBeenCalledWith(
            'good1.mp3',
            expect.objectContaining({ title: 'Good 1' }),
            expect.any(Object),
            null
        );

        // Verify that bad file was recorded with failure without crashing scanner
        expect(mockRepo.recordScanFailure).toHaveBeenCalledWith(
            'bad.mp3',
            'Corrupt audio header',
            { isCorrupt: true }
        );

        // Verify that scanner reached COMPLETED status
        const lastEvent = events[events.length - 1];
        expect(lastEvent.status).toBe('COMPLETED');
    });
});

describe('File problem predicates and UI filtering', () => {
    const mockTracks: Track[] = [
        {
            id: 't1',
            filename: 'clean.mp3',
            extension: '.mp3',
            title: 'Clean',
            scanStatus: 'COMPLETED',
            scanError: null,
            isMissing: false,
            isLocked: false,
            isReadOnly: false,
            isCorrupt: false,
            isSymlink: false,
        },
        {
            id: 't2',
            filename: 'error.mp3',
            extension: '.mp3',
            title: 'Has Error',
            scanStatus: 'ERROR',
            scanError: 'Failed to parse headers',
            isMissing: false,
            isLocked: false,
            isReadOnly: false,
            isCorrupt: false,
            isSymlink: false,
        },
        {
            id: 't3',
            filename: 'missing.flac',
            extension: '.flac',
            title: 'Missing File',
            scanStatus: 'COMPLETED',
            scanError: null,
            isMissing: true,
            isLocked: false,
            isReadOnly: false,
            isCorrupt: false,
            isSymlink: false,
        },
        {
            id: 't4',
            filename: 'locked.wav',
            extension: '.wav',
            title: 'Locked File',
            scanStatus: 'COMPLETED',
            scanError: null,
            isMissing: false,
            isLocked: true,
            isReadOnly: false,
            isCorrupt: false,
            isSymlink: false,
        },
        {
            id: 't5',
            filename: 'corrupt.ogg',
            extension: '.ogg',
            title: 'Corrupt File',
            scanStatus: 'ERROR',
            scanError: 'Truncated packet',
            isMissing: false,
            isLocked: false,
            isReadOnly: false,
            isCorrupt: true,
            isSymlink: false,
        },
        {
            id: 't6',
            filename: 'readonly.mp3',
            extension: '.mp3',
            title: 'Read Only',
            scanStatus: 'COMPLETED',
            scanError: null,
            isMissing: false,
            isLocked: false,
            isReadOnly: true,
            isCorrupt: false,
            isSymlink: false,
        },
        {
            id: 't7',
            filename: 'symlink.mp3',
            extension: '.mp3',
            title: 'Symlink File',
            scanStatus: 'COMPLETED',
            scanError: null,
            isMissing: false,
            isLocked: false,
            isReadOnly: false,
            isCorrupt: false,
            isSymlink: true,
        },
    ];

    it('correctly evaluates all individual problem predicates', () => {
        expect(hasScanError(mockTracks[0])).toBe(false);
        expect(hasScanError(mockTracks[1])).toBe(true);

        expect(isMissingFile(mockTracks[2])).toBe(true);
        expect(isMissingFile(mockTracks[0])).toBe(false);

        expect(isLockedFile(mockTracks[3])).toBe(true);
        expect(isLockedFile(mockTracks[0])).toBe(false);

        expect(isCorruptFile(mockTracks[4])).toBe(true);
        expect(isCorruptFile(mockTracks[0])).toBe(false);

        expect(isReadOnlyFile(mockTracks[5])).toBe(true);
        expect(isReadOnlyFile(mockTracks[0])).toBe(false);

        expect(isSymlinkFile(mockTracks[6])).toBe(true);
        expect(isSymlinkFile(mockTracks[0])).toBe(false);

        expect(hasAnyFileProblem(mockTracks[0])).toBe(false);
        expect(hasAnyFileProblem(mockTracks[1])).toBe(true);
        expect(hasAnyFileProblem(mockTracks[2])).toBe(true);
        expect(hasAnyFileProblem(mockTracks[3])).toBe(true);
        expect(hasAnyFileProblem(mockTracks[4])).toBe(true);
    });

    it('filters tracks by problem criteria for UI sidebar navigation', () => {
        expect(filterTracks(mockTracks, { activeFilter: 'problems' }).map((t) => t.id)).toEqual([
            't2',
            't3',
            't4',
            't5',
        ]);
        expect(filterTracks(mockTracks, { activeFilter: 'scan-errors' }).map((t) => t.id)).toEqual(['t2', 't5']);
        expect(filterTracks(mockTracks, { activeFilter: 'missing-files' }).map((t) => t.id)).toEqual(['t3']);
        expect(filterTracks(mockTracks, { activeFilter: 'locked-files' }).map((t) => t.id)).toEqual(['t4']);
        expect(filterTracks(mockTracks, { activeFilter: 'corrupt-files' }).map((t) => t.id)).toEqual(['t5']);
        expect(filterTracks(mockTracks, { activeFilter: 'readonly-files' }).map((t) => t.id)).toEqual(['t6']);
        expect(filterTracks(mockTracks, { activeFilter: 'symlinks' }).map((t) => t.id)).toEqual(['t7']);
    });
});
