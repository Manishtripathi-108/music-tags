import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { type DiscoveredAudioFile } from '@/infrastructure/filesystem/directory-crawler';
import { type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';
import { canonicalAudioMetadataInputSchema, type CanonicalAudioMetadataInput } from '@/schemas/audio-metadata.schema';
import { mediaFileSchema, type MediaFileOutput } from '@/schemas/media-file.schema';
import { rawAudioMetadataSchema } from '@/schemas/raw-audio-metadata.schema';

import { db } from './client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from './schema';

export interface FileIndexingResult {
    fileId: string;
    needsMetadata: boolean;
}

/**
 * Repository encapsulating persistence of audio files, canonical metadata,
 * and raw extraction data into SQLite tables.
 */
export class AudioRepository {
    /**
     * Upserts an audio file's filesystem metadata into the database.
     * Preserves existing metadata and status fields unless explicitly responsible for updating them.
     */
    public async upsertAudioFile(file: DiscoveredAudioFile, forceReindex = false): Promise<FileIndexingResult> {
        const existingRows = await db.select().from(audioFiles).where(eq(audioFiles.path, file.path)).limit(1);

        const existing = existingRows[0];
        const fileId = existing?.id || crypto.randomUUID();
        const now = new Date();

        const isNew = !existing;
        const hasChanged = !isNew && (existing.mtimeMs !== file.mtimeMs || existing.sizeBytes !== file.sizeBytes);
        const needsMetadata =
            !file.scanError && (forceReindex || isNew || hasChanged || existing?.scanStatus === 'ERROR' || !existing?.scanStatus);

        let fileRecordToPersist: MediaFileOutput;

        if (isNew) {
            // New file: initialize fields with discovered values
            fileRecordToPersist = mediaFileSchema.parse({
                id: fileId,
                path: file.path,
                filename: file.filename,
                directory: file.directory,
                extension: file.extension,
                sizeBytes: file.sizeBytes,
                mtimeMs: file.mtimeMs,
                ctimeMs: file.ctimeMs ?? null,
                birthtimeMs: file.birthtimeMs ?? null,
                fileHash: null,
                audioHash: null,
                isMissing: Boolean(file.isMissing),
                isReadOnly: Boolean(file.isReadOnly),
                isLocked: Boolean(file.isLocked),
                isCorrupt: false,
                isSymlink: Boolean(file.isSymlink),
                scanStatus: file.scanError ? 'ERROR' : 'PENDING',
                scanError: file.scanError ?? null,
                lastScannedAt: null,
                lastVerifiedAt: now,
                createdAt: now,
                updatedAt: now,
            });
        } else if (hasChanged || forceReindex) {
            // File was modified, replaced, or re-downloaded: update physical specs & re-evaluate
            fileRecordToPersist = mediaFileSchema.parse({
                id: fileId,
                path: file.path,
                filename: file.filename,
                directory: file.directory,
                extension: file.extension,
                sizeBytes: file.sizeBytes,
                mtimeMs: file.mtimeMs,
                ctimeMs: file.ctimeMs ?? existing.ctimeMs ?? null,
                birthtimeMs: file.birthtimeMs ?? existing.birthtimeMs ?? null,
                fileHash: null, // invalidate stale hash since contents changed
                audioHash: null,
                isMissing: false,
                isReadOnly: Boolean(file.isReadOnly),
                isLocked: Boolean(file.isLocked),
                isCorrupt: false, // reset previous corruption on fresh file
                isSymlink: Boolean(file.isSymlink),
                scanStatus: file.scanError ? 'ERROR' : 'PENDING',
                scanError: file.scanError ?? null,
                lastScannedAt: existing.lastScannedAt,
                lastVerifiedAt: now,
                createdAt: existing.createdAt,
                updatedAt: now,
            });
        } else {
            // Unchanged existing file: strictly preserve all 12 metadata and status fields
            fileRecordToPersist = mediaFileSchema.parse({
                id: fileId,
                path: file.path,
                filename: file.filename,
                directory: file.directory,
                extension: file.extension,
                sizeBytes: existing.sizeBytes,
                mtimeMs: existing.mtimeMs,
                ctimeMs: existing.ctimeMs,
                birthtimeMs: existing.birthtimeMs,
                fileHash: existing.fileHash,
                audioHash: existing.audioHash,
                isMissing: existing.isMissing,
                isReadOnly: existing.isReadOnly,
                isLocked: existing.isLocked,
                isCorrupt: existing.isCorrupt,
                isSymlink: existing.isSymlink,
                scanStatus: file.scanError ? 'ERROR' : existing.scanStatus,
                scanError: file.scanError ?? existing.scanError,
                lastScannedAt: existing.lastScannedAt,
                lastVerifiedAt: now,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
            });
        }

        if (existing) {
            await db.update(audioFiles).set(fileRecordToPersist).where(eq(audioFiles.id, fileId));
        } else {
            await db.insert(audioFiles).values(fileRecordToPersist);
        }

        return { fileId, needsMetadata };
    }

    /**
     * Persists extracted canonical metadata and raw tool outputs.
     * Validates through Zod schemas and updates scan status to COMPLETED.
     */
    public async upsertTrackMetadata(
        fileId: string,
        canonical: CanonicalAudioMetadataInput,
        rawExif: Record<string, unknown>,
        probeResult?: FFprobeAudioResult | null
    ): Promise<void> {
        const now = new Date();

        const validatedCanonical = canonicalAudioMetadataInputSchema.parse(canonical);

        await db
            .insert(canonicalAudioMetadata)
            .values({
                ...validatedCanonical,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: canonicalAudioMetadata.fileId,
                set: {
                    ...validatedCanonical,
                    updatedAt: now,
                },
            });

        const validatedRaw = rawAudioMetadataSchema.parse({
            fileId,
            exiftoolJson: JSON.stringify(rawExif),
            ffprobeJson: probeResult ? JSON.stringify(probeResult) : null,
            extractionStatus: 'COMPLETED',
            extractionError: null,
            createdAt: now,
            updatedAt: now,
        });

        await db
            .insert(rawAudioMetadata)
            .values(validatedRaw)
            .onConflictDoUpdate({
                target: rawAudioMetadata.fileId,
                set: {
                    exiftoolJson: validatedRaw.exiftoolJson,
                    ffprobeJson: validatedRaw.ffprobeJson,
                    extractionStatus: validatedRaw.extractionStatus,
                    extractionError: validatedRaw.extractionError,
                    updatedAt: now,
                },
            });

        // Mark file as completed and clear any previous scan error
        await db
            .update(audioFiles)
            .set({
                scanStatus: 'COMPLETED',
                scanError: null,
                lastScannedAt: now,
                updatedAt: now,
            })
            .where(eq(audioFiles.id, fileId));
    }

    /**
     * Records a failure for a specific file, updating its status to ERROR.
     */
    public async recordScanFailure(
        fileId: string,
        errorMessage: string,
        flags?: { isCorrupt?: boolean; isLocked?: boolean; isMissing?: boolean; isReadOnly?: boolean }
    ): Promise<void> {
        const now = new Date();

        await db
            .update(audioFiles)
            .set({
                scanStatus: 'ERROR',
                scanError: errorMessage,
                lastScannedAt: now,
                updatedAt: now,
                ...(flags?.isCorrupt !== undefined ? { isCorrupt: flags.isCorrupt } : {}),
                ...(flags?.isLocked !== undefined ? { isLocked: flags.isLocked } : {}),
                ...(flags?.isMissing !== undefined ? { isMissing: flags.isMissing } : {}),
                ...(flags?.isReadOnly !== undefined ? { isReadOnly: flags.isReadOnly } : {}),
            })
            .where(eq(audioFiles.id, fileId));

        const validatedRaw = rawAudioMetadataSchema.parse({
            fileId,
            exiftoolJson: null,
            ffprobeJson: null,
            extractionStatus: 'ERROR',
            extractionError: errorMessage,
            createdAt: now,
            updatedAt: now,
        });

        await db
            .insert(rawAudioMetadata)
            .values(validatedRaw)
            .onConflictDoUpdate({
                target: rawAudioMetadata.fileId,
                set: {
                    extractionStatus: 'ERROR',
                    extractionError: errorMessage,
                    updatedAt: now,
                },
            });
    }

    /**
     * Records an error by path for files that could not be indexed by ID.
     */
    public async recordFileErrorByPath(filePath: string, errorMessage: string): Promise<void> {
        const now = new Date();
        await db
            .update(audioFiles)
            .set({
                scanStatus: 'ERROR',
                scanError: errorMessage,
                lastScannedAt: now,
                updatedAt: now,
            })
            .where(eq(audioFiles.path, filePath));
    }
}

export const defaultAudioRepository = new AudioRepository();
