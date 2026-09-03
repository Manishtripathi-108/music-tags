import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/db/init';
import {
    TrackPatchSchema,
    type Track,
    type RawTagItem,
    type TrackPatchApiResponse,
    REGEX_LRC_TIMESTAMP,
} from '@/types/audio';
import { getExifTool } from '@/core/binaries/exiftool';
import { probeAudioFile } from '@/core/binaries/ffprobe';
import { buildRawTagList } from '@/core/metadata/normalizer';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: NextRequest,
    context: RouteContext
): Promise<NextResponse<{ metadata: Track | null; rawTags: RawTagItem[] } | { error: string }>> {
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
        const rawLyrics = meta?.lyrics || meta?.lyricsUnsynced || null;
        const hasSynced = Boolean(meta?.lyricsSyncedJson) || (rawLyrics ? REGEX_LRC_TIMESTAMP.test(rawLyrics) : false);

        const isModified = Boolean(
            meta?.updatedAt &&
            meta?.createdAt &&
            meta.updatedAt - meta.createdAt > 1000
        );

        const track: Track = {
            id: file.id,
            filename: file.filename,
            filePath: file.path,
            directory: file.directory,
            isModified,
            extension: file.extension,
            title: meta?.title || file.filename,
            artist: meta?.artist ?? '',
            albumArtist: meta?.albumArtist ?? '',
            album: meta?.album ?? '',
            trackNumber: meta?.trackNumber ?? null,
            totalTracks: meta?.totalTracks ?? null,
            discNumber: meta?.discNumber ?? null,
            totalDiscs: meta?.totalDiscs ?? null,
            year: meta?.year ?? null,
            releaseDate: meta?.releaseDate ?? null,
            genre: meta?.genre ?? '',
            bpm: meta?.bpm ?? null,
            initialKey: meta?.initialKey ?? '',
            comment: meta?.comment ?? '',
            composer: meta?.composer ?? '',
            conductor: meta?.conductor ?? '',
            lyricist: meta?.lyricist ?? '',
            publisher: meta?.publisher ?? '',
            label: meta?.label ?? '',
            copyright: meta?.copyright ?? '',
            isrc: meta?.isrc ?? '',
            barcode: meta?.barcode ?? '',
            catalogNumber: meta?.catalogNumber ?? '',
            mood: meta?.mood ?? '',
            rating: meta?.rating ?? null,
            description: meta?.description ?? '',
            lyrics: meta?.lyrics ?? '',
            lyricsUnsynced: meta?.lyricsUnsynced ?? '',
            lyricsSyncedJson: meta?.lyricsSyncedJson ?? null,
            lyricsLanguage: meta?.lyricsLanguage ?? null,
            lyricsType: hasSynced ? 'synced' : rawLyrics ? 'unsynced' : 'none',
            durationSeconds: meta?.durationSeconds ?? undefined,
            bitrateKbps: meta?.bitrateKbps ?? undefined,
            sampleRateHz: meta?.sampleRateHz ?? undefined,
            channels: meta?.channels ?? undefined,
            channelLayout: meta?.channelLayout || undefined,
            bitDepth: meta?.bitDepth ?? undefined,
            codec: meta?.codec || undefined,
            lossless: meta?.lossless ?? false,
            hasCoverArt: meta?.hasCoverArt ?? false,
            coverArtMime: meta?.coverArtMime ?? null,
            coverArtWidth: meta?.coverArtWidth ?? null,
            coverArtHeight: meta?.coverArtHeight ?? null,
            coverArtType: meta?.coverArtType ?? null,
            coverArtDescription: meta?.coverArtDescription ?? null,
        };

        const rawRows = await db
            .select()
            .from(rawAudioMetadata)
            .where(eq(rawAudioMetadata.fileId, id))
            .limit(1);

        let exifObj: Record<string, unknown> | null = null;
        let probeObj: any = null;

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
            const isLrc = data.lyrics ? REGEX_LRC_TIMESTAMP.test(data.lyrics) : false;
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
        if (data.year !== undefined) updateSet.year = data.year;
        if (data.releaseDate !== undefined) updateSet.releaseDate = data.releaseDate;
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
        if (data.description !== undefined) updateSet.description = data.description;
        if (data.lyrics !== undefined) updateSet.lyrics = data.lyrics;
        if (lyricsUnsynced !== undefined) updateSet.lyricsUnsynced = lyricsUnsynced;
        if (lyricsSyncedJson !== undefined) updateSet.lyricsSyncedJson = lyricsSyncedJson;

        await db
            .update(canonicalAudioMetadata)
            .set(updateSet)
            .where(eq(canonicalAudioMetadata.fileId, id));

        // Fetch and return the updated track
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
        const rawLyrics = meta?.lyrics || meta?.lyricsUnsynced || null;
        const hasSynced = Boolean(meta?.lyricsSyncedJson) || (rawLyrics ? REGEX_LRC_TIMESTAMP.test(rawLyrics) : false);

        const updatedTrack: Track = {
            id: file.id,
            filename: file.filename,
            filePath: file.path,
            directory: file.directory,
            isModified: true,
            extension: file.extension,
            title: meta?.title || file.filename,
            artist: meta?.artist ?? '',
            albumArtist: meta?.albumArtist ?? '',
            album: meta?.album ?? '',
            trackNumber: meta?.trackNumber ?? null,
            totalTracks: meta?.totalTracks ?? null,
            discNumber: meta?.discNumber ?? null,
            totalDiscs: meta?.totalDiscs ?? null,
            year: meta?.year ?? null,
            releaseDate: meta?.releaseDate ?? null,
            genre: meta?.genre ?? '',
            bpm: meta?.bpm ?? null,
            initialKey: meta?.initialKey ?? '',
            comment: meta?.comment ?? '',
            composer: meta?.composer ?? '',
            conductor: meta?.conductor ?? '',
            lyricist: meta?.lyricist ?? '',
            publisher: meta?.publisher ?? '',
            label: meta?.label ?? '',
            copyright: meta?.copyright ?? '',
            isrc: meta?.isrc ?? '',
            barcode: meta?.barcode ?? '',
            catalogNumber: meta?.catalogNumber ?? '',
            mood: meta?.mood ?? '',
            rating: meta?.rating ?? null,
            description: meta?.description ?? '',
            lyrics: meta?.lyrics ?? '',
            lyricsUnsynced: meta?.lyricsUnsynced ?? '',
            lyricsSyncedJson: meta?.lyricsSyncedJson ?? null,
            lyricsLanguage: meta?.lyricsLanguage ?? null,
            lyricsType: hasSynced ? 'synced' : rawLyrics ? 'unsynced' : 'none',
            durationSeconds: meta?.durationSeconds ?? undefined,
            bitrateKbps: meta?.bitrateKbps ?? undefined,
            sampleRateHz: meta?.sampleRateHz ?? undefined,
            channels: meta?.channels ?? undefined,
            channelLayout: meta?.channelLayout || undefined,
            bitDepth: meta?.bitDepth ?? undefined,
            codec: meta?.codec || undefined,
            lossless: meta?.lossless ?? false,
            hasCoverArt: meta?.hasCoverArt ?? false,
            coverArtMime: meta?.coverArtMime ?? null,
            coverArtWidth: meta?.coverArtWidth ?? null,
            coverArtHeight: meta?.coverArtHeight ?? null,
            coverArtType: meta?.coverArtType ?? null,
            coverArtDescription: meta?.coverArtDescription ?? null,
        };

        return NextResponse.json({ success: true, track: updatedTrack });
    } catch (error) {
        console.error('Error updating track tags:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
