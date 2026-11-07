import { NextRequest, NextResponse } from 'next/server';
import { and, eq, or, like, desc } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata } from '@/infrastructure/database/schema';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { type Track } from '@/domain/media/track';

interface RouteContext {
    params: Promise<{ slug?: string[] }>;
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Requested-With',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type, Retry-After',
};

function getBaseUrl(request: NextRequest): string {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    return `${protocol}://${host}`;
}

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
    return NextResponse.json(data, {
        status,
        headers: {
            ...CORS_HEADERS,
            ...extraHeaders,
        },
    });
}

function getAudioMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.flac':
            return 'audio/flac';
        case '.mp3':
            return 'audio/mpeg';
        case '.m4a':
        case '.mp4':
            return 'audio/mp4';
        case '.aac':
            return 'audio/aac';
        case '.wav':
            return 'audio/wav';
        case '.ogg':
            return 'audio/ogg';
        case '.opus':
            return 'audio/opus';
        default:
            return 'application/octet-stream';
    }
}

function streamAudioFile(request: NextRequest, filePath: string): Response {
    if (!fs.existsSync(filePath)) {
        return jsonResponse(
            {
                error: 'Audio file not found on disk',
                notice: {
                    level: 'error',
                    title: 'File Missing',
                    message: 'The requested audio file does not exist in the local library.',
                },
            },
            404
        );
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = getAudioMimeType(filePath);
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || start >= fileSize || (parts[1] && end >= fileSize) || start > end) {
            return new Response(null, {
                status: 416,
                headers: {
                    ...CORS_HEADERS,
                    'Content-Range': `bytes */${fileSize}`,
                },
            });
        }

        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = Readable.toWeb(nodeStream);

        return new Response(webStream as BodyInit, {
            status: 206,
            headers: {
                ...CORS_HEADERS,
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(chunkSize),
                'Content-Type': mimeType,
            },
        });
    }

    // Full file stream (HTTP 200)
    const nodeStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as BodyInit, {
        status: 200,
        headers: {
            ...CORS_HEADERS,
            'Content-Length': String(fileSize),
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType,
        },
    });
}

function mapTrackToEclipse(track: Track, baseUrl: string) {
    const rawFormat = (track.codec || track.extension.replace('.', '') || 'flac').toLowerCase();
    const isLossless = Boolean(track.lossless);
    const audioQuality = isLossless
        ? `${track.bitDepth || 16}-bit / ${(track.sampleRateHz || 44100) / 1000} kHz`
        : `${track.bitrateKbps || 320} kbps`;

    return {
        id: track.id,
        title: track.title || track.filename,
        artist: track.artist || 'Unknown Artist',
        album: track.album || undefined,
        duration: Math.round(track.durationSeconds || 0),
        artworkURL: `${baseUrl}/api/media/art/${track.id}`,
        isrc: track.isrc || undefined,
        format: rawFormat,
        audioQuality,
        streamURL: `${baseUrl}/api/eclipse/audio/${track.id}`,
    };
}

