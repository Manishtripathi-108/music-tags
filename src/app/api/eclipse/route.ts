import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { loggedFetch } from '@/services/logger/apiLogger';
import { isDashManifest, downloadDashAudioStream } from '@/services/eclipse/dashDownloader';
import { checkLibraryQualityForTrack } from '@/services/eclipse/qualityChecker';

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
    tier?: string;
    container?: string;
    manifest?: string;
    sampleRate?: number;
    bitDepth?: number;
    isrc?: string;
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

class EclipseDownloadMutex {
    private queue: Promise<void> = Promise.resolve();

    async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        let release: () => void;
        const wait = new Promise<void>((resolve) => {
            release = resolve;
        });
        const prev = this.queue;
        this.queue = this.queue.then(() => wait);
        await prev;
        try {
            return await fn();
        } finally {
            release!();
        }
    }
}
const eclipseDownloadMutex = new EclipseDownloadMutex();

function getFetchHeaders(customHeaders?: Record<string, string>, extraAccept = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: extraAccept,
        'User-Agent': 'Eclipse-Addon-Client/1.0',
    };

    if (customHeaders && typeof customHeaders === 'object') {
        for (const [k, v] of Object.entries(customHeaders)) {
            if (k && v && typeof v === 'string') {
                headers[k.trim()] = v.trim();
            }
        }
    }
    return headers;
}

async function extractAddonErrorMessage(res: Response, defaultAction: string): Promise<{ error: string; notice?: EclipseNotice | null; details?: any }> {
    let errorDetail = '';
    let notice: EclipseNotice | null = null;
    let rawParsed: any = null;

    try {
        const text = await res.text();
        if (text) {
            try {
                rawParsed = JSON.parse(text);
                if (rawParsed.error) {
                    errorDetail = typeof rawParsed.error === 'string' ? rawParsed.error : JSON.stringify(rawParsed.error);
                } else if (rawParsed.message) {
                    errorDetail = rawParsed.message;
                } else if (rawParsed.title) {
                    errorDetail = rawParsed.title;
                }
                if (rawParsed.notice) notice = rawParsed.notice;
            } catch {
                errorDetail = text.slice(0, 400).trim();
            }
        }
    } catch {}

    const statusText = res.statusText || 'Error';
    const finalMsg = errorDetail
        ? `Addon Error (${res.status} ${statusText}): ${errorDetail}`
        : `Addon returned HTTP ${res.status}: ${statusText} on ${defaultAction}`;

    return { error: finalMsg, notice, details: rawParsed };
}

