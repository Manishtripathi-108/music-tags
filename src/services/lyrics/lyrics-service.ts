import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

import { type LrcTrackMetadata, normalizeLrc } from '@/domain/lyrics/lrc-parser';
import { REGEX_LRC_TIMESTAMP } from '@/domain/media/lyrics';
import { type ScanProgressEvent } from '@/domain/scanner/types';
import { db } from '@/infrastructure/database/client';
import { audioFiles, canonicalAudioMetadata } from '@/infrastructure/database/schema';

export interface NormalizeFileResult {
    success: boolean;
    trackId?: string;
    filePath: string;
    lrcPath?: string;
    normalizedLrc?: string;
    skipped?: boolean;
    error?: string;
}

/**
 * Resolves the path to a sidecar .lrc file for an audio file path.
 * Checks for case-insensitive matching on disk if needed.
 */
export function resolveLrcPath(audioFilePath: string): string {
    const dir = path.dirname(audioFilePath);
    const baseName = path.parse(audioFilePath).name;
    const expected = path.join(dir, `${baseName}.lrc`);

    if (fs.existsSync(/*turbopackIgnore: true*/ expected)) {
        return expected;
    }

    try {
        if (fs.existsSync(/*turbopackIgnore: true*/ dir)) {
            const files = fs.readdirSync(/*turbopackIgnore: true*/ dir);
            const targetLower = `${baseName.toLowerCase()}.lrc`;
            const matched = files.find((f) => f.toLowerCase() === targetLower);
            if (matched) {
                return path.join(dir, matched);
            }
        }
    } catch {}

    return expected;
}

/**
 * Normalizes an individual audio file's LRC sidecar file or embedded lyrics.
 * Writes changes back to the .lrc file on disk and updates the database.
 */
