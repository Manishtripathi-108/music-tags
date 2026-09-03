import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

import { db } from '@/infrastructure/database/client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/infrastructure/database/schema';
import { SUPPORTED_AUDIO_EXTENSIONS } from '@/domain/media/media-file';
import { type ScanProgressEvent } from '@/domain/scanner/types';

import { getExifTool } from '@/infrastructure/media-tools/exiftool';
import { probeAudioFile } from '@/infrastructure/media-tools/ffprobe';
import { extractCoverArt } from '@/infrastructure/media-tools/ffmpeg';
import { normalizeAudioMetadata } from '@/services/metadata/metadata-normalizer';
import { ScanJobManager } from './job-manager';

export interface PendingFileExtraction {
    id: string;
    path: string;
    filename: string;
    directory: string;
    extension: string;
    sizeBytes: number;
    mtimeMs: number;
}

/**
 * Crawls filesystem directories, discovers audio files, and coordinates extraction of metadata.
 */
export class AudioLibraryScanner {
    private jobManager = new ScanJobManager();

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
     * Traverses a root directory to discover supported audio tracks and writes canonical metadata to the database.
     */
    public async scanDirectory(
        jobId: string,
        rootPath: string,
        recursive = true,
        forceReindex = false
    ): Promise<void> {
        let scannedCount = 0;
        let indexedCount = 0;
        let extractedCount = 0;
        const startTime = Date.now();

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

        const pendingExtraction: PendingFileExtraction[] = [];

        // 1. Directory Traversal
        const queue: string[] = [rootPath];

        while (queue.length > 0) {
            if (this.jobManager.isAborted(jobId)) {
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

            const currentDir = queue.shift()!;
            let dirHandle: fs.Dir | null = null;

            try {
                dirHandle = await fs.promises.opendir(currentDir);
                for await (const dirent of dirHandle) {
                    if (this.jobManager.isAborted(jobId)) break;

                    const fullPath = path.join(currentDir, dirent.name);
                    const ext = path.extname(dirent.name).toLowerCase();

                    if (dirent.isDirectory() && recursive) {
                        if (
                            !dirent.name.startsWith('.') &&
                            dirent.name !== 'node_modules' &&
                            dirent.name !== '$RECYCLE.BIN'
                        ) {
                            queue.push(fullPath);
                        }
                    } else if (dirent.isFile() && SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
                        scannedCount++;
                        try {
                            const stat = await fs.promises.stat(fullPath);
                            const mtimeMs = Math.floor(stat.mtimeMs);
                            const sizeBytes = stat.size;

                            // Check existing record in SQLite
                            const existingRows = await db
                                .select()
                                .from(audioFiles)
                                .where(eq(audioFiles.path, fullPath))
                                .limit(1);

                            const existing = existingRows[0];
                            const fileId = existing?.id || crypto.randomUUID();
                            const needsMetadata =
                                forceReindex ||
                                !existing ||
                                existing.mtimeMs !== mtimeMs ||
                                existing.sizeBytes !== sizeBytes;

                            const now = Date.now();
                            await db
                                .insert(audioFiles)
                                .values({
                                    id: fileId,
                                    path: fullPath,
                                    filename: dirent.name,
                                    directory: currentDir,
                                    extension: ext,
                                    sizeBytes,
                                    mtimeMs,
                                    isMissing: false,
                                    isReadOnly: false,
                                    isLocked: false,
                                    isCorrupt: false,
                                    createdAt: existing ? existing.createdAt : now,
                                    updatedAt: now,
                                })
                                .onConflictDoUpdate({
                                    target: audioFiles.path,
                                    set: {
                                        mtimeMs,
                                        sizeBytes,
                                        isMissing: false,
                                        updatedAt: now,
                                    },
                                });

                            indexedCount++;

                            if (needsMetadata) {
                                pendingExtraction.push({
                                    id: fileId,
                                    path: fullPath,
                                    filename: dirent.name,
                                    directory: currentDir,
                                    extension: ext,
                                    sizeBytes,
                                    mtimeMs,
                                });
                            }

                            if (scannedCount % 50 === 0) {
                                const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.1);
                                this.emit(jobId, {
                                    jobId,
                                    status: 'SCANNING',
                                    scannedFiles: scannedCount,
                                    indexedFiles: indexedCount,
                                    extractedFiles: extractedCount,
                                    totalEstimated: scannedCount,
                                    currentDirectory: currentDir,
                                    currentFile: dirent.name,
                                    filesPerSecond: Math.round(scannedCount / elapsedSec),
                                });
                            }
                        } catch {
                            continue;
                        }
                    }
                }
            } catch {
                continue;
            } finally {
                if (dirHandle) {
                    try {
                        await dirHandle.close();
                    } catch {}
                }
            }
        }

        // 2. Metadata Extraction Phase
        this.emit(jobId, {
            jobId,
            status: 'EXTRACTING',
            scannedFiles: scannedCount,
            indexedFiles: indexedCount,
            extractedFiles: 0,
            totalEstimated: pendingExtraction.length,
            currentDirectory: '',
            currentFile: 'Starting ExifTool & FFprobe extraction...',
            filesPerSecond: 0,
        });

        const exiftool = getExifTool();
        const CHUNK_SIZE = 25;

        for (let i = 0; i < pendingExtraction.length; i += CHUNK_SIZE) {
            if (this.jobManager.isAborted(jobId)) {
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
                const rawResults = await exiftool.readBatchMetadata(paths);

                for (let j = 0; j < chunk.length; j++) {
                    const item = chunk[j];
                    const rawExif = rawResults[j] || (await exiftool.readMetadata(item.path));

                    let probeResult = null;
                    try {
                        probeResult = await probeAudioFile(item.path);
                    } catch {}

                    const { canonical } = normalizeAudioMetadata(item.id, rawExif, probeResult);

                    if (canonical.hasCoverArt) {
                        extractCoverArt(item.path, item.id).catch(() => null);
                    }

                    await db
                        .insert(canonicalAudioMetadata)
                        .values({
                            fileId: item.id,
                            title: canonical.title,
                            artist: canonical.artist,
                            albumArtist: canonical.albumArtist,
                            album: canonical.album,
                            trackNumber: canonical.trackNumber,
                            totalTracks: canonical.totalTracks,
                            discNumber: canonical.discNumber,
                            totalDiscs: canonical.totalDiscs,
                            year: canonical.year,
                            releaseDate: canonical.releaseDate ?? canonical.dateReleased,
                            genre: canonical.genre,
                            composer: canonical.composer,
                            conductor: canonical.conductor,
                            lyricist: canonical.lyricist,
                            remixer: canonical.remixer,
                            publisher: canonical.publisher,
                            label: canonical.label,
                            copyright: canonical.copyright,
                            isrc: canonical.isrc,
                            catalogNumber: canonical.catalogNumber,
                            barcode: canonical.barcode,
                            bpm: canonical.bpm,
                            initialKey: canonical.initialKey,
                            mood: canonical.mood,
                            rating: canonical.rating,
                            description: canonical.description,
                            comment: canonical.comment,
                            lyrics: canonical.lyrics,
                            lyricsLanguage: canonical.lyricsLanguage,
                            lyricsUnsynced: canonical.lyricsUnsynced,
                            lyricsSyncedJson: canonical.lyricsSyncedJson,
                            durationSeconds: canonical.durationSeconds,
                            bitrateKbps: canonical.bitrateKbps,
                            sampleRateHz: canonical.sampleRateHz,
                            channels: canonical.channels,
                            channelLayout: canonical.channelLayout,
                            bitDepth: canonical.bitDepth,
                            codec: canonical.codec,
                            lossless: canonical.lossless,
                            hasCoverArt: canonical.hasCoverArt,
                            coverArtMime: canonical.coverArtMime,
                            coverArtWidth: canonical.coverArtWidth,
                            coverArtHeight: canonical.coverArtHeight,
                            coverArtType: canonical.coverArtType,
                            coverArtDescription: canonical.coverArtDescription,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        })
                        .onConflictDoUpdate({
                            target: canonicalAudioMetadata.fileId,
                            set: {
                                title: canonical.title,
                                artist: canonical.artist,
                                albumArtist: canonical.albumArtist,
                                album: canonical.album,
                                trackNumber: canonical.trackNumber,
                                totalTracks: canonical.totalTracks,
                                discNumber: canonical.discNumber,
                                totalDiscs: canonical.totalDiscs,
                                year: canonical.year,
                                releaseDate: canonical.releaseDate ?? canonical.dateReleased,
                                genre: canonical.genre,
                                composer: canonical.composer,
                                publisher: canonical.publisher,
                                label: canonical.label,
                                copyright: canonical.copyright,
                                isrc: canonical.isrc,
                                catalogNumber: canonical.catalogNumber,
                                barcode: canonical.barcode,
                                bpm: canonical.bpm,
                                initialKey: canonical.initialKey,
                                mood: canonical.mood,
                                rating: canonical.rating,
                                description: canonical.description,
                                comment: canonical.comment,
                                lyrics: canonical.lyrics,
                                lyricsLanguage: canonical.lyricsLanguage,
                                lyricsUnsynced: canonical.lyricsUnsynced,
                                lyricsSyncedJson: canonical.lyricsSyncedJson,
                                durationSeconds: canonical.durationSeconds,
                                bitrateKbps: canonical.bitrateKbps,
                                sampleRateHz: canonical.sampleRateHz,
                                channels: canonical.channels,
                                channelLayout: canonical.channelLayout,
                                bitDepth: canonical.bitDepth,
                                codec: canonical.codec,
                                lossless: canonical.lossless,
                                hasCoverArt: canonical.hasCoverArt,
                                coverArtMime: canonical.coverArtMime,
                                coverArtWidth: canonical.coverArtWidth,
                                coverArtHeight: canonical.coverArtHeight,
                                coverArtType: canonical.coverArtType,
                                coverArtDescription: canonical.coverArtDescription,
                                updatedAt: Date.now(),
                            },
                        });

                    await db
                        .insert(rawAudioMetadata)
                        .values({
                            fileId: item.id,
                            exiftoolJson: JSON.stringify(rawExif),
                            ffprobeJson: probeResult ? JSON.stringify(probeResult) : null,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        })
                        .onConflictDoUpdate({
                            target: rawAudioMetadata.fileId,
                            set: {
                                exiftoolJson: JSON.stringify(rawExif),
                                ffprobeJson: probeResult ? JSON.stringify(probeResult) : null,
                                updatedAt: Date.now(),
                            },
                        });

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
