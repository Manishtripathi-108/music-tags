import { type ScanProgressEvent } from '@/domain/scanner/types';
import { AudioRepository, defaultAudioRepository } from '@/infrastructure/database/audio-repository';
import { DirectoryCrawler, type DiscoveredAudioFile, defaultDirectoryCrawler } from '@/infrastructure/filesystem/directory-crawler';
import { extractCoverArt } from '@/infrastructure/media-tools/ffmpeg';
import { AudioMetadataReader, defaultAudioMetadataReader } from '@/infrastructure/media-tools/metadata-reader';
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

    public hasJob(jobId: string): boolean {
        return this.jobManager.hasJob(jobId);
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
    public async scanDirectory(jobId: string, rootPath: string, recursive = true, forceReindex = false): Promise<void> {
        const signal = this.jobManager.getSignal(jobId);
        const startTime = Date.now();

        let scannedCount = 0;
        let indexedCount = 0;
        let extractedCount = 0;
        const pendingExtraction: PendingFileExtraction[] = [];

        try {
            console.log(`\n[SCAN:START] Job ${jobId} initiated`);
            console.log(`[SCAN:TARGET] Target Directory: "${rootPath}" (recursive: ${recursive}, forceReindex: ${forceReindex})`);

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
                console.log(`[SCAN:DIR] Entering: ${dir}`);
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
                console.log(`[SCAN:FILE #${scannedCount}] Discovered: "${file.filename}" (${(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`);
                try {
                    const { fileId, needsMetadata } = await this.repository.upsertAudioFile(file, forceReindex);

                    indexedCount++;

                    if (needsMetadata && !file.scanError) {
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
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error(`[SCAN:ERROR] Failed indexing file "${file.path}":`, msg);
                    try {
                        await this.repository.recordFileErrorByPath(file.path, msg);
                    } catch {}
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
        console.log(`\n[EXTRACT:START] Beginning metadata extraction for ${pendingExtraction.length} tracks with ExifTool & FFprobe`);
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
                console.log(`[SCAN:CANCELLED] Job ${jobId} was cancelled during extraction`);
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
            const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
            const totalBatches = Math.ceil(pendingExtraction.length / CHUNK_SIZE);
            console.log(`[EXTRACT:BATCH ${batchNum}/${totalBatches}] Processing ${chunk.length} files (indices ${i + 1}-${i + chunk.length})`);

            try {
                // 3a. Extract Metadata in Batch
                const extractionResults = await this.metadataReader.extractBatch(paths);

                // 4. Persist Extracted Metadata
                for (let j = 0; j < chunk.length; j++) {
                    const item = chunk[j];
                    const extraction = extractionResults[j];
                    if (!extraction) {
                        console.warn(`[EXTRACT:WARN] Empty extraction result for: "${item.filename}"`);
                        await this.repository.recordScanFailure(item.id, 'Metadata extraction produced empty result');
                        continue;
                    }

                    try {
                        const { canonical } = normalizeAudioMetadata(item.id, extraction.rawExif, extraction.probeResult);

                        if (canonical.hasCoverArt) {
                            extractCoverArt(item.path, item.id).catch(() => null);
                        }

                        await this.repository.upsertTrackMetadata(item.id, canonical, extraction.rawExif, extraction.probeResult);
                        extractedCount++;
                        console.log(
                            `[EXTRACT:TRACK #${extractedCount}] "${canonical.title || item.filename}" | Artist: "${canonical.artist || 'Unknown'}" | Format: ${String(canonical.codec || item.extension).toUpperCase()} | BitDepth: ${canonical.bitDepth ?? '—'}`
                        );
                    } catch (itemErr: unknown) {
                        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
                        console.error(`[EXTRACT:ERROR] Failed persisting metadata for "${item.filename}":`, msg);
                        await this.repository.recordScanFailure(item.id, msg);
                    }
                }
            } catch (batchErr) {
                console.warn(`[EXTRACT:RETRY] Batch extraction threw error, falling back to individual processing:`, batchErr);
                // Fall back to processing each file in this chunk individually so good files succeed
                for (const item of chunk) {
                    if (signal?.aborted) break;
                    try {
                        const singleResults = await this.metadataReader.extractBatch([item.path]);
                        const extraction = singleResults[0];
                        if (!extraction) {
                            await this.repository.recordScanFailure(item.id, 'Metadata extraction produced empty result');
                            continue;
                        }

                        const { canonical } = normalizeAudioMetadata(item.id, extraction.rawExif, extraction.probeResult);
                        if (canonical.hasCoverArt) {
                            extractCoverArt(item.path, item.id).catch(() => null);
                        }

                        await this.repository.upsertTrackMetadata(item.id, canonical, extraction.rawExif, extraction.probeResult);
                        extractedCount++;
                        console.log(
                            `[EXTRACT:SINGLE] "${canonical.title || item.filename}" by "${canonical.artist || 'Unknown'}"`
                        );
                    } catch (singleErr: unknown) {
                        const msg = singleErr instanceof Error ? singleErr.message : String(singleErr);
                        console.error(`[EXTRACT:SINGLE_ERROR] "${item.filename}":`, msg);
                        const isCorrupt = msg.toLowerCase().includes('corrupt') || msg.toLowerCase().includes('invalid');
                        await this.repository.recordScanFailure(item.id, msg, { isCorrupt });
                    }
                }
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
        }

        console.log(`\n[SCAN:COMPLETED] Job ${jobId} finished in ${((Date.now() - startTime) / 1000).toFixed(1)}s! Discovered: ${scannedCount}, Extracted: ${extractedCount}`);

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
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Scanner Job ${jobId}] Scan failed:`, msg);
        this.emit(jobId, {
            jobId,
            status: 'FAILED',
            scannedFiles: scannedCount,
            indexedFiles: indexedCount,
            extractedFiles: extractedCount,
            totalEstimated: scannedCount,
            currentDirectory: rootPath,
            currentFile: '',
            filesPerSecond: 0,
            errorMessage: msg,
        });
    }
}
}

const globalForScanner = globalThis as unknown as {
    globalScanner: AudioLibraryScanner | undefined;
};

export const globalScanner = globalForScanner.globalScanner ?? new AudioLibraryScanner();

if (process.env.NODE_ENV !== 'production') {
    globalForScanner.globalScanner = globalScanner;
}