export async function normalizeTrackLrcFile(track: LrcTrackMetadata & { id: string }, explicitLrcContent?: string): Promise<NormalizeFileResult> {
    if (!track.filePath) {
        return {
            success: false,
            trackId: track.id,
            filePath: '',
            error: 'Missing file path for track',
        };
    }

    const lrcPath = resolveLrcPath(track.filePath);
    let sourceLrc = explicitLrcContent;

    if (!sourceLrc && fs.existsSync(/*turbopackIgnore: true*/ lrcPath)) {
        try {
            sourceLrc = fs.readFileSync(/*turbopackIgnore: true*/ lrcPath, 'utf8');
        } catch (err) {
            return {
                success: false,
                trackId: track.id,
                filePath: track.filePath,
                lrcPath,
                error: `Failed to read LRC file: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    if (!sourceLrc) {
        return {
            success: false,
            trackId: track.id,
            filePath: track.filePath,
            skipped: true,
            error: 'No LRC file or synced lyrics found for this track',
        };
    }

    const result = normalizeLrc(track, sourceLrc);
    if (!result.success) {
        return {
            success: false,
            trackId: track.id,
            filePath: track.filePath,
            lrcPath,
            error: result.error,
        };
    }

    try {
        fs.writeFileSync(lrcPath, result.normalizedLrc, 'utf8');
    } catch (err) {
        return {
            success: false,
            trackId: track.id,
            filePath: track.filePath,
            lrcPath,
            error: `Failed to write normalized LRC to disk: ${err instanceof Error ? err.message : String(err)}`,
        };
    }

    try {
        await db
            .update(canonicalAudioMetadata)
            .set({
                lyrics: result.normalizedLrc,
                lyricsType: 'synced',
                updatedAt: new Date(),
            })
            .where(eq(canonicalAudioMetadata.fileId, track.id));
    } catch (dbErr) {
        console.error(`[normalizeTrackLrcFile] Failed to update DB for ${track.id}:`, dbErr);
    }

    return {
        success: true,
        trackId: track.id,
        filePath: track.filePath,
        lrcPath,
        normalizedLrc: result.normalizedLrc,
    };
}

/**
 * Service managing background batch LRC normalization across library or folders.
 */
class LyricsNormalizationService extends EventEmitter {
    private activeJobs = new Map<string, { abort: boolean }>();

    public createJob(): string {
        const jobId = `lrc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        this.activeJobs.set(jobId, { abort: false });
        return jobId;
    }

    public cancelJob(jobId: string): void {
        const job = this.activeJobs.get(jobId);
        if (job) job.abort = true;
    }

    public subscribe(jobId: string, listener: (event: ScanProgressEvent) => void): void {
        this.on(jobId, listener);
    }

    public unsubscribe(jobId: string, listener: (event: ScanProgressEvent) => void): void {
        this.off(jobId, listener);
    }

    public async normalizeAll(jobId: string, folderPath?: string): Promise<{ normalized: number; failed: number; skipped: number }> {
        const job = this.activeJobs.get(jobId) || { abort: false };

        const rows = await db.select().from(audioFiles).leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId));

        let candidateTracks = rows.map((r) => ({
            id: r.audio_files.id,
            filename: r.audio_files.filename,
            filePath: r.audio_files.path,
            directory: r.audio_files.directory,
            title: r.canonical_audio_metadata?.title,
            album: r.canonical_audio_metadata?.album,
            artist: r.canonical_audio_metadata?.artist,
            albumArtist: r.canonical_audio_metadata?.albumArtist,
            durationSeconds: r.canonical_audio_metadata?.durationSeconds,
            lyrics: r.canonical_audio_metadata?.lyrics,
            lyricsType: r.canonical_audio_metadata?.lyricsType,
        }));

        if (folderPath) {
            candidateTracks = candidateTracks.filter((t) => t.directory === folderPath || t.filePath.startsWith(folderPath));
        }

        const totalEstimated = candidateTracks.length;
        let normalizedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        this.emit(jobId, {
            jobId,
            status: 'NORMALIZING',
            scannedFiles: 0,
            indexedFiles: 0,
            extractedFiles: 0,
            totalEstimated,
            currentDirectory: folderPath || 'All Library',
            currentFile: 'Scanning for LRC files...',
            filesPerSecond: 0,
        });

        for (let i = 0; i < candidateTracks.length; i++) {
            if (job.abort) {
                this.emit(jobId, {
                    jobId,
                    status: 'CANCELLED',
                    scannedFiles: normalizedCount,
                    indexedFiles: skippedCount,
                    extractedFiles: failedCount,
                    totalEstimated,
                    currentDirectory: '',
                    currentFile: '',
                    filesPerSecond: 0,
                });
                return { normalized: normalizedCount, failed: failedCount, skipped: skippedCount };
            }

            const track = candidateTracks[i];
            const lrcPath = resolveLrcPath(track.filePath);
            const hasSidecar = fs.existsSync(/*turbopackIgnore: true*/ lrcPath);
            const hasDbLrc = Boolean(track.lyrics && REGEX_LRC_TIMESTAMP.test(track.lyrics));

            if (!hasSidecar && !hasDbLrc) {
                skippedCount++;
                continue;
            }

            const explicitContent = !hasSidecar && hasDbLrc ? track.lyrics || undefined : undefined;
            const res = await normalizeTrackLrcFile(track, explicitContent);

            if (res.success) {
                normalizedCount++;
            } else if (res.skipped) {
                skippedCount++;
            } else {
                failedCount++;
            }

            this.emit(jobId, {
                jobId,
                status: 'NORMALIZING',
                scannedFiles: normalizedCount,
                indexedFiles: skippedCount,
                extractedFiles: failedCount,
                totalEstimated,
                currentDirectory: track.directory || '',
                currentFile: `Normalizing ${track.title || track.filename}...`,
                filesPerSecond: 0,
            });
        }

        const summaryMessage = `${normalizedCount} lyrics normalized, ${failedCount} failed, ${skippedCount} skipped`;

        this.emit(jobId, {
            jobId,
            status: 'COMPLETED',
            scannedFiles: normalizedCount,
            indexedFiles: skippedCount,
            extractedFiles: failedCount,
            totalEstimated,
            currentDirectory: '',
            currentFile: '',
            filesPerSecond: 0,
            errorMessage: summaryMessage,
        });

        this.activeJobs.delete(jobId);
        return { normalized: normalizedCount, failed: failedCount, skipped: skippedCount };
    }
}

export const globalLyricsNormalizer = new LyricsNormalizationService();
