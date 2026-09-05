import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { type DiscoveredAudioFile } from '@/infrastructure/filesystem/directory-crawler';
import { type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';
import { type CanonicalAudioMetadataInput } from '@/schemas/audio-metadata.schema';
import { extractedMediaFileSchema } from '@/schemas/media-file.schema';

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
     * Determines whether deep metadata extraction is needed.
     */
    public async upsertAudioFile(file: DiscoveredAudioFile, forceReindex = false): Promise<FileIndexingResult> {
        const existingRows = await db.select().from(audioFiles).where(eq(audioFiles.path, file.path)).limit(1);

        const existing = existingRows[0];
        const fileId = existing?.id || crypto.randomUUID();
        const needsMetadata = forceReindex || !existing || existing.mtimeMs !== file.mtimeMs || existing.sizeBytes !== file.sizeBytes;

        const now = Date.now();

        const safeData = extractedMediaFileSchema.parse({
            id: fileId,
            ...file,
        });

        await db
            .insert(audioFiles)
            .values({
                id: fileId,
                ...safeData,
                createdAt: existing ? existing.createdAt : now,
            })
            .onConflictDoUpdate({
                target: audioFiles.path,
                set: {
                    mtimeMs: file.mtimeMs,
                    sizeBytes: file.sizeBytes,
                    isMissing: false,
                    updatedAt: now,
                },
            });

        return { fileId, needsMetadata };
    }

    /**
     * Persists extracted canonical metadata and raw tool outputs.
     * Passes values through canonicalAudioMetadataInputSchema which validates, coerces, and mutates defaults.
     */
    public async upsertTrackMetadata(
        fileId: string,
        canonical: CanonicalAudioMetadataInput,
        rawExif: Record<string, unknown>,
        probeResult?: FFprobeAudioResult | null
    ): Promise<void> {
        const now = Date.now();

        await db
            .insert(canonicalAudioMetadata)
            .values({
                ...canonical,
                createdAt: now,
            })
            .onConflictDoUpdate({
                target: canonicalAudioMetadata.fileId,
                set: canonical,
            });

        await db
            .insert(rawAudioMetadata)
            .values({
                fileId,
                exiftoolJson: JSON.stringify(rawExif),
                ffprobeJson: probeResult ? JSON.stringify(probeResult) : null,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: rawAudioMetadata.fileId,
                set: {
                    exiftoolJson: JSON.stringify(rawExif),
                    ffprobeJson: probeResult ? JSON.stringify(probeResult) : null,
                    updatedAt: now,
                },
            });
    }
}

export const defaultAudioRepository = new AudioRepository();
