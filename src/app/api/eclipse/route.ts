import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export interface EclipseManifestSetting {
    key: string;
    type: 'select' | 'toggle' | 'text' | 'number';
    label: string;
    help?: string;
    default?: string | number | boolean;
    perNetwork?: boolean;
    options?: { value: string; label: string }[];
    maxLength?: number;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
}

export interface EclipseCatalogDeclaration {
    id: string;
    type: 'track' | 'album' | 'artist' | 'playlist';
    name: string;
}

export interface EclipseManifest {
    id: string;
    name: string;
    version: string;
    description?: string;
    icon?: string;
    resources: string[];
    types?: string[];
    contentType?: 'music' | 'audiobook' | 'podcast';
    settings?: EclipseManifestSetting[];
    catalogs?: EclipseCatalogDeclaration[];
}

export interface EclipseTrack {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    artworkURL?: string;
    isrc?: string;
    format?: string;
    streamURL?: string;
    audioQuality?: string;
}

export interface EclipseAlbum {
    id: string;
    title: string;
    artist?: string;
    artworkURL?: string;
    trackCount?: number;
    year?: string;
    description?: string;
    tracks?: EclipseTrack[];
}

export interface EclipseArtist {
    id: string;
    name: string;
    artworkURL?: string;
    bio?: string;
    genres?: string[];
    topTracks?: EclipseTrack[];
    albums?: EclipseAlbum[];
}

export interface EclipsePlaylist {
    id: string;
    title: string;
    creator?: string;
    description?: string;
    artworkURL?: string;
    trackCount?: number;
    tracks?: EclipseTrack[];
}

export interface EclipseNotice {
    level?: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message: string;
    id?: string;
    progress?: number;
    duration?: number;
}

export interface EclipseStreamResponse {
    url: string;
    format?: string;
    quality?: string;
    codec?: string;
    container?: string;
    manifest?: string;
    sampleRate?: number;
    bitDepth?: number;
    expiresAt?: number;
    chapters?: { title: string; startTime: number }[];
    video?: {
        url?: string;
        mimeType?: string;
        muxed?: boolean;
        width?: number;
        height?: number;
        renditions?: { url: string; height: number; mimeType?: string }[];
    };
    notice?: EclipseNotice;
}

