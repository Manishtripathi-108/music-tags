import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata, remoteTrackMatches } from '@/infrastructure/database/schema';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { evaluateQualityComparison, getLocalTrackQuality, isDolbyAtmosAudio, parseQualityString } from '@/domain/remote-audio/quality-analyzer';
import { selectBestTrackMatch } from '@/domain/remote-audio/track-matcher';
import { type AudioComparisonItem, type RemoteTrackMatchRecord, type RemoteTrackSummary } from '@/domain/remote-audio/types';

interface SearchTrackRequestBody {
    trackId: string;
    apiUrl: string;
    quality?: string;
    atmos?: string;
    customParams?: Record<string, string>;
    customHeaders?: Record<string, string>;
    forceRefetch?: boolean;
    preferDolby?: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        await ensureDatabaseInitialized();
        const body: SearchTrackRequestBody = await request.json();

        const {
            trackId,
            apiUrl,
            quality = 'max',
            atmos = 'auto',
            customParams = {},
            customHeaders = {},
            forceRefetch = false,
            preferDolby = false,
        } = body;

        if (!trackId || !apiUrl) {
            return NextResponse.json({ error: 'Missing trackId or apiUrl' }, { status: 400 });
        }

        const normalizedApiUrl = apiUrl.replace(/\/+$/, '');

