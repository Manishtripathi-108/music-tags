import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { audioFiles, canonicalAudioMetadata } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/db/init';
import { type Track, type TracksApiResponse, REGEX_LRC_TIMESTAMP } from '@/types/audio';

export async function GET(): Promise<NextResponse<TracksApiResponse>> {
    await ensureDatabaseInitialized();

    try {
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId));

        const tracks: Track[] = rows.map(({ audio_files: file, canonical_audio_metadata: meta }) => {
            const rawLyrics = meta?.lyrics || meta?.lyricsUnsynced || null;
            const hasSynced = Boolean(meta?.lyricsSyncedJson) || (rawLyrics ? REGEX_LRC_TIMESTAMP.test(rawLyrics) : false);
            const lyricsType: 'synced' | 'unsynced' | 'none' = hasSynced
                ? 'synced'
                : rawLyrics
                  ? 'unsynced'
                  : 'none';

            // Check if metadata was updated after initial scan
            const isModified = Boolean(
                meta?.updatedAt &&
                meta?.createdAt &&
                meta.updatedAt - meta.createdAt > 1000
            );

            return {
                id: file.id,
                filename: file.filename,
                filePath: file.path,
                directory: file.directory,
                isModified,
                extension: file.extension,
                title: meta?.title || file.filename.replace(/\.[^/.]+$/, ''),
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
                lyricsType,
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
        });

        return NextResponse.json({
            tracks,
            total: tracks.length,
        });
    } catch (error) {
        console.error('Error fetching tracks from database:', error);
        return NextResponse.json(
            { tracks: [], total: 0 },
            { status: 500 }
        );
    }
}
