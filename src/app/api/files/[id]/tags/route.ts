import { NextRequest, NextResponse } from 'next/server';

import { eq } from 'drizzle-orm';

import { type TrackPatchApiResponse } from '@/domain/media/dto';
import { parseDateSafe } from '@/domain/media/date';
import { hasLrcTimestamps } from '@/domain/media/lyrics';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { type RawTag, type Track } from '@/domain/media/track';
import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/infrastructure/database/schema';
import { getExifTool } from '@/infrastructure/media-tools/exiftool';
import { type FFprobeAudioResult, probeAudioFile } from '@/infrastructure/media-tools/ffprobe';
import { TagFormSchema } from '@/schemas';
import { buildRawTagList } from '@/services/metadata/raw-tags';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: NextRequest,
    context: RouteContext
): Promise<NextResponse<{ metadata: Track | null; rawTags: RawTag[] } | { error: string }>> {
    await ensureDatabaseInitialized();
    const { id } = await context.params;

    try {
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(audioFiles.id, id))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json({ error: 'Track not found' }, { status: 404 });
        }

        const { audio_files: file, canonical_audio_metadata: meta } = rows[0];
        const track = buildTrackFromDb(file, meta);

        const rawRows = await db.select().from(rawAudioMetadata).where(eq(rawAudioMetadata.fileId, id)).limit(1);

        let exifObj: Record<string, unknown> | null = null;
        let probeObj: FFprobeAudioResult | null = null;

        if (rawRows.length && (rawRows[0].exiftoolJson || rawRows[0].ffprobeJson)) {
            if (rawRows[0].exiftoolJson) {
                try {
                    exifObj = JSON.parse(rawRows[0].exiftoolJson);
                } catch {}
            }
            if (rawRows[0].ffprobeJson) {
                try {
                    probeObj = JSON.parse(rawRows[0].ffprobeJson);
                } catch {}
            }
        } else if (file.path) {
            // On-demand metadata extraction fallback
            try {
                exifObj = await getExifTool().readMetadata(file.path);
                probeObj = await probeAudioFile(file.path);

                const now = new Date();
                await db
                    .insert(rawAudioMetadata)
                    .values({
                        fileId: id,
                        exiftoolJson: exifObj ? JSON.stringify(exifObj) : null,
                        ffprobeJson: probeObj ? JSON.stringify(probeObj) : null,
                        createdAt: now,
                        updatedAt: now,
                    })
                    .onConflictDoUpdate({
                        target: rawAudioMetadata.fileId,
                        set: {
                            exiftoolJson: exifObj ? JSON.stringify(exifObj) : null,
                            ffprobeJson: probeObj ? JSON.stringify(probeObj) : null,
                            updatedAt: now,
                        },
                    });
            } catch (err) {
                console.error('Error in on-demand raw metadata extraction:', err);
            }
        }

        const rawTags = buildRawTagList(exifObj, probeObj);

        return NextResponse.json({ metadata: track, rawTags });
    } catch (error) {
        console.error('Error fetching track detail:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Updates the tags of a specific audio file.
 * @param request The HTTP request object.
 * @param context The route context.
 * @returns A response indicating the success or failure of the update.
 */
export async function PATCH(
    request: NextRequest,
    context: RouteContext
): Promise<NextResponse<TrackPatchApiResponse | { error: string; details?: unknown }>> {
    await ensureDatabaseInitialized();
    const { id } = await context.params;

    try {
        const body = await request.json();
        if (body.releaseDate !== undefined && body.releaseDate !== null) {
            body.releaseDate = parseDateSafe(body.releaseDate);
        }
        const validation = TagFormSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid payload', details: validation.error.issues }, { status: 400 });
        }

        const data = validation.data;

        const updateSet: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (data.title !== undefined) updateSet.title = data.title;
        if (data.artist !== undefined) updateSet.artist = data.artist;
        if (data.albumArtist !== undefined) updateSet.albumArtist = data.albumArtist;
        if (data.album !== undefined) updateSet.album = data.album;
        if (data.trackNumber !== undefined) updateSet.trackNumber = data.trackNumber;
        if (data.discNumber !== undefined) updateSet.discNumber = data.discNumber;
        if (data.releaseDate !== undefined) {
            updateSet.releaseDate = data.releaseDate;
        } else if (data.year !== undefined) {
            updateSet.releaseDate = data.year != null ? new Date(Date.UTC(data.year, 0, 1)) : null;
        }
        if (data.genre !== undefined) updateSet.genre = data.genre;
        if (data.bpm !== undefined) updateSet.bpm = data.bpm;
        if (data.initialKey !== undefined) updateSet.initialKey = data.initialKey;
        if (data.comment !== undefined) updateSet.comment = data.comment;
        if (data.composer !== undefined) updateSet.composer = data.composer;
        if (data.conductor !== undefined) updateSet.conductor = data.conductor;
        if (data.lyricist !== undefined) updateSet.lyricist = data.lyricist;
        if (data.publisher !== undefined) updateSet.publisher = data.publisher;
        if (data.label !== undefined) updateSet.label = data.label;
        if (data.copyright !== undefined) updateSet.copyright = data.copyright;
        if (data.isrc !== undefined) updateSet.isrc = data.isrc;
        if (data.barcode !== undefined) updateSet.barcode = data.barcode;
        if (data.catalogNumber !== undefined) updateSet.catalogNumber = data.catalogNumber;
        if (data.mood !== undefined) updateSet.mood = data.mood;
        if (data.rating !== undefined) updateSet.rating = data.rating;
        if (data.lyrics !== undefined) {
            updateSet.lyrics = data.lyrics;
            if (data.lyrics && data.lyrics.trim().length > 0) {
                updateSet.lyricsType = hasLrcTimestamps(data.lyrics) ? 'synced' : 'unsynced';
            } else {
                updateSet.lyrics = null;
                updateSet.lyricsType = null;
            }
        } else if (data.lyricsType !== undefined) {
            updateSet.lyricsType = data.lyricsType;
        }

        await db.update(canonicalAudioMetadata).set(updateSet).where(eq(canonicalAudioMetadata.fileId, id));

        // Fetch and return the updated track using canonical mapper
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(audioFiles.id, id))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json({ error: 'Track not found after update' }, { status: 404 });
        }

        const { audio_files: file, canonical_audio_metadata: meta } = rows[0];
        const updatedTrack = buildTrackFromDb(file, meta, { forceModified: true });

        return NextResponse.json({ success: true, track: updatedTrack });
    } catch (error) {
        console.error('Error updating track tags:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
