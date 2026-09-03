import { type ScanProgressEvent } from '@/domain/scanner/types';
import {
    DirectoryCrawler,
    defaultDirectoryCrawler,
    type DiscoveredAudioFile,
} from '@/infrastructure/filesystem/directory-crawler';
import {
    AudioRepository,
    defaultAudioRepository,
} from '@/infrastructure/database/audio-repository';
import {
    AudioMetadataReader,
    defaultAudioMetadataReader,
} from '@/infrastructure/media-tools/metadata-reader';
import { extractCoverArt } from '@/infrastructure/media-tools/ffmpeg';
import { normalizeAudioMetadata } from '@/services/metadata/metadata-normalizer';
import { ScanJobManager } from './job-manager';

export interface PendingFileExtraction extends DiscoveredAudioFile {
    id: string;
}

/**
 * Orchestrates library discovery, metadata extraction, normalization, and persistence.
 * Free from database queries, filesystem walking, and CLI child process handling.
 */
export class AudioLibraryScanner {
    private jobManager: ScanJobManager;
    private crawler: DirectoryCrawler;
    private repository: AudioRepository;
    private metadataReader: AudioMetadataReader;

    constructor(
        jobManager = new ScanJobManager(),
        crawler = defaultDirectoryCrawler,
        repository = defaultAudioRepository,
        metadataReader = defaultAudioMetadataReader
    ) {
        this.jobManager = jobManager;
        this.crawler = crawler;
        this.repository = repository;
        this.metadataReader = metadataReader;
    }

    public createJob(): string {
        return this.jobManager.createJob();
    }

    public subscribe(jobId: string, listener: (evt: ScanProgressEvent) => void): void {
        this.jobManager.subscribe(jobId, listener);
    }

    public unsubscribe(jobId: string, listener: (evt: ScanProgressEvent) => void): void {
        this.jobManager.unsubscribe(jobId, listener);
    }

    public cancelJob(jobId: string): void {
        this.jobManager.cancelJob(jobId);
    }

    private emit(jobId: string, event: ScanProgressEvent): void {
        this.jobManager.emit(jobId, event);
    }

    /**
     * Executes the end-to-end scanning pipeline for a directory.
     */
    public async scanDirectory(
        jobId: string,
        rootPath: string,
        recursive = true,
        forceReindex = false
    ): Promise<void> {
        const signal = this.jobManager.getSignal(jobId);
        const startTime = Date.now();

        let scannedCount = 0;
        let indexedCount = 0;
        let extractedCount = 0;
        const pendingExtraction: PendingFileExtraction[] = [];

        // 1. Initial Scanning Event
        this.emit(jobId, {
            jobId,
            status: 'SCANNING',
            scannedFiles: 0,
            indexedFiles: 0,
            extractedFiles: 0,
            totalEstimated: 0,
            currentDirectory: rootPath,
            currentFile: '',
            filesPerSecond: 0,
        });

        // 2. Crawl Filesystem and Index Files in Database
        await this.crawler.crawl({
            rootPath,
            recursive,
            signal,
            onDirectoryEntered: (dir) => {
                if (scannedCount % 50 === 0) {
                    const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.1);
                    this.emit(jobId, {
                        jobId,
                        status: 'SCANNING',
                        scannedFiles: scannedCount,
                        indexedFiles: indexedCount,
                        extractedFiles: 0,
                        totalEstimated: scannedCount,
                        currentDirectory: dir,
                        currentFile: '',
                        filesPerSecond: Math.round(scannedCount / elapsedSec),
                    });
                }
            },
            onFileDiscovered: async (file) => {
                scannedCount++;
                try {
                    const { fileId, needsMetadata } = await this.repository.upsertAudioFile(
                        file,
                        forceReindex
                    );

                    indexedCount++;

                    if (needsMetadata) {
                        pendingExtraction.push({
                            ...file,
                            id: fileId,
                        });
                    }

                    if (scannedCount % 50 === 0) {
                        const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.1);
                        this.emit(jobId, {
                            jobId,
                            status: 'SCANNING',
                            scannedFiles: scannedCount,
                            indexedFiles: indexedCount,
                            extractedFiles: 0,
                            totalEstimated: scannedCount,
                            currentDirectory: file.directory,
                            currentFile: file.filename,
                            filesPerSecond: Math.round(scannedCount / elapsedSec),
                        });
                    }
                } catch {
                    // Skip un-indexable file record gracefully
                }
            },
        });

        if (signal?.aborted) {
            this.emit(jobId, {
                jobId,
                status: 'CANCELLED',
                scannedFiles: scannedCount,
                indexedFiles: indexedCount,
                extractedFiles: extractedCount,
                totalEstimated: scannedCount,
                currentDirectory: '',
                currentFile: '',
                filesPerSecond: 0,
            });
            return;
        }

        // 3. Metadata Extraction Phase
        this.emit(jobId, {
            jobId,
            status: 'EXTRACTING',
            scannedFiles: scannedCount,
            indexedFiles: indexedCount,
            extractedFiles: 0,
            totalEstimated: pendingExtraction.length,
            currentDirectory: '',
            currentFile: 'Extracting audio metadata...',
            filesPerSecond: 0,
        });

        const CHUNK_SIZE = 25;
        for (let i = 0; i < pendingExtraction.length; i += CHUNK_SIZE) {
            if (signal?.aborted) {
                this.emit(jobId, {
                    jobId,
                    status: 'CANCELLED',
                    scannedFiles: scannedCount,
                    indexedFiles: indexedCount,
                    extractedFiles: extractedCount,
                    totalEstimated: pendingExtraction.length,
                    currentDirectory: '',
                    currentFile: '',
                    filesPerSecond: 0,
                });
                return;
            }

            const chunk = pendingExtraction.slice(i, i + CHUNK_SIZE);
            const paths = chunk.map((c) => c.path);

            try {
                const extractionResults = await this.metadataReader.extractBatch(paths);

                for (let j = 0; j < chunk.length; j++) {
                    const item = chunk[j];
                    const extraction = extractionResults[j];
                    if (!extraction) continue;

                    const { canonical } = normalizeAudioMetadata(
                        item.id,
                        extraction.rawExif,
                        extraction.probeResult
                    );

                    if (canonical.hasCoverArt) {
                        extractCoverArt(item.path, item.id).catch(() => null);
                    }

                    await this.repository.upsertTrackMetadata(
                        item.id,
                        canonical,
                        extraction.rawExif,
                        extraction.probeResult
                    );

                    extractedCount++;
                }

                const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.1);
                this.emit(jobId, {
                    jobId,
                    status: 'EXTRACTING',
                    scannedFiles: scannedCount,
                    indexedFiles: indexedCount,
                    extractedFiles: extractedCount,
                    totalEstimated: pendingExtraction.length,
                    currentDirectory: '',
                    currentFile: chunk[chunk.length - 1]?.filename || '',
                    filesPerSecond: Math.round(extractedCount / elapsedSec),
                });
            } catch {
                continue;
            }
        }

        // 4. Completed Event
        this.emit(jobId, {
            jobId,
            status: 'COMPLETED',
            scannedFiles: scannedCount,
            indexedFiles: indexedCount,
            extractedFiles: extractedCount,
            totalEstimated: scannedCount,
            currentDirectory: '',
            currentFile: 'Scan completed successfully.',
            filesPerSecond: 0,
        });
    }
}

export const globalScanner = new AudioLibraryScanner();
