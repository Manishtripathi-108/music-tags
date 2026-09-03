import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from './schema';
import { type CanonicalAudioMetadata } from '@/domain/media/audio-metadata';
import { type DiscoveredAudioFile } from '@/infrastructure/filesystem/directory-crawler';
import { type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';

export interface FileIndexingResult {
    fileId: string;
    needsMetadata: boolean;
}

/**
 * Builds the canonical database column mapping for canonical_audio_metadata.
 * Single source of truth for both insert and conflict-update operations.
 */
function buildCanonicalColumnValues(
    canonical: CanonicalAudioMetadata,
    timestamp: number
): Omit<typeof canonicalAudioMetadata.$inferInsert, 'fileId' | 'createdAt'> {
    return {
        title: canonical.title,
        artist: canonical.artist,
        albumArtist: canonical.albumArtist,
        album: canonical.album,
        trackNumber: canonical.trackNumber,
        totalTracks: canonical.totalTracks,
        discNumber: canonical.discNumber,
        totalDiscs: canonical.totalDiscs,
        year: canonical.year,
        releaseDate: canonical.releaseDate ?? canonical.dateReleased ?? null,
        genre: canonical.genre,
        composer: canonical.composer,
        conductor: canonical.conductor ?? null,
        lyricist: canonical.lyricist ?? null,
        remixer: canonical.remixer ?? null,
        publisher: canonical.publisher,
        label: canonical.label,
        copyright: canonical.copyright,
        isrc: canonical.isrc,
        catalogNumber: canonical.catalogNumber ?? null,
        barcode: canonical.barcode ?? null,
        bpm: canonical.bpm,
        initialKey: canonical.initialKey,
        mood: canonical.mood,
        rating: canonical.rating,
        description: canonical.description ?? null,
        comment: canonical.comment,
        lyrics: canonical.lyrics,
        lyricsLanguage: canonical.lyricsLanguage ?? null,
        lyricsUnsynced: canonical.lyricsUnsynced ?? null,
        lyricsSyncedJson: canonical.lyricsSyncedJson ?? null,
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
        updatedAt: timestamp,
    };
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
    public async upsertAudioFile(
        file: DiscoveredAudioFile,
        forceReindex = false
    ): Promise<FileIndexingResult> {
        const existingRows = await db
            .select()
            .from(audioFiles)
            .where(eq(audioFiles.path, file.path))
            .limit(1);

        const existing = existingRows[0];
        const fileId = existing?.id || crypto.randomUUID();
        const needsMetadata =
            forceReindex ||
            !existing ||
            existing.mtimeMs !== file.mtimeMs ||
            existing.sizeBytes !== file.sizeBytes;

        const now = Date.now();

        await db
            .insert(audioFiles)
            .values({
                id: fileId,
                path: file.path,
                filename: file.filename,
                directory: file.directory,
                extension: file.extension,
                sizeBytes: file.sizeBytes,
                mtimeMs: file.mtimeMs,
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
     * Reuses the canonical column map for both insert and update.
     */
    public async upsertTrackMetadata(
        fileId: string,
        canonical: CanonicalAudioMetadata,
        rawExif: Record<string, unknown>,
        probeResult?: FFprobeAudioResult | null
    ): Promise<void> {
        const now = Date.now();
        const columnValues = buildCanonicalColumnValues(canonical, now);

        await db
            .insert(canonicalAudioMetadata)
            .values({
                fileId,
                ...columnValues,
                createdAt: now,
            })
            .onConflictDoUpdate({
                target: canonicalAudioMetadata.fileId,
                set: columnValues,
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
