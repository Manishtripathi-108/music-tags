import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata, remoteTrackMatches } from '@/infrastructure/database/schema';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { evaluateQualityComparison, getLocalTrackQuality, isDolbyAtmosAudio, parseQualityString } from '@/domain/remote-audio/quality-analyzer';
import { calculateMatchConfidence } from '@/domain/remote-audio/track-matcher';
import { type AudioComparisonItem, type RemoteStreamInfo, type RemoteTrackMatchRecord, type RemoteTrackSummary } from '@/domain/remote-audio/types';

interface UpdateMatchRequestBody {
    localTrackId: string;
    apiUrl: string;
    action: 'clear' | 'set_id' | 'select_candidate';
    customId?: string;
    candidate?: RemoteTrackSummary;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        await ensureDatabaseInitialized();
        const body: UpdateMatchRequestBody = await request.json();
        const { localTrackId, apiUrl, action, customId, candidate } = body;

        if (!localTrackId || !apiUrl || !action) {
            return NextResponse.json({ error: 'Missing localTrackId, apiUrl, or action' }, { status: 400 });
        }

        const normalizedApiUrl = apiUrl.replace(/\/+$/, '');

        // 1. Fetch local track
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, localTrackId))
            .where(eq(audioFiles.id, localTrackId))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json({ error: 'Local track not found' }, { status: 404 });
        }

        const localTrack = buildTrackFromDb(rows[0].audio_files, rows[0].canonical_audio_metadata);
        const localQuality = getLocalTrackQuality(localTrack);

        // Fetch existing match to preserve candidates
        const existingRecord = await db
            .select()
            .from(remoteTrackMatches)
            .where(and(eq(remoteTrackMatches.localTrackId, localTrackId), eq(remoteTrackMatches.providerUrl, normalizedApiUrl)))
            .limit(1);

        let preservedCandidates: RemoteTrackSummary[] = [];
        if (existingRecord[0]?.rawSearchJson) {
            try {
                const parsed = JSON.parse(existingRecord[0].rawSearchJson);
                if (Array.isArray(parsed?.candidates)) {
                    preservedCandidates = parsed.candidates;
                }
            } catch {}
        }

        // Action: CLEAR MATCH
        if (action === 'clear') {
            console.log(`[API:MATCH:CLEAR] Clearing match for local track "${localTrack.title || localTrack.filename}" (ID: ${localTrackId})`);
            await db
                .delete(remoteTrackMatches)
                .where(and(eq(remoteTrackMatches.localTrackId, localTrackId), eq(remoteTrackMatches.providerUrl, normalizedApiUrl)));

            const item: AudioComparisonItem = {
                localTrack,
                cachedMatch: null,
                remoteTrack: null,
                localQuality,
                remoteQuality: null,
                status: 'not_searched',
                statusMessage: 'Match removed. Ready to search or set ID.',
                isDolbyAvailable: false,
                canDownloadLossless: false,
                canDownloadDolby: false,
                candidates: preservedCandidates,
                confidence: 0,
            };

            return NextResponse.json({ success: true, item });
        }

        // Action: SELECT CANDIDATE
        if (action === 'select_candidate') {
            if (!candidate || !candidate.id) {
                return NextResponse.json({ error: 'Missing candidate data' }, { status: 400 });
            }

            console.log(`[API:MATCH:SELECT] User manually selected candidate ID ${candidate.id} ("${candidate.title}") for "${localTrack.title}"`);
            const isDolby = isDolbyAtmosAudio(candidate);
            const remoteQuality = parseQualityString(candidate.audioQuality, candidate.format);
            const now = new Date();
            const matchId = existingRecord.length ? existingRecord[0].id : randomUUID();
            const confidence = calculateMatchConfidence(localTrack, candidate);
            candidate.confidence = confidence;

            const recordValues = {
                id: matchId,
                localTrackId,
                providerUrl: normalizedApiUrl,
                remoteTrackId: String(candidate.id),
                title: candidate.title || null,
                artist: candidate.artist || null,
                album: candidate.album || null,
                duration: candidate.duration || null,
                artworkUrl: candidate.artworkURL || null,
                format: candidate.format || null,
                audioQuality: candidate.audioQuality || null,
                isDolby,
                hasDolby: isDolby,
                qualityScore: remoteQuality.score,
                matchConfidence: confidence,
                rawSearchJson: JSON.stringify({ selected: candidate, candidates: preservedCandidates }),
                downloadStatus: 'idle',
                downloadError: null,
                downloadPath: null,
                lastCheckedAt: now,
                updatedAt: now,
            };

            if (existingRecord.length) {
                await db.update(remoteTrackMatches).set(recordValues).where(eq(remoteTrackMatches.id, matchId));
            } else {
                await db.insert(remoteTrackMatches).values({ ...recordValues, createdAt: now });
            }

            const cachedRecord: RemoteTrackMatchRecord = {
                ...recordValues,
                streamUrl: null,
                rawStreamJson: null,
                downloadStatus: 'idle',
                downloadedAt: null,
            };

            const { status, statusMessage, canDownloadLossless, canDownloadDolby } = evaluateQualityComparison(
                localQuality,
                remoteQuality,
                isDolby
            );

            const item: AudioComparisonItem = {
                localTrack,
                cachedMatch: cachedRecord,
                remoteTrack: candidate,
                localQuality,
                remoteQuality,
                status,
                statusMessage,
                isDolbyAvailable: isDolby,
                canDownloadLossless,
                canDownloadDolby,
                candidates: preservedCandidates,
                confidence,
            };

            return NextResponse.json({ success: true, item });
        }

        // Action: SET MANUAL ID
        if (action === 'set_id') {
            const rawId = (customId || '').trim();
            if (!rawId) {
                return NextResponse.json({ error: 'Please enter a valid remote track ID' }, { status: 400 });
            }

            console.log(`[API:MATCH:SET_ID] Setting custom remote ID ${rawId} for "${localTrack.title || localTrack.filename}"`);

            // Try to resolve stream details from API to accurately capture format, sample rate, bit depth, and atmos
            let streamData: RemoteStreamInfo | null = null;
            try {
                const streamUrl = `${normalizedApiUrl}/stream/${encodeURIComponent(rawId)}?quality=max&atmos=auto`;
                const res = await fetch(streamUrl, {
                    headers: { 'User-Agent': 'MetaTagStudio/1.0', Accept: 'application/json' },
                });
                if (res.ok) {
                    streamData = await res.json();
                }
            } catch (err) {
                console.warn(`[API:MATCH:SET_ID] Could not pre-resolve stream for ID ${rawId}:`, err);
            }

            const isDolby = isDolbyAtmosAudio(null, streamData);
            const qualityTier = parseQualityString(streamData?.quality || 'Lossless', streamData?.format || streamData?.codec, streamData);
            const now = new Date();
            const matchId = existingRecord.length ? existingRecord[0].id : randomUUID();
            const confidence = 1.0; // User explicitly assigned this ID

            const customRemoteTrack: RemoteTrackSummary = {
                id: rawId,
                title: localTrack.title || `Track #${rawId}`,
                artist: localTrack.artist || undefined,
                album: localTrack.album || undefined,
                format: streamData?.format || streamData?.codec || undefined,
                audioQuality: streamData?.quality || (qualityTier.isLossless ? `${qualityTier.bitDepth || 16}-bit / ${(qualityTier.sampleRateHz || 44100) / 1000} kHz` : 'Lossy'),
                atmos: isDolby,
                confidence,
            };

            const recordValues = {
                id: matchId,
                localTrackId,
                providerUrl: normalizedApiUrl,
                remoteTrackId: rawId,
                title: customRemoteTrack.title,
                artist: customRemoteTrack.artist || null,
                album: customRemoteTrack.album || null,
                duration: localTrack.durationSeconds || null,
                artworkUrl: null,
                format: customRemoteTrack.format || null,
                audioQuality: customRemoteTrack.audioQuality || null,
                isDolby,
                hasDolby: isDolby,
                qualityScore: qualityTier.score,
                matchConfidence: confidence,
                streamUrl: streamData?.url || null,
                rawSearchJson: JSON.stringify({ selected: customRemoteTrack, candidates: preservedCandidates }),
                rawStreamJson: streamData ? JSON.stringify(streamData) : null,
                downloadStatus: 'idle',
                downloadError: null,
                downloadPath: null,
                lastCheckedAt: now,
                updatedAt: now,
            };

            if (existingRecord.length) {
                await db.update(remoteTrackMatches).set(recordValues).where(eq(remoteTrackMatches.id, matchId));
            } else {
                await db.insert(remoteTrackMatches).values({ ...recordValues, createdAt: now });
            }

            const cachedRecord: RemoteTrackMatchRecord = {
                ...recordValues,
                downloadStatus: 'idle',
                downloadedAt: null,
            };

            const { status, statusMessage, canDownloadLossless, canDownloadDolby } = evaluateQualityComparison(
                localQuality,
                qualityTier,
                isDolby
            );

            const item: AudioComparisonItem = {
                localTrack,
                cachedMatch: cachedRecord,
                remoteTrack: customRemoteTrack,
                localQuality,
                remoteQuality: qualityTier,
                status,
                statusMessage,
                isDolbyAvailable: isDolby,
                canDownloadLossless,
                canDownloadDolby,
                candidates: preservedCandidates,
                confidence,
            };

            return NextResponse.json({ success: true, item });
        }

        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    } catch (error) {
        console.error('Error updating track match:', error);
        return NextResponse.json({ error: 'Internal server error updating track match' }, { status: 500 });
    }
}
