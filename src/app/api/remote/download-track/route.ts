import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata, remoteTrackMatches } from '@/infrastructure/database/schema';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { isDolbyAtmosAudio, parseQualityString } from '@/domain/remote-audio/quality-analyzer';
import { type RemoteStreamInfo, type RemoteTrackSummary } from '@/domain/remote-audio/types';

interface DownloadTrackRequestBody {
    trackId: string;
    remoteTrackId: string;
    apiUrl: string;
    downloadDirectory: string;
    mode: 'highest_lossless' | 'dolby_atmos';
    quality?: string;
    atmos?: string;
    removeExisting?: boolean;
}

function resolveExtension(stream: RemoteStreamInfo, fallbackFormat?: string): string {
    const rawFormat = (stream.format || stream.container || stream.codec || fallbackFormat || '').toLowerCase();

    if (rawFormat.includes('flac')) return 'flac';
    if (rawFormat.includes('alac') || rawFormat.includes('m4a') || rawFormat.includes('aac')) return 'm4a';
    if (rawFormat.includes('mp3')) return 'mp3';
    if (rawFormat.includes('wav')) return 'wav';
    if (rawFormat.includes('dash') || rawFormat.includes('mp4') || rawFormat.includes('eac3')) return 'mp4';

    try {
        const pathname = new URL(stream.url).pathname;
        const match = pathname.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
        if (match) return match[1].toLowerCase();
    } catch {}

    return 'flac';
}

