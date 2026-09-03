import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/infrastructure/database/schema';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { type Track, type RawTag } from '@/domain/media/track';
import { type TrackPatchApiResponse } from '@/domain/media/dto';
import { TrackPatchSchema } from '@/schemas';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { isLrcContent } from '@/domain/media/lyrics';
import { getExifTool } from '@/infrastructure/media-tools/exiftool';
import { probeAudioFile, type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';
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

        const rawRows = await db
            .select()
            .from(rawAudioMetadata)
            .where(eq(rawAudioMetadata.fileId, id))
            .limit(1);

        let exifObj: Record<string, unknown> | null = null;
        let probeObj: FFprobeAudioResult | null = null;

        if (rawRows.length && (rawRows[0].exiftoolJson || rawRows[0].ffprobeJson)) {
            if (rawRows[0].exiftoolJson) {
                try { exifObj = JSON.parse(rawRows[0].exiftoolJson); } catch {}
            }
            if (rawRows[0].ffprobeJson) {
                try { probeObj = JSON.parse(rawRows[0].ffprobeJson); } catch {}
            }
        } else if (file.path) {
            // On-demand metadata extraction fallback
            try {
                exifObj = await getExifTool().readMetadata(file.path);
                probeObj = await probeAudioFile(file.path);

                await db
                    .insert(rawAudioMetadata)
                    .values({
                        fileId: id,
                        exiftoolJson: exifObj ? JSON.stringify(exifObj) : null,
                        ffprobeJson: probeObj ? JSON.stringify(probeObj) : null,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    })
                    .onConflictDoUpdate({
                        target: rawAudioMetadata.fileId,
                        set: {
                            exiftoolJson: exifObj ? JSON.stringify(exifObj) : null,
                            ffprobeJson: probeObj ? JSON.stringify(probeObj) : null,
                            updatedAt: Date.now(),
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

export async function PATCH(
    request: NextRequest,
    context: RouteContext
): Promise<NextResponse<TrackPatchApiResponse | { error: string; details?: unknown }>> {
    await ensureDatabaseInitialized();
    const { id } = await context.params;

    try {
        const body = await request.json();
        const validation = TrackPatchSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid payload', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const data = validation.data;

        // Auto-detect lyrics format if lyrics provided
        let lyricsSyncedJson = data.lyricsSyncedJson;
        let lyricsUnsynced = data.lyricsUnsynced;
        if (data.lyrics !== undefined) {
            const isLrc = isLrcContent(data.lyrics);
            if (isLrc) {
                lyricsSyncedJson = JSON.stringify(data.lyrics);
                lyricsUnsynced = null;
            } else {
                lyricsUnsynced = data.lyrics;
                lyricsSyncedJson = null;
            }
        }

        const updateSet: Record<string, unknown> = {
            updatedAt: Date.now(),
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
            updateSet.releaseDate = data.year != null ? String(data.year) : null;
        }
        if (data.genre !== undefined) updateSet.genre = data.genre;
        if (data.bpm !== undefined) updateSet.bpm = data.bpm;
        if (data.initialKey !== undefined) updateSet.initialKey = data.initialKey;
        if (data.comment !== undefined) {
            updateSet.comment = data.comment;
        } else if (data.description !== undefined) {
            updateSet.comment = data.description;
        }
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
        if (data.lyrics !== undefined) updateSet.lyrics = data.lyrics;
        if (lyricsUnsynced !== undefined) updateSet.lyricsUnsynced = lyricsUnsynced;
        if (lyricsSyncedJson !== undefined) updateSet.lyricsSyncedJson = lyricsSyncedJson;

        await db
            .update(canonicalAudioMetadata)
            .set(updateSet)
            .where(eq(canonicalAudioMetadata.fileId, id));

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