function sanitizeFilename(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function buildUrlWithSettings(baseUrl: string, endpointPath: string, settings?: Record<string, string | number | boolean>): URL {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const cleanEndpoint = endpointPath.replace(/^\/+/, '');
    const fullUrl = new URL(`${normalizedBase}/${cleanEndpoint}`);

    if (settings) {
        for (const [key, val] of Object.entries(settings)) {
            if (val !== undefined && val !== null && val !== '') {
                fullUrl.searchParams.set(key, String(val));
            }
        }
    }
    return fullUrl;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const {
            addonUrl,
            action,
            query,
            id,
            isrc,
            title,
            artist,
            durationMs,
            skip = 0,
            settings,
            downloadDirectory,
            trackFilename,
        } = body;

        if (!addonUrl) {
            return NextResponse.json({ error: 'Missing required parameter: addonUrl' }, { status: 400 });
        }

        const normalizedAddonUrl = addonUrl.replace(/\/+$/, '');

        // 1. MANIFEST: GET /manifest.json
        if (action === 'manifest') {
            const manifestUrl = `${normalizedAddonUrl}/manifest.json`;
            const res = await fetch(manifestUrl, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                return NextResponse.json(
                    { error: `Addon returned HTTP ${res.status}: ${res.statusText} for manifest.json` },
                    { status: res.status }
                );
            }

            const manifest: EclipseManifest = await res.json();
            return NextResponse.json({ manifest, notice: (manifest as any).notice || null });
        }

        // 2. SEARCH: GET /search?q={query}&{settings}
        if (action === 'search') {
            const searchUrl = buildUrlWithSettings(normalizedAddonUrl, 'search', settings);
            searchUrl.searchParams.set('q', query || '');

            const res = await fetch(searchUrl.toString(), {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                return NextResponse.json(
                    { error: `Search request failed with HTTP ${res.status}: ${res.statusText}` },
                    { status: res.status }
                );
            }

            const data = await res.json();
            return NextResponse.json({
                tracks: data.tracks || [],
                albums: data.albums || [],
                artists: data.artists || [],
                playlists: data.playlists || [],
                notice: data.notice || null,
            });
        }

        // 3. STREAM RESOLUTION: GET /stream/{id}&{settings} with 503 Retry-After support
        if (action === 'stream') {
            if (!id) {
                return NextResponse.json({ error: 'Missing required track id for stream resolution' }, { status: 400 });
            }

            const streamUrl = buildUrlWithSettings(normalizedAddonUrl, `stream/${encodeURIComponent(id)}`, settings);

            let maxRetries = 3;
            let currentRes: Response | null = null;
            let lastNotice: EclipseNotice | null = null;

            while (maxRetries > 0) {
                currentRes = await fetch(streamUrl.toString(), {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(15000),
                });

                if (currentRes.status === 503) {
                    try {
                        const errJson = await currentRes.clone().json();
                        if (errJson?.notice) lastNotice = errJson.notice;
                    } catch {}

                    const retryAfterHeader = currentRes.headers.get('Retry-After');
                    const waitSec = Math.min(30, Math.max(1, parseInt(retryAfterHeader || '2', 10)));
                    console.log(`[ECLIPSE:CLIENT] 503 Retry-After: waiting ${waitSec}s...`);
                    await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
                    maxRetries--;
                    continue;
                }
                break;
            }

            if (!currentRes || !currentRes.ok) {
                const status = currentRes ? currentRes.status : 504;
                return NextResponse.json(
                    {
                        error: `Stream resolution failed with HTTP ${status}`,
                        notice: lastNotice,
                    },
                    { status }
                );
            }

            const streamData: EclipseStreamResponse = await currentRes.json();
            return NextResponse.json({
                stream: streamData,
                notice: streamData.notice || lastNotice,
            });
        }

        // 4. ISRC RESOLUTION: GET /resolve-isrc?isrc={isrc}
        if (action === 'resolve-isrc') {
            if (!isrc) {
                return NextResponse.json({ error: 'Missing isrc parameter' }, { status: 400 });
            }

            const isrcUrl = buildUrlWithSettings(normalizedAddonUrl, 'resolve-isrc');
            isrcUrl.searchParams.set('isrc', isrc);

            const res = await fetch(isrcUrl.toString(), {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                return NextResponse.json({ trackId: null, id: null });
            }

            const data = await res.json();
            const trackId = data.trackId || data.id || null;
            return NextResponse.json({ trackId, id: trackId, notice: data.notice || null });
        }

        // 5. IDENTITY RESOLVE: GET /resolve?isrc=...&title=...&artist=...&durationMs=...
        if (action === 'resolve') {
            const resolveUrl = buildUrlWithSettings(normalizedAddonUrl, 'resolve');
            if (isrc) resolveUrl.searchParams.set('isrc', isrc);
            if (title) resolveUrl.searchParams.set('title', title);
            if (artist) resolveUrl.searchParams.set('artist', artist);
            if (durationMs) resolveUrl.searchParams.set('durationMs', String(durationMs));

            const res = await fetch(resolveUrl.toString(), {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                return NextResponse.json({ item: null });
            }

            const data = await res.json();
            return NextResponse.json({ item: data.item || null, notice: data.notice || null });
        }

        // 6. ALBUM DETAILS: GET /album/{id}&{settings}
        if (action === 'album') {
            if (!id) return NextResponse.json({ error: 'Missing album id' }, { status: 400 });

            const albumUrl = buildUrlWithSettings(normalizedAddonUrl, `album/${encodeURIComponent(id)}`, settings);
            const res = await fetch(albumUrl.toString(), {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                return NextResponse.json({ error: `Album fetch failed with HTTP ${res.status}` }, { status: res.status });
            }

            const album: EclipseAlbum = await res.json();
            return NextResponse.json({ album, notice: (album as any).notice || null });
        }

        // 7. ARTIST DETAILS: GET /artist/{id}&{settings}
        if (action === 'artist') {
            if (!id) return NextResponse.json({ error: 'Missing artist id' }, { status: 400 });

            const artistUrl = buildUrlWithSettings(normalizedAddonUrl, `artist/${encodeURIComponent(id)}`, settings);
            const res = await fetch(artistUrl.toString(), {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                return NextResponse.json({ error: `Artist fetch failed with HTTP ${res.status}` }, { status: res.status });
            }

            const artistData: EclipseArtist = await res.json();
            return NextResponse.json({ artist: artistData, notice: (artistData as any).notice || null });
        }

        // 8. PLAYLIST DETAILS: GET /playlist/{id}&{settings}
        if (action === 'playlist') {
            if (!id) return NextResponse.json({ error: 'Missing playlist id' }, { status: 400 });

            const playlistUrl = buildUrlWithSettings(normalizedAddonUrl, `playlist/${encodeURIComponent(id)}`, settings);
            const res = await fetch(playlistUrl.toString(), {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                return NextResponse.json({ error: `Playlist fetch failed with HTTP ${res.status}` }, { status: res.status });
            }

            const playlist: EclipsePlaylist = await res.json();
            return NextResponse.json({ playlist, notice: (playlist as any).notice || null });
        }

        // 9. CATALOG DETAILS: GET /catalog/{id}?skip={skip}&{settings}
        if (action === 'catalog') {
            if (!id) return NextResponse.json({ error: 'Missing catalog id' }, { status: 400 });

            const catalogUrl = buildUrlWithSettings(normalizedAddonUrl, `catalog/${encodeURIComponent(id)}`, settings);
            catalogUrl.searchParams.set('skip', String(skip || 0));

            const res = await fetch(catalogUrl.toString(), {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                return NextResponse.json({ error: `Catalog fetch failed with HTTP ${res.status}` }, { status: res.status });
            }

            const data = await res.json();
            return NextResponse.json({ items: data.items || [], notice: data.notice || null });
        }

        // 10. DOWNLOAD TRACK STREAM TO DISK
        if (action === 'download') {
            if (!downloadDirectory) {
                return NextResponse.json({ error: 'Missing destination downloadDirectory' }, { status: 400 });
            }

            // Either streamUrl was directly provided (Eclipse direct URL bypass) or resolve it from /stream/:id
            let finalMediaUrl: string | undefined = body.streamUrl;
            let format: string = body.format || 'flac';

            if (!finalMediaUrl) {
                if (!id) {
                    return NextResponse.json({ error: 'Missing track id or streamUrl for download' }, { status: 400 });
                }
                const streamUrl = buildUrlWithSettings(normalizedAddonUrl, `stream/${encodeURIComponent(id)}`, settings);
                const streamRes = await fetch(streamUrl.toString(), {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(15000),
                });
                if (!streamRes.ok) {
                    return NextResponse.json({ error: `Stream resolution failed: HTTP ${streamRes.status}` }, { status: streamRes.status });
                }
                const streamInfo: EclipseStreamResponse = await streamRes.json();
                finalMediaUrl = streamInfo.url;
                format = streamInfo.container || streamInfo.format || streamInfo.codec || format;
            }

            if (!finalMediaUrl) {
                return NextResponse.json({ error: 'Addon provided no playable audio URL' }, { status: 404 });
            }

            // Target directory
            const targetDir = path.resolve(downloadDirectory);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // File naming: strictly isrc or id and extension ("dont add metadata just name the file with its isrc and extension")
            const baseName = sanitizeFilename(isrc || trackFilename || id || 'track');
            const cleanExt = (format || 'flac').replace(/^\./, '').toLowerCase();
            const fileName = `${baseName}.${cleanExt}`;
            const destinationPath = path.join(targetDir, fileName);
            const tempPath = path.join(targetDir, `${fileName}.part`);

            // Download media stream
            const mediaRes = await fetch(finalMediaUrl, {
                headers: { 'User-Agent': 'Eclipse-Addon-Client/1.0' },
            });

            if (!mediaRes.ok || !mediaRes.body) {
                return NextResponse.json({ error: `Audio file download failed with HTTP ${mediaRes.status}: ${mediaRes.statusText}` }, { status: 502 });
            }

            const nodeStream = Readable.fromWeb(mediaRes.body as import('stream/web').ReadableStream);
            const fileStream = fs.createWriteStream(tempPath);
            await pipeline(nodeStream, fileStream);

            const stats = fs.statSync(tempPath);
            if (stats.size < 1024) {
                try { fs.unlinkSync(tempPath); } catch {}
                return NextResponse.json({ error: 'Downloaded file corrupted or smaller than 1KB' }, { status: 502 });
            }

            if (fs.existsSync(destinationPath)) {
                fs.unlinkSync(destinationPath);
            }
            fs.renameSync(tempPath, destinationPath);

            return NextResponse.json({
                success: true,
                filePath: destinationPath,
                fileName,
                fileSize: stats.size,
            });
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: unknown) {
        console.error('[API:ECLIPSE:CLIENT:ERROR]', err);
        const msg = err instanceof Error ? err.message : 'Eclipse addon client error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