function sanitizeFilename(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        await ensureDatabaseInitialized();
        const body: DownloadTrackRequestBody = await request.json();
        const { trackId, remoteTrackId, apiUrl, downloadDirectory, mode, quality = 'max', atmos = 'auto' } = body;

        if (!trackId || !remoteTrackId || !apiUrl || !downloadDirectory) {
            return NextResponse.json({ error: 'Missing required parameters (trackId, remoteTrackId, apiUrl, downloadDirectory)' }, { status: 400 });
        }

        const normalizedApiUrl = apiUrl.replace(/\/+$/, '');

        // 1. Fetch local track to get ISRC and metadata
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, trackId))
            .where(eq(audioFiles.id, trackId))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json({ error: 'Local track not found in database' }, { status: 404 });
        }

        const localTrack = buildTrackFromDb(rows[0].audio_files, rows[0].canonical_audio_metadata);
        console.log(`\n[API:DOWNLOAD:START] Mode: "${mode}" | Track: "${localTrack.title || localTrack.filename}" (ID: ${trackId})`);

        // 2. Fetch cached remote match record if available
        const matchRows = await db
            .select()
            .from(remoteTrackMatches)
            .where(and(eq(remoteTrackMatches.localTrackId, trackId), eq(remoteTrackMatches.providerUrl, normalizedApiUrl)))
            .limit(1);

        const cachedMatch = matchRows[0] || null;
        let remoteTrackSummary: RemoteTrackSummary | null = null;
        if (cachedMatch?.rawSearchJson) {
            try {
                remoteTrackSummary = JSON.parse(cachedMatch.rawSearchJson);
            } catch {}
        }

        // 3. Resolve the stream URL from API (/stream/:id)
        const streamUrl = new URL(`${normalizedApiUrl}/stream/${encodeURIComponent(remoteTrackId)}`);
        const streamQualityParam = mode === 'highest_lossless' ? (quality || 'max') : (quality || 'max');
        const streamAtmosParam = mode === 'dolby_atmos' ? 'auto' : 'none';

        streamUrl.searchParams.set('quality', streamQualityParam);
        streamUrl.searchParams.set('atmos', streamAtmosParam);
        console.log(`[API:DOWNLOAD:RESOLVE] Resolving stream from: ${streamUrl.toString()}`);

        let streamData: RemoteStreamInfo;
        try {
            const streamRes = await fetch(streamUrl.toString(), {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'MetaTagStudio/1.0',
                },
            });

            if (!streamRes.ok) {
                return NextResponse.json(
                    { error: `Stream resolution failed: HTTP ${streamRes.status} ${streamRes.statusText}` },
                    { status: 502 }
                );
            }

            streamData = await streamRes.json();
        } catch (streamErr: unknown) {
            const msg = streamErr instanceof Error ? streamErr.message : 'Network error';
            return NextResponse.json({ error: `Failed to reach stream endpoint: ${msg}` }, { status: 502 });
        }

        if (!streamData.url) {
            return NextResponse.json({ error: streamData.error || 'Stream endpoint returned no playable URL' }, { status: 404 });
        }

        // 4. Enforce strict isolation rules:
        // "never download dolby if it not not selected and nevr download non dolby if dolby is selected"
        const isDolby = isDolbyAtmosAudio(remoteTrackSummary, streamData);
        const qualityTier = parseQualityString(streamData.quality || remoteTrackSummary?.audioQuality, streamData.codec || streamData.format, streamData);

        if (mode === 'highest_lossless') {
            if (isDolby) {
                return NextResponse.json(
                    {
                        error: "Strict mode violation: Dolby Atmos detected. In 'Highest Lossless' mode, Dolby tracks are strictly prohibited.",
                        mode,
                        isDolby: true,
                    },
                    { status: 422 }
                );
            }
            if (!qualityTier.isLossless) {
                return NextResponse.json(
                    {
                        error: "Strict mode violation: Lossy stream detected. In 'Highest Lossless' mode, only lossless files can be downloaded.",
                        mode,
                        qualityTier,
                    },
                    { status: 422 }
                );
            }
        } else if (mode === 'dolby_atmos') {
            if (!isDolby) {
                return NextResponse.json(
                    {
                        error: "Strict mode violation: Non-Dolby stereo stream detected. In 'Dolby Atmos' mode, non-Dolby tracks are strictly prohibited.",
                        mode,
                        isDolby: false,
                    },
                    { status: 422 }
                );
            }
        }

        // 5. Naming convention:
        // "dont add metadata just name the file with its isrc and extension."
        const rawIsrc = localTrack.isrc || cachedMatch?.remoteTrackId || trackId;
        const baseName = sanitizeFilename(rawIsrc);
        const extension = resolveExtension(streamData, remoteTrackSummary?.format);
        const fileName = `${baseName}.${extension}`;

        // Ensure directory exists
        const targetDir = path.resolve(downloadDirectory);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const destinationPath = path.join(/*turbopackIgnore: true*/ targetDir, fileName);
        const tempPath = path.join(/*turbopackIgnore: true*/ targetDir, `${fileName}.part`);
        console.log(`[API:DOWNLOAD:DEST] Output file: "${destinationPath}" (ISRC: ${rawIsrc})`);

        // Mark downloading in database
        if (cachedMatch) {
            await db
                .update(remoteTrackMatches)
                .set({
                    downloadStatus: 'downloading',
                    downloadError: null,
                    updatedAt: new Date(),
                })
                .where(eq(remoteTrackMatches.id, cachedMatch.id));
        }

        // 6. Download audio stream
        try {
            console.log(`[API:DOWNLOAD:STREAMING] Initiating HTTP stream from: ${streamData.url}`);
            const mediaResponse = await fetch(streamData.url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'MetaTagStudio/1.0',
                },
            });

            if (!mediaResponse.ok || !mediaResponse.body) {
                throw new Error(`Media stream download failed with HTTP ${mediaResponse.status}: ${mediaResponse.statusText}`);
            }

            const nodeReadableStream = Readable.fromWeb(mediaResponse.body as import('stream/web').ReadableStream);
            const fileWriteStream = fs.createWriteStream(tempPath);

            await pipeline(nodeReadableStream, fileWriteStream);

            // Verify file size
            const stats = fs.statSync(tempPath);
            if (stats.size < 1024) {
                throw new Error(`Downloaded file is corrupted or too small (${stats.size} bytes)`);
            }

            // 1. If remote track ID was changed, remove the previous file from disk
            if (cachedMatch?.previousDownloadPath && fs.existsSync(/*turbopackIgnore: true*/ cachedMatch.previousDownloadPath)) {
                console.log(`[API:DOWNLOAD:CLEANUP] Track ID was updated. Removing previous downloaded file: "${cachedMatch.previousDownloadPath}"`);
                try {
                    fs.unlinkSync(cachedMatch.previousDownloadPath);
                } catch (cleanupErr) {
                    console.warn(`[API:DOWNLOAD:CLEANUP] Could not remove previous file:`, cleanupErr);
                }
            }

            // 2. If cached downloadPath exists and differs from destinationPath, remove old file
            if (
                cachedMatch?.downloadPath &&
                cachedMatch.downloadPath !== destinationPath &&
                fs.existsSync(/*turbopackIgnore: true*/ cachedMatch.downloadPath)
            ) {
                console.log(`[API:DOWNLOAD:CLEANUP] Removing stale downloaded file: "${cachedMatch.downloadPath}"`);
                try {
                    fs.unlinkSync(cachedMatch.downloadPath);
                } catch (cleanupErr) {
                    console.warn(`[API:DOWNLOAD:CLEANUP] Could not remove stale file:`, cleanupErr);
                }
            }

            // 3. Remove any other format variants of the same track in targetDir (e.g. old .mp3 vs new .flac)
            const commonAudioExts = ['flac', 'm4a', 'mp3', 'wav', 'mp4', 'aac', 'alac', 'ogg'];
            for (const ext of commonAudioExts) {
                if (ext !== extension) {
                    const altFilePath = path.join(/*turbopackIgnore: true*/ targetDir, `${baseName}.${ext}`);
                    if (fs.existsSync(/*turbopackIgnore: true*/ altFilePath)) {
                        console.log(`[API:DOWNLOAD:CLEANUP] Removing alternate format file: "${altFilePath}"`);
                        try {
                            fs.unlinkSync(altFilePath);
                        } catch {}
                    }
                }
            }

            // 4. Atomic rename from temp to destination (overwrite existing if present)
            if (fs.existsSync(/*turbopackIgnore: true*/ destinationPath)) {
                fs.unlinkSync(destinationPath);
            }
            fs.renameSync(tempPath, destinationPath);
            console.log(`[API:DOWNLOAD:SUCCESS] Download finished! Saved ${(stats.size / (1024 * 1024)).toFixed(2)} MB -> "${destinationPath}"`);

            const now = new Date();
            // Update database with success
            if (cachedMatch) {
                await db
                    .update(remoteTrackMatches)
                    .set({
                        downloadStatus: 'completed',
                        downloadError: null,
                        downloadPath: destinationPath,
                        previousDownloadPath: null, // Clear previous path upon successful download
                        streamUrl: streamData.url,
                        rawStreamJson: JSON.stringify(streamData),
                        downloadedAt: now,
                        updatedAt: now,
                    })
                    .where(eq(remoteTrackMatches.id, cachedMatch.id));
            }

            return NextResponse.json({
                success: true,
                filePath: destinationPath,
                fileName,
                fileSizeBytes: stats.size,
                isrc: rawIsrc,
                mode,
                audioQuality: qualityTier.label,
                isDolby,
            });
        } catch (downloadErr: unknown) {
            // Clean up partial file
            if (fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch {}
            }

            const errorMsg = downloadErr instanceof Error ? downloadErr.message : 'Unknown download error';
            if (cachedMatch) {
                await db
                    .update(remoteTrackMatches)
                    .set({
                        downloadStatus: 'failed',
                        downloadError: errorMsg,
                        updatedAt: new Date(),
                    })
                    .where(eq(remoteTrackMatches.id, cachedMatch.id));
            }

            return NextResponse.json({ error: `Download failed: ${errorMsg}` }, { status: 500 });
        }
    } catch (error) {
        console.error('Error handling download request:', error);
        return NextResponse.json({ error: 'Internal server error while processing download' }, { status: 500 });
    }
}
