import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

import { db } from '@/db/client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/db/schema';
import { SUPPORTED_AUDIO_EXTENSIONS, ScanProgressEvent } from '@/types/audio';

import { getExifTool } from '../binaries/exiftool';
import { probeAudioFile } from '../binaries/ffprobe';
import { normalizeAudioMetadata } from '../metadata/normalizer';

export class AudioLibraryScanner {
    private activeJobs = new Map<string, { abort: boolean; listeners: ((evt: ScanProgressEvent) => void)[] }>();

    public createJob(): string {
        const jobId = crypto.randomUUID();
        this.activeJobs.set(jobId, { abort: false, listeners: [] });
        return jobId;
    }

    public subscribe(jobId: string, listener: (evt: ScanProgressEvent) => void) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners.push(listener);
        }
    }

    public cancelJob(jobId: string) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.abort = true;
        }
    }

    private emit(jobId: string, event: ScanProgressEvent) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.listeners.forEach((fn) => fn(event));
        }
    }

    public async scanDirectory(jobId: string, rootPath: string, recursive = true, forceReindex = false): Promise<void> {
        const job = this.activeJobs.get(jobId);
        if (!job) return;

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

        const pendingExtraction: Array<{
            id: string;
            path: string;
            filename: string;
            directory: string;
            extension: string;
            sizeBytes: number;
            mtimeMs: number;
        }> = [];

        // 1. Directory Traversal
        const queue: string[] = [rootPath];

        while (queue.length > 0) {
            if (job.abort) {
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
                    if (job.abort) break;

                    const fullPath = path.join(currentDir, dirent.name);
                    const ext = path.extname(dirent.name).toLowerCase();

                    if (dirent.isDirectory() && recursive) {
                        if (!dirent.name.startsWith('.') && dirent.name !== 'node_modules' && dirent.name !== '$RECYCLE.BIN') {
                            queue.push(fullPath);
                        }
                    } else if (dirent.isFile() && SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
                        scannedCount++;
                        try {
                            const stat = await fs.promises.stat(fullPath);
                            const mtimeMs = Math.floor(stat.mtimeMs);
                            const sizeBytes = stat.size;

                            // Check existing record in SQLite
                            const existingRows = await db.select().from(audioFiles).where(eq(audioFiles.path, fullPath)).limit(1);

                            const existing = existingRows[0];
                            const fileId = existing?.id || crypto.randomUUID();
                            const needsMetadata = forceReindex || !existing || existing.mtimeMs !== mtimeMs || existing.sizeBytes !== sizeBytes;

                            // Upsert file entry into SQLite
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
            if (job.abort) {
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
                            bpm: canonical.bpm,
                            initialKey: canonical.initialKey,
                            mood: canonical.mood,
                            rating: canonical.rating,
                            comment: canonical.comment,
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
                                bpm: canonical.bpm,
                                initialKey: canonical.initialKey,
                                rating: canonical.rating,
                                comment: canonical.comment,
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