        // 1. Fetch local track from database
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(audioFiles.id, trackId))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json({ error: 'Local track not found' }, { status: 404 });
        }

        const localTrack = buildTrackFromDb(rows[0].audio_files, rows[0].canonical_audio_metadata);
        const localQuality = getLocalTrackQuality(localTrack);

        // 2. Check cache first unless forceRefetch is true ("store the ids of tracks never fetch again unless specified")
        if (!forceRefetch) {
            const cachedMatches = await db
                .select()
                .from(remoteTrackMatches)
                .where(and(eq(remoteTrackMatches.localTrackId, trackId), eq(remoteTrackMatches.providerUrl, normalizedApiUrl)))
                .limit(1);

            if (cachedMatches.length > 0) {
                const cached = cachedMatches[0];
                const cachedRecord: RemoteTrackMatchRecord = {
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

                const remoteTrack: RemoteTrackSummary = {
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

                const remoteQuality = parseQualityString(remoteTrack.audioQuality, remoteTrack.format);
                const hasDolby = Boolean(cached.hasDolby || cached.isDolby);

                const { status, statusMessage, canDownloadLossless, canDownloadDolby } = evaluateQualityComparison(
                    localQuality,
                    remoteQuality,
                    hasDolby
                );

                const item: AudioComparisonItem = {
                    localTrack,
                    cachedMatch: cachedRecord,
                    remoteTrack,
                    localQuality,
                    remoteQuality,
                    status,
                    statusMessage,
                    isDolbyAvailable: hasDolby,
                    canDownloadLossless,
                    canDownloadDolby,
                };

                return NextResponse.json({ item, cached: true });
            }
        }

        // 3. Construct search query text from local track
        const queryTerms = [localTrack.title, localTrack.artist].filter(Boolean).join(' ');
        const searchQuery = queryTerms.trim() || localTrack.filename.replace(/\.[^/.]+$/, '');

        // 4. Build remote URL
        const searchUrl = new URL(`${normalizedApiUrl}/search`);
        searchUrl.searchParams.set('q', searchQuery);
        if (quality) searchUrl.searchParams.set('quality', quality);
        if (atmos) searchUrl.searchParams.set('atmos', atmos);

        for (const [key, val] of Object.entries(customParams)) {
            if (val) searchUrl.searchParams.set(key, val);
        }

        // 5. Execute request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        let remoteData: { tracks?: RemoteTrackSummary[] } = { tracks: [] };
        try {
            const res = await fetch(searchUrl.toString(), {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'MetaTagStudio/1.0',
                    ...customHeaders,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                return NextResponse.json(
                    { error: `Remote search returned HTTP ${res.status}: ${res.statusText}` },
                    { status: 502 }
                );
            }

            remoteData = await res.json();
        } catch (fetchErr: unknown) {
            clearTimeout(timeoutId);
            const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error';
            return NextResponse.json({ error: `Search request failed: ${msg}` }, { status: 502 });
        }

        const candidates = Array.isArray(remoteData.tracks) ? remoteData.tracks : [];
        const matchResult = selectBestTrackMatch(localTrack, candidates, preferDolby);
        const bestMatch = matchResult.bestMatch;

        if (!bestMatch) {
            // No matching candidate found
            const item: AudioComparisonItem = {
                localTrack,
                cachedMatch: null,
                remoteTrack: null,
                localQuality,
                remoteQuality: null,
                status: 'no_match',
                statusMessage: 'No matching track found in remote catalogue',
                isDolbyAvailable: false,
                canDownloadLossless: false,
                canDownloadDolby: false,
            };
            return NextResponse.json({ item, cached: false });
        }

        const isDolby = isDolbyAtmosAudio(bestMatch);
        const hasDolby = matchResult.hasDolby || isDolby;
        const remoteQuality = parseQualityString(bestMatch.audioQuality, bestMatch.format);
        const now = new Date();

        // 6. Persist match in database
        const existingRecord = await db
            .select()
            .from(remoteTrackMatches)
            .where(and(eq(remoteTrackMatches.localTrackId, trackId), eq(remoteTrackMatches.providerUrl, normalizedApiUrl)))
            .limit(1);

        const matchId = existingRecord.length ? existingRecord[0].id : randomUUID();

        const recordValues = {
            id: matchId,
            localTrackId: trackId,
            providerUrl: normalizedApiUrl,
            remoteTrackId: String(bestMatch.id),
            title: bestMatch.title || null,
            artist: bestMatch.artist || null,
            album: bestMatch.album || null,
            duration: bestMatch.duration || null,
            artworkUrl: bestMatch.artworkURL || null,
            format: bestMatch.format || null,
            audioQuality: bestMatch.audioQuality || null,
            isDolby,
            hasDolby,
            qualityScore: remoteQuality.score,
            rawSearchJson: JSON.stringify(bestMatch),
            lastCheckedAt: now,
            updatedAt: now,
        };

        if (existingRecord.length) {
            await db.update(remoteTrackMatches).set(recordValues).where(eq(remoteTrackMatches.id, matchId));
        } else {
            await db.insert(remoteTrackMatches).values({
                ...recordValues,
                downloadStatus: 'idle',
                createdAt: now,
            });
        }

        const cachedRecord: RemoteTrackMatchRecord = {
            id: matchId,
            localTrackId: trackId,
            providerUrl: normalizedApiUrl,
            remoteTrackId: String(bestMatch.id),
            title: bestMatch.title || null,
            artist: bestMatch.artist || null,
            album: bestMatch.album || null,
            duration: bestMatch.duration || null,
            artworkUrl: bestMatch.artworkURL || null,
            format: bestMatch.format || null,
            audioQuality: bestMatch.audioQuality || null,
            isDolby,
            hasDolby,
            qualityScore: remoteQuality.score,
            streamUrl: null,
            rawSearchJson: JSON.stringify(bestMatch),
            rawStreamJson: null,
            downloadStatus: 'idle',
            downloadError: null,
            downloadPath: null,
            downloadedAt: null,
            lastCheckedAt: now,
        };

        const { status, statusMessage, canDownloadLossless, canDownloadDolby } = evaluateQualityComparison(
            localQuality,
            remoteQuality,
            hasDolby
        );

        const item: AudioComparisonItem = {
            localTrack,
            cachedMatch: cachedRecord,
            remoteTrack: bestMatch,
            localQuality,
            remoteQuality,
            status,
            statusMessage,
            isDolbyAvailable: hasDolby,
            canDownloadLossless,
            canDownloadDolby,
        };

        return NextResponse.json({ item, cached: false });
    } catch (error) {
        console.error('Error in remote track search:', error);
        return NextResponse.json({ error: 'Internal server error while searching track' }, { status: 500 });
    }
}