export async function OPTIONS(): Promise<Response> {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
    await ensureDatabaseInitialized();
    const { slug = [] } = await context.params;
    const baseUrl = getBaseUrl(request);
    const searchParams = request.nextUrl.searchParams;

    const action = slug[0] || 'manifest.json';
    const subId = slug[1] ? decodeURIComponent(slug[1]) : undefined;

    // 1. MANIFEST: GET /manifest.json or /api/eclipse
    if (action === 'manifest.json' || action === 'manifest' || slug.length === 0) {
        return jsonResponse({
            id: 'com.metatagstudio.eclipse',
            name: 'MetaTagStudio Music',
            version: '1.0.0',
            description: 'Streams high-resolution lossless audio directly from your local MetaTagStudio audio library',
            icon: `${baseUrl}/icon.png`,
            resources: ['search', 'stream', 'isrc', 'resolve', 'catalog', 'settings'],
            types: ['track', 'album', 'artist'],
            contentType: 'music',
            settings: [
                {
                    key: 'quality',
                    type: 'select',
                    label: 'Audio quality',
                    help: 'Preferred stream quality',
                    default: 'lossless',
                    options: [
                        { value: 'lossless', label: 'Lossless (Original / FLAC)' },
                        { value: 'high', label: 'High (320kbps)' },
                        { value: 'normal', label: 'Normal (160kbps)' },
                    ],
                },
            ],
            catalogs: [
                { id: 'all-tracks', type: 'track', name: 'All Library Tracks' },
                { id: 'lossless-tracks', type: 'track', name: 'Hi-Res & Lossless Collection' },
                { id: 'recent-tracks', type: 'track', name: 'Recently Added' },
            ],
        });
    }

    // 2. SEARCH: GET /search?q={query}
    if (action === 'search') {
        const query = (searchParams.get('q') || '').trim();

        let rows;
        if (!query || query === '*' || query === 'all') {
            rows = await db
                .select()
                .from(audioFiles)
                .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
                .where(eq(audioFiles.isMissing, false))
                .orderBy(desc(audioFiles.createdAt))
                .limit(50);
        } else {
            const pattern = `%${query}%`;
            rows = await db
                .select()
                .from(audioFiles)
                .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
                .where(
                    or(
                        like(canonicalAudioMetadata.title, pattern),
                        like(canonicalAudioMetadata.artist, pattern),
                        like(canonicalAudioMetadata.album, pattern),
                        like(canonicalAudioMetadata.isrc, pattern),
                        like(audioFiles.filename, pattern)
                    )
                )
                .limit(50);
        }

        const tracks = rows.map((r) => mapTrackToEclipse(buildTrackFromDb(r.audio_files, r.canonical_audio_metadata), baseUrl));

        // Group albums from tracks
        const albumMap = new Map<string, { id: string; title: string; artist: string; artworkURL: string; trackCount: number; year?: string }>();
        const artistMap = new Map<string, { id: string; name: string; artworkURL: string }>();

        for (const t of tracks) {
            if (t.album) {
                const existing = albumMap.get(t.album);
                if (existing) {
                    existing.trackCount++;
                } else {
                    albumMap.set(t.album, {
                        id: t.album,
                        title: t.album,
                        artist: t.artist,
                        artworkURL: t.artworkURL,
                        trackCount: 1,
                    });
                }
            }

            if (t.artist && !artistMap.has(t.artist)) {
                artistMap.set(t.artist, {
                    id: t.artist,
                    name: t.artist,
                    artworkURL: t.artworkURL,
                });
            }
        }

        return jsonResponse({
            tracks,
            albums: Array.from(albumMap.values()),
            artists: Array.from(artistMap.values()),
        });
    }

    // 3. STREAM RESOLUTION: GET /stream/{id}
    if (action === 'stream' && subId) {
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(audioFiles.id, subId))
            .limit(1);

        if (!rows.length) {
            return jsonResponse(
                {
                    error: 'Track not found',
                    notice: {
                        level: 'error',
                        title: 'Track Not Found',
                        message: 'Requested track was not found in your library.',
                    },
                },
                404
            );
        }

        const track = buildTrackFromDb(rows[0].audio_files, rows[0].canonical_audio_metadata);
        const format = (track.codec || track.extension.replace('.', '') || 'flac').toLowerCase();
        const isLossless = Boolean(track.lossless);
        const quality = isLossless
            ? `${track.bitDepth || 16}-bit / ${(track.sampleRateHz || 44100) / 1000} kHz`
            : `${track.bitrateKbps || 320} kbps`;

        return jsonResponse({
            url: `${baseUrl}/api/eclipse/audio/${track.id}`,
            format,
            quality,
            codec: (track.codec || 'flac').toLowerCase(),
            container: (track.extension.replace('.', '') || 'flac').toLowerCase(),
            manifest: 'none',
            sampleRate: track.sampleRateHz || 44100,
            bitDepth: track.bitDepth || (isLossless ? 16 : undefined),
        });
    }

    // 4. DIRECT AUDIO STREAMING: GET /audio/{id}
    if (action === 'audio' && subId) {
        const rows = await db
            .select()
            .from(audioFiles)
            .where(eq(audioFiles.id, subId))
            .limit(1);

        if (!rows.length) {
            return jsonResponse({ error: 'Audio file not found' }, 404);
        }

        return streamAudioFile(request, rows[0].path);
    }

    // 5. ISRC RESOLUTION: GET /resolve-isrc?isrc={isrc}
    if (action === 'resolve-isrc') {
        const isrc = searchParams.get('isrc')?.trim();
        if (!isrc) {
            return jsonResponse({ trackId: null, id: null });
        }

        const rows = await db
            .select({ id: audioFiles.id })
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(canonicalAudioMetadata.isrc, isrc))
            .limit(1);

        if (!rows.length) {
            return jsonResponse({ trackId: null, id: null });
        }

        return jsonResponse({
            trackId: rows[0].id,
            id: rows[0].id,
        });
    }

    // 6. IDENTITY RESOLVE: GET /resolve?isrc=...&title=...&artist=...&durationMs=...
    if (action === 'resolve') {
        const isrc = searchParams.get('isrc')?.trim();
        const title = searchParams.get('title')?.trim();
        const artist = searchParams.get('artist')?.trim();

        let matchedRow = null;

        // Try ISRC first
        if (isrc) {
            const isrcRows = await db
                .select()
                .from(audioFiles)
                .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
                .where(eq(canonicalAudioMetadata.isrc, isrc))
                .limit(1);
            if (isrcRows.length > 0) {
                matchedRow = isrcRows[0];
            }
        }

        // Fallback to title and artist
        if (!matchedRow && title && artist) {
            const textRows = await db
                .select()
                .from(audioFiles)
                .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
                .where(
                    or(
                        like(canonicalAudioMetadata.title, `%${title}%`),
                        like(canonicalAudioMetadata.artist, `%${artist}%`)
                    )
                )
                .limit(1);
            if (textRows.length > 0) {
                matchedRow = textRows[0];
            }
        }

        if (!matchedRow) {
            return jsonResponse({ item: null });
        }

        const track = buildTrackFromDb(matchedRow.audio_files, matchedRow.canonical_audio_metadata);
        return jsonResponse({
            item: {
                id: track.id,
                type: 'track',
                title: track.title || track.filename,
                artist: track.artist || 'Unknown Artist',
                album: track.album || undefined,
                durationMs: Math.round((track.durationSeconds || 0) * 1000),
                isrc: track.isrc || undefined,
                artworkURL: `${baseUrl}/api/media/art/${track.id}`,
                hiRes: Boolean((track.sampleRateHz && track.sampleRateHz > 48000) || (track.bitDepth && track.bitDepth > 16)),
            },
        });
    }

    // 7. ALBUM DETAILS: GET /album/{id}
    if (action === 'album' && subId) {
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(canonicalAudioMetadata.album, subId));

        if (!rows.length) {
            return jsonResponse({ error: 'Album not found' }, 404);
        }

        const tracks = rows.map((r) => mapTrackToEclipse(buildTrackFromDb(r.audio_files, r.canonical_audio_metadata), baseUrl));
        const first = tracks[0];

        return jsonResponse({
            id: subId,
            title: subId,
            artist: first.artist,
            artworkURL: first.artworkURL,
            trackCount: tracks.length,
            tracks,
        });
    }

    // 8. ARTIST DETAILS: GET /artist/{id}
    if (action === 'artist' && subId) {
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(canonicalAudioMetadata.artist, subId));

        if (!rows.length) {
            return jsonResponse({ error: 'Artist not found' }, 404);
        }

        const tracks = rows.map((r) => mapTrackToEclipse(buildTrackFromDb(r.audio_files, r.canonical_audio_metadata), baseUrl));
        const first = tracks[0];

        const albumsMap = new Map<string, { id: string; title: string; artist: string; artworkURL: string; trackCount: number }>();
        for (const t of tracks) {
            if (t.album && !albumsMap.has(t.album)) {
                albumsMap.set(t.album, {
                    id: t.album,
                    title: t.album,
                    artist: t.artist,
                    artworkURL: t.artworkURL,
                    trackCount: tracks.filter((x) => x.album === t.album).length,
                });
            }
        }

        return jsonResponse({
            id: subId,
            name: subId,
            artworkURL: first.artworkURL,
            topTracks: tracks.slice(0, 10),
            albums: Array.from(albumsMap.values()),
        });
    }

    // 9. CATALOGS: GET /catalog/{id}?skip=0
    if (action === 'catalog' && subId) {
        const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));
        const limit = 100;

        const whereClause =
            subId === 'lossless-tracks'
                ? and(eq(audioFiles.isMissing, false), eq(canonicalAudioMetadata.lossless, true))
                : eq(audioFiles.isMissing, false);

        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(whereClause)
            .orderBy(desc(audioFiles.createdAt))
            .offset(skip)
            .limit(limit);
        const items = rows.map((r) => {
            const t = buildTrackFromDb(r.audio_files, r.canonical_audio_metadata);
            return {
                id: t.id,
                type: 'track',
                title: t.title || t.filename,
                artist: t.artist || 'Unknown Artist',
                album: t.album || undefined,
                durationMs: Math.round((t.durationSeconds || 0) * 1000),
                isrc: t.isrc || undefined,
                artworkURL: `${baseUrl}/api/media/art/${t.id}`,
                hiRes: Boolean((t.sampleRateHz && t.sampleRateHz > 48000) || (t.bitDepth && t.bitDepth > 16)),
            };
        });

        return jsonResponse({ items });
    }

    return jsonResponse({ error: 'Endpoint not found', slug }, 404);
}
