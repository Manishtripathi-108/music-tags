import { NextRequest, NextResponse } from 'next/server';
import { inArray, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/db/init';
import { findDuplicates } from '@/core/duplicates/duplicateFinder';
import {
    type DuplicateFindApiResponse,
    type DuplicateMatchMode,
    type Track,
    ResolveDuplicatesRequestSchema,
} from '@/types/audio';
import fs from 'fs';

export async function GET(request: NextRequest) {
    try {
        await ensureDatabaseInitialized();

        const searchParams = request.nextUrl.searchParams;
        const mode = (searchParams.get('mode') as DuplicateMatchMode) || 'all';
        const similarityThreshold = parseFloat(searchParams.get('threshold') || '0.85');
        const durationToleranceSec = parseFloat(searchParams.get('durationTolerance') || '5');
        const folderPath = searchParams.get('folder') || undefined;

        // Fetch tracks from database with joined metadata
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId));

        const tracks: Track[] = rows.map(({ audio_files: file, canonical_audio_metadata: meta }) => {
            const rawLyrics = meta?.lyrics || meta?.lyricsUnsynced;
            const hasSynced = Boolean(meta?.lyricsSyncedJson) || (rawLyrics ? /\[\d{2}:\d{2}/.test(rawLyrics) : false);

            return {
                id: file.id,
                filename: file.filename,
                filePath: file.path,
                directory: file.directory,
                sizeBytes: file.sizeBytes,
                title: meta?.title ?? '',
                artist: meta?.artist ?? '',
                albumArtist: meta?.albumArtist ?? '',
                album: meta?.album ?? '',
                trackNumber: meta?.trackNumber ?? null,
                totalTracks: meta?.totalTracks ?? null,
                discNumber: meta?.discNumber ?? null,
                totalDiscs: meta?.totalDiscs ?? null,
                year: meta?.year ?? null,
                dateReleased: meta?.releaseDate ?? null,
                genre: meta?.genre ?? '',
                composer: meta?.composer ?? '',
                publisher: meta?.publisher ?? '',
                isrc: meta?.isrc ?? '',
                bpm: meta?.bpm ?? null,
                initialKey: meta?.initialKey ?? null,
                lyrics: meta?.lyrics ?? '',
                lyricsUnsynced: meta?.lyricsUnsynced ?? null,
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
                extension: file.extension,
                lossless: meta?.lossless ?? false,
                hasCoverArt: meta?.hasCoverArt ?? false,
                coverArtMime: meta?.coverArtMime ?? null,
                coverArtWidth: meta?.coverArtWidth ?? null,
                coverArtHeight: meta?.coverArtHeight ?? null,
                coverArtType: meta?.coverArtType ?? null,
                coverArtDescription: meta?.coverArtDescription ?? null,
            };
        });

        const clusters = findDuplicates(tracks, {
            mode,
            similarityThreshold,
            durationToleranceSec,
            folderPath,
        });

        const totalDuplicateTracks = clusters.reduce((acc, c) => acc + c.tracks.length, 0);

        const response: DuplicateFindApiResponse = {
            clusters,
            totalDuplicateTracks,
            totalClusters: clusters.length,
            mode,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error finding duplicates:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensureDatabaseInitialized();

        const body = await request.json();
        const parsed = ResolveDuplicatesRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { removeTrackIds, deleteFiles } = parsed.data;

        // Fetch file paths if physical deletion requested
        let deletedFilesCount = 0;
        if (deleteFiles) {
            const filesToDelete = await db
                .select({ path: audioFiles.path })
                .from(audioFiles)
                .where(inArray(audioFiles.id, removeTrackIds));

            for (const f of filesToDelete) {
                try {
                    if (fs.existsSync(f.path)) {
                        fs.unlinkSync(f.path);
                        deletedFilesCount++;
                    }
                } catch (err) {
                    console.error('Failed to delete file:', f.path, err);
                }
            }
        }

        // Remove from database
        await db.delete(canonicalAudioMetadata).where(inArray(canonicalAudioMetadata.fileId, removeTrackIds));
        await db.delete(rawAudioMetadata).where(inArray(rawAudioMetadata.fileId, removeTrackIds));
        await db.delete(audioFiles).where(inArray(audioFiles.id, removeTrackIds));

        return NextResponse.json({
            success: true,
            removedCount: removeTrackIds.length,
            deletedFilesCount,
            message: `Removed ${removeTrackIds.length} duplicate track(s) from database${
                deleteFiles ? ` and deleted ${deletedFilesCount} file(s)` : ''
            }`,
        });
    } catch (error) {
        console.error('Error resolving duplicates:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