function buildUrlWithSettings(baseUrl: string, endpointPath: string, settings?: Record<string, string | number | boolean>): URL {
    const normalizedBase = baseUrl.trim().replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
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
            addonId,
            eclipseAuthToken,
            isrc,
            title,
            artist,
            durationMs,
            skip = 0,
            settings,
            headers: customHeaders,
            downloadDirectory,
            trackFilename,
        } = body;

        // 0. GET ECLIPSE ADDON ACCESS TOKEN: POST https://api.eclipsemusic.app/api/addon-access/token?addon=<addonId>
        if (action === 'get-addon-token') {
            const targetAddonId = addonId || id;
            if (!targetAddonId) {
                return NextResponse.json({ error: 'Missing required parameter: addonId' }, { status: 400 });
            }
            if (!eclipseAuthToken) {
                return NextResponse.json({ error: 'Missing required parameter: eclipseAuthToken' }, { status: 400 });
            }

            const rawToken = String(eclipseAuthToken).trim();
            const bearerToken = rawToken.toLowerCase().startsWith('bearer ') ? rawToken : `Bearer ${rawToken}`;
            const tokenUrl = `https://api.eclipsemusic.app/api/addon-access/token?addon=${encodeURIComponent(targetAddonId)}`;

            const res = await loggedFetch(
                tokenUrl,
                {
                    method: 'POST',
                    headers: {
                        Accept: '*/*',
                        Authorization: bearerToken,
                        Origin: 'https://eclipsemusic.app',
                        Referer: 'https://eclipsemusic.app/',
                        'Content-Length': '0',
                        'sec-ch-ua': '"Not-A.Brand";v="99", "Brave";v="157", "Chromium";v="157"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-site',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    },
                    signal: AbortSignal.timeout(10000),
                },
                { action: 'get-addon-token', targetAddon: targetAddonId }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, 'addon-access/token');
                return NextResponse.json({ error: err.error, notice: err.notice }, { status: res.status });
            }

            const tokenData = await res.json();
            return NextResponse.json(tokenData);
        }

        if (!addonUrl) {
            return NextResponse.json({ error: 'Missing required parameter: addonUrl' }, { status: 400 });
        }

        // Strip trailing /manifest.json or slashes so addonUrl is always the base addon URL
        const normalizedAddonUrl = addonUrl
            .trim()
            .replace(/\/manifest\.json$/i, '')
            .replace(/\/+$/, '');
        const fetchHeaders = getFetchHeaders(customHeaders);

        // 1. MANIFEST: GET /manifest.json
        if (action === 'manifest') {
            const manifestUrl = `${normalizedAddonUrl}/manifest.json`;
            const res = await loggedFetch(
                manifestUrl,
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(10000),
                },
                { action: 'manifest', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, 'manifest.json');
                return NextResponse.json(
                    { error: err.error, notice: err.notice },
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

            const res = await loggedFetch(
                searchUrl.toString(),
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(15000),
                },
                { action: 'search', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, 'search');
                return NextResponse.json(
                    { error: err.error, notice: err.notice },
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
                currentRes = await loggedFetch(
                    streamUrl.toString(),
                    {
                        headers: fetchHeaders,
                        signal: AbortSignal.timeout(15000),
                    },
                    { action: 'stream', targetAddon: normalizedAddonUrl }
                );

                if (currentRes.status === 503) {
                    const err = await extractAddonErrorMessage(currentRes.clone(), 'stream');
                    if (err.notice) lastNotice = err.notice;

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
                const err = currentRes
                    ? await extractAddonErrorMessage(currentRes, 'stream')
                    : { error: 'Stream request timed out', notice: lastNotice };
                return NextResponse.json(
                    {
                        error: err.error,
                        notice: err.notice || lastNotice,
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

            const res = await loggedFetch(
                isrcUrl.toString(),
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(10000),
                },
                { action: 'resolve-isrc', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, 'resolve-isrc');
                return NextResponse.json({ trackId: null, id: null, error: err.error, notice: err.notice });
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

            const res = await loggedFetch(
                resolveUrl.toString(),
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(10000),
                },
                { action: 'resolve', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, 'resolve');
                return NextResponse.json({ item: null, error: err.error, notice: err.notice });
            }

            const data = await res.json();
            return NextResponse.json({ item: data.item || null, notice: data.notice || null });
        }

        // 6. ALBUM DETAILS: GET /album/{id}&{settings}
        if (action === 'album') {
            if (!id) return NextResponse.json({ error: 'Missing album id' }, { status: 400 });

            const albumUrl = buildUrlWithSettings(normalizedAddonUrl, `album/${encodeURIComponent(id)}`, settings);
            const res = await loggedFetch(
                albumUrl.toString(),
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(15000),
                },
                { action: 'album', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, `album/${id}`);
                return NextResponse.json({ error: err.error, notice: err.notice }, { status: res.status });
            }

            const album: EclipseAlbum = await res.json();
            return NextResponse.json({ album, notice: (album as any).notice || null });
        }

        // 7. ARTIST DETAILS: GET /artist/{id}&{settings}
        if (action === 'artist') {
            if (!id) return NextResponse.json({ error: 'Missing artist id' }, { status: 400 });

            const artistUrl = buildUrlWithSettings(normalizedAddonUrl, `artist/${encodeURIComponent(id)}`, settings);
            const res = await loggedFetch(
                artistUrl.toString(),
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(15000),
                },
                { action: 'artist', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, `artist/${id}`);
                return NextResponse.json({ error: err.error, notice: err.notice }, { status: res.status });
            }

            const artistData: EclipseArtist = await res.json();
            return NextResponse.json({ artist: artistData, notice: (artistData as any).notice || null });
        }

        // 8. PLAYLIST DETAILS: GET /playlist/{id}&{settings}
        if (action === 'playlist') {
            if (!id) return NextResponse.json({ error: 'Missing playlist id' }, { status: 400 });

            const playlistUrl = buildUrlWithSettings(normalizedAddonUrl, `playlist/${encodeURIComponent(id)}`, settings);
            const res = await loggedFetch(
                playlistUrl.toString(),
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(15000),
                },
                { action: 'playlist', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, `playlist/${id}`);
                return NextResponse.json({ error: err.error, notice: err.notice }, { status: res.status });
            }

            const playlist: EclipsePlaylist = await res.json();
            return NextResponse.json({ playlist, notice: (playlist as any).notice || null });
        }

        // 9. CATALOG DETAILS: GET /catalog/{id}?skip={skip}&{settings}
        if (action === 'catalog') {
            if (!id) return NextResponse.json({ error: 'Missing catalog id' }, { status: 400 });

            const catalogUrl = buildUrlWithSettings(normalizedAddonUrl, `catalog/${encodeURIComponent(id)}`, settings);
            catalogUrl.searchParams.set('skip', String(skip || 0));

            const res = await loggedFetch(
                catalogUrl.toString(),
                {
                    headers: fetchHeaders,
                    signal: AbortSignal.timeout(15000),
                },
                { action: 'catalog', targetAddon: normalizedAddonUrl }
            );

            if (!res.ok) {
                const err = await extractAddonErrorMessage(res, `catalog/${id}`);
                return NextResponse.json({ error: err.error, notice: err.notice }, { status: res.status });
            }

            const data = await res.json();
            return NextResponse.json({ items: data.items || [], notice: data.notice || null });
        }

        // 10. DOWNLOAD TRACK STREAM TO DISK
        if (action === 'download') {
            if (!downloadDirectory) {
                return NextResponse.json({ error: 'Missing destination downloadDirectory' }, { status: 400 });
            }

            return await eclipseDownloadMutex.runExclusive(async () => {
                let finalMediaUrl: string | undefined;
                let format: string = body.format || 'flac';

                // "download link expires so only fetch just before downloading"
                // Always resolve fresh stream URL from addon right before downloading
                const resolveStream = async (): Promise<EclipseStreamResponse> => {
                    if (body.streamUrl && !id) {
                        return { url: body.streamUrl, format };
                    }
                    if (!id) {
                        throw new Error('Missing track id for stream resolution');
                    }
                    const streamUrl = buildUrlWithSettings(normalizedAddonUrl, `stream/${encodeURIComponent(id)}`, settings);
                    let maxRetries = 5;
                    let lastRes: Response | null = null;
                    while (maxRetries > 0) {
                        lastRes = await loggedFetch(
                            streamUrl.toString(),
                            {
                                headers: fetchHeaders,
                                signal: AbortSignal.timeout(25000),
                            },
                            { action: 'download-stream-resolve', targetAddon: normalizedAddonUrl }
                        );
                        if (lastRes.status === 503) {
                            const retryAfterHeader = lastRes.headers.get('Retry-After');
                            const waitSec = Math.min(30, Math.max(2, parseInt(retryAfterHeader || '3', 10)));
                            console.log(`[ECLIPSE:DOWNLOAD] 503 Retry-After: waiting ${waitSec}s (attempt ${6 - maxRetries}/5)...`);
                            await new Promise((r) => setTimeout(r, waitSec * 1000));
                            maxRetries--;
                            continue;
                        }
                        break;
                    }
                    if (!lastRes || !lastRes.ok) {
                        const err = lastRes
                            ? await extractAddonErrorMessage(lastRes, `stream/${id}`)
                            : { error: 'Stream request timed out', notice: null };
                        throw new Error(err.error);
                    }
                    return await lastRes.json();
                };

                let streamInfo: EclipseStreamResponse;
                try {
                    streamInfo = await resolveStream();
                    finalMediaUrl = streamInfo.url;
                    format = streamInfo.container || streamInfo.format || streamInfo.codec || format;
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Failed to resolve stream';
                    return NextResponse.json({ error: msg }, { status: 502 });
                }

                if (!finalMediaUrl) {
                    return NextResponse.json({ error: 'Addon provided no playable audio URL' }, { status: 404 });
                }

                // "before starting download check if already have same or higher quality in our list if yes then dont if not then show and download"
                const qualityCheck = await checkLibraryQualityForTrack({
                    isrc: streamInfo.isrc || isrc,
                    title: body.title || trackFilename || id,
                    artist: body.artist,
                    streamInfo,
                    downloadDirectory,
                    forceRedownload: Boolean(body.forceRedownload),
                });

                if (qualityCheck.skipped) {
                    console.log(`[ECLIPSE:DOWNLOAD] Skipped: ${qualityCheck.message}`);
                    return NextResponse.json({
                        success: false,
                        skipped: true,
                        reason: qualityCheck.reason,
                        message: qualityCheck.message,
                        localTrack: qualityCheck.localTrack,
                        remoteQuality: qualityCheck.remoteQuality,
                    });
                }

                // Target directory
                const targetDir = path.resolve(downloadDirectory);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // File naming: strictly isrc or id and extension ("dont add metadata just name the file with its isrc and extension")
                const baseName = sanitizeFilename(isrc || trackFilename || id || 'track');
                const isDash = isDashManifest(finalMediaUrl);
                const cleanExt = (isDash ? 'flac' : (format || 'flac')).replace(/^\./, '').toLowerCase();
                const fileName = `${baseName}.${cleanExt}`;
                const destinationPath = path.join(/*turbopackIgnore: true*/ targetDir, fileName);

                // Handle MPEG-DASH MPD manifest downloading
                if (isDash) {
                    console.log(`[ECLIPSE:DOWNLOAD] Detected MPEG-DASH MPD manifest at ${finalMediaUrl}. Fetching manifest and downloading segments...`);
                    const manifestRes = await loggedFetch(
                        finalMediaUrl,
                        {
                            headers: getFetchHeaders(customHeaders, '*/*'),
                            signal: AbortSignal.timeout(20000),
                        },
                        { action: 'dash-manifest-fetch', targetAddon: normalizedAddonUrl }
                    );

                    if (!manifestRes.ok) {
                        const err = await extractAddonErrorMessage(manifestRes, 'dash manifest fetch');
                        return NextResponse.json({ error: `Failed to fetch DASH manifest: ${err.error}` }, { status: manifestRes.status });
                    }

                    const manifestXml = typeof manifestRes.text === 'function' ? await manifestRes.text() : '';
                    const dashResult = await downloadDashAudioStream({
                        manifestXml,
                        manifestUrl: finalMediaUrl,
                        destinationPath,
                        customHeaders: getFetchHeaders(customHeaders, '*/*'),
                        addonUrl: normalizedAddonUrl,
                    });

                    return NextResponse.json({
                        success: true,
                        filePath: dashResult.destinationPath,
                        fileName,
                        fileSize: dashResult.sizeBytes,
                        isUpgrade: Boolean(qualityCheck.localTrack),
                        quality: qualityCheck.remoteQuality.qualityLabel,
                        message: qualityCheck.message,
                    });
                }

                // Direct media stream download
                const tempPath = path.join(targetDir, `${fileName}.part`);
                let mediaRes = await loggedFetch(
                    finalMediaUrl,
                    {
                        headers: getFetchHeaders(customHeaders, '*/*'),
                    },
                    { action: 'download-media-stream', targetAddon: normalizedAddonUrl }
                );

                // If link expired or failed, immediately re-resolve fresh stream URL and retry once
                if (!mediaRes.ok || !mediaRes.body) {
                    console.warn(`[ECLIPSE:DOWNLOAD] Media download returned HTTP ${mediaRes.status}. Link may have expired. Re-fetching fresh stream URL...`);
                    try {
                        streamInfo = await resolveStream();
                        finalMediaUrl = streamInfo.url;
                        mediaRes = await loggedFetch(
                            finalMediaUrl,
                            {
                                headers: getFetchHeaders(customHeaders, '*/*'),
                            },
                            { action: 'download-media-retry', targetAddon: normalizedAddonUrl }
                        );
                    } catch {}
                    if (!mediaRes.ok || !mediaRes.body) {
                        const err = await extractAddonErrorMessage(mediaRes, 'audio stream download');
                        return NextResponse.json({ error: err.error }, { status: mediaRes.status });
                    }
                }

                // Check if fetched content is unexpectedly DASH MPD XML
                const contentType = mediaRes.headers?.get ? mediaRes.headers.get('content-type') || '' : '';
                if (isDashManifest(finalMediaUrl, contentType)) {
                    const manifestXml = typeof mediaRes.text === 'function' ? await mediaRes.text() : '';
                    const dashResult = await downloadDashAudioStream({
                        manifestXml,
                        manifestUrl: finalMediaUrl,
                        destinationPath,
                        customHeaders: getFetchHeaders(customHeaders, '*/*'),
                        addonUrl: normalizedAddonUrl,
                    });

                    return NextResponse.json({
                        success: true,
                        filePath: dashResult.destinationPath,
                        fileName,
                        fileSize: dashResult.sizeBytes,
                        isUpgrade: Boolean(qualityCheck.localTrack),
                        quality: qualityCheck.remoteQuality.qualityLabel,
                        message: qualityCheck.message,
                    });
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
                    isUpgrade: Boolean(qualityCheck.localTrack),
                    quality: qualityCheck.remoteQuality.qualityLabel,
                    message: qualityCheck.message,
                });
            });
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: unknown) {
        console.error('[API:ECLIPSE:CLIENT:ERROR]', err);
        const msg = err instanceof Error ? err.message : 'Eclipse addon client error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
