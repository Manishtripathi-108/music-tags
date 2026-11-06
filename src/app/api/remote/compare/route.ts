import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata, remoteTrackMatches } from '@/infrastructure/database/schema';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { evaluateQualityComparison, getLocalTrackQuality, parseQualityString } from '@/domain/remote-audio/quality-analyzer';
import { type AudioComparisonItem, type RemoteTrackMatchRecord, type RemoteTrackSummary } from '@/domain/remote-audio/types';

export async function GET(): Promise<NextResponse<{ items: AudioComparisonItem[]; count: number } | { error: string }>> {
    try {
        await ensureDatabaseInitialized();

        // 1. Fetch all local tracks with canonical metadata
        const fileRows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId));

        // 2. Fetch all cached remote matches
        const matchRows = await db.select().from(remoteTrackMatches);
        const matchMap = new Map<string, typeof matchRows[0]>();
        for (const m of matchRows) {
            matchMap.set(m.localTrackId, m);
        }

        // 3. Assemble comparison items
        const items: AudioComparisonItem[] = fileRows.map((row) => {
            const track = buildTrackFromDb(row.audio_files, row.canonical_audio_metadata);
            const cached = matchMap.get(track.id) || null;

            const localQuality = getLocalTrackQuality(track);

            let remoteTrack: RemoteTrackSummary | null = null;
            let cachedRecord: RemoteTrackMatchRecord | null = null;

            if (cached) {
                cachedRecord = {
                    id: cached.id,
                    localTrackId: cached.localTrackId,
                    providerUrl: cached.providerUrl,
                    remoteTrackId: cached.remoteTrackId,
                    title: cached.title,
                    artist: cached.artist,
                    album: cached.album,
                    duration: cached.duration,
                    artworkUrl: cached.artworkUrl,
                    format: cached.format,
                    audioQuality: cached.audioQuality,
                    isDolby: Boolean(cached.isDolby),
                    hasDolby: Boolean(cached.hasDolby),
                    qualityScore: cached.qualityScore,
                    streamUrl: cached.streamUrl,
                    rawSearchJson: cached.rawSearchJson,
                    rawStreamJson: cached.rawStreamJson,
                    downloadStatus: (cached.downloadStatus as 'idle' | 'downloading' | 'completed' | 'failed') || 'idle',
                    downloadError: cached.downloadError,
                    downloadPath: cached.downloadPath,
                    downloadedAt: cached.downloadedAt,
                    lastCheckedAt: cached.lastCheckedAt,
                };

                remoteTrack = {
                    id: cached.remoteTrackId,
                    title: cached.title || '',
                    artist: cached.artist || undefined,
                    album: cached.album || undefined,
                    duration: cached.duration || undefined,
                    artworkURL: cached.artworkUrl || undefined,
                    format: cached.format || undefined,
                    audioQuality: cached.audioQuality || undefined,
                    atmos: Boolean(cached.isDolby),
                };
            }

            const remoteQuality = remoteTrack ? parseQualityString(remoteTrack.audioQuality, remoteTrack.format) : null;
            const hasDolby = cached ? Boolean(cached.hasDolby || cached.isDolby) : false;

            let candidates: RemoteTrackSummary[] = [];
            if (cached?.rawSearchJson) {
                try {
                    const parsedJson = JSON.parse(cached.rawSearchJson);
                    if (Array.isArray(parsedJson?.candidates)) {
                        candidates = parsedJson.candidates;
                    }
                } catch {}
            }

            const { status, statusMessage, canDownloadLossless, canDownloadDolby } = evaluateQualityComparison(
                localQuality,
                remoteQuality,
                hasDolby
            );

            return {
                localTrack: track,
                cachedMatch: cachedRecord,
                remoteTrack,
                localQuality,
                remoteQuality,
                status,
                statusMessage,
                isDolbyAvailable: hasDolby,
                canDownloadLossless,
                canDownloadDolby,
                candidates,
            };
        });

        return NextResponse.json({ items, count: items.length });
    } catch (error) {
        console.error('Error fetching remote comparison data:', error);
        return NextResponse.json({ error: 'Failed to fetch comparison data' }, { status: 500 });
    }
}
