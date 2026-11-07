import { NextRequest, NextResponse } from 'next/server';
import { isDashManifestUrl } from '@/domain/remote-audio/eclipse-stream';

/**
 * Rewrites URLs inside an MPEG-DASH MPD XML document to route segments through this proxy.
 */
function rewriteDashManifest(xml: string, manifestBaseUrl: string): string {
    return xml.replace(
        /(initialization|media)="([^"]+)"/gi,
        (_match, attr: string, rawVal: string) => {
            const unescapedVal = rawVal
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'");

            let absoluteUrl: string;
            try {
                absoluteUrl = new URL(unescapedVal, manifestBaseUrl).toString();
            } catch {
                absoluteUrl = unescapedVal;
            }

            // Encode the URL parameter while preserving DASH template variables ($Number$, $Time$, $RepresentationID$)
            let encodedParam = encodeURIComponent(absoluteUrl);
            encodedParam = encodedParam.replace(
                /%24(Number|Time|RepresentationID)(%0\d+d)?%24/gi,
                (_m, name, width) => `$${name}${width || ''}$`
            );

            const proxiedUrl = `/api/eclipse/stream-proxy?url=${encodedParam}`;
            // Re-escape XML attribute values
            const xmlSafeProxied = proxiedUrl.replace(/&/g, '&amp;');
            return `${attr}="${xmlSafeProxied}"`;
        }
    );
}

export async function GET(request: NextRequest): Promise<Response> {
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing target url parameter' }, { status: 400 });
    }

    try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Collect headers to forward
    const forwardHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: '*/*',
    };

    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
        forwardHeaders['Range'] = rangeHeader;
    }

    // Forward auth headers if passed via query params or request headers
    const eclipseAccess = searchParams.get('x-eclipse-access') || request.headers.get('x-eclipse-access');
    if (eclipseAccess) {
        forwardHeaders['x-eclipse-access'] = eclipseAccess;
    }
    const authHeader = searchParams.get('authorization') || request.headers.get('authorization');
    if (authHeader) {
        forwardHeaders['Authorization'] = authHeader;
    }

    // Fetch with retry for 503 / 429
    let attempts = 3;
    let remoteRes: Response | null = null;
    let lastError: string | null = null;

    while (attempts > 0) {
        try {
            remoteRes = await fetch(targetUrl, {
                method: 'GET',
                headers: forwardHeaders,
                signal: AbortSignal.timeout(25000),
            });

            if (remoteRes.status === 503 || remoteRes.status === 429) {
                const retrySec = parseInt(remoteRes.headers.get('retry-after') || '2', 10);
                await new Promise((r) => setTimeout(r, Math.min(retrySec, 5) * 1000));
                attempts--;
                continue;
            }

            break;
        } catch (err) {
            lastError = err instanceof Error ? err.message : 'Fetch failed';
            attempts--;
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    if (!remoteRes) {
        return NextResponse.json({ error: `Failed to reach audio stream: ${lastError}` }, { status: 504 });
    }

    const contentType = remoteRes.headers.get('content-type') || '';
    const isDash = isDashManifestUrl(targetUrl, contentType);

    // If it's a DASH MPD manifest, rewrite URLs and return modified XML
    if (isDash) {
        const xmlText = await remoteRes.text();
        const rewritten = rewriteDashManifest(xmlText, targetUrl);

        return new Response(rewritten, {
            status: remoteRes.status,
            headers: {
                'Content-Type': 'application/dash+xml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Cache-Control': 'no-cache',
            },
        });
    }

    // Direct media stream / segment streaming
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Accept-Ranges', 'bytes');

    if (contentType) responseHeaders.set('Content-Type', contentType);
    const contentLength = remoteRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    const contentRange = remoteRes.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    return new Response(remoteRes.body, {
        status: remoteRes.status,
        headers: responseHeaders,
    });
}

export async function OPTIONS(): Promise<Response> {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
    });
}

export async function HEAD(request: NextRequest): Promise<Response> {
    return GET(request);
}
