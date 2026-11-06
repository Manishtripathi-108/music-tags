import { NextRequest, NextResponse } from 'next/server';
import { type RemoteStreamInfo } from '@/domain/remote-audio/types';

interface StreamTrackRequestBody {
    remoteTrackId: string;
    apiUrl: string;
    quality?: string;
    atmos?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body: StreamTrackRequestBody = await request.json();
        const { remoteTrackId, apiUrl, quality = 'max', atmos = 'auto' } = body;

        if (!remoteTrackId || !apiUrl) {
            return NextResponse.json({ error: 'Missing remoteTrackId or apiUrl' }, { status: 400 });
        }

        const normalizedApiUrl = apiUrl.replace(/\/+$/, '');
        const streamUrl = new URL(`${normalizedApiUrl}/stream/${encodeURIComponent(remoteTrackId)}`);
        if (quality) streamUrl.searchParams.set('quality', quality);
        if (atmos) streamUrl.searchParams.set('atmos', atmos);
        console.log(`\n[API:STREAM:REQUEST] Fetching stream info for ID: ${remoteTrackId} from ${streamUrl.toString()}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const res = await fetch(streamUrl.toString(), {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'MetaTagStudio/1.0',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                console.error(`[API:STREAM:FAIL] Endpoint returned HTTP ${res.status}: ${res.statusText}`);
                return NextResponse.json(
                    { error: `Remote stream endpoint returned HTTP ${res.status}: ${res.statusText}` },
                    { status: res.status }
                );
            }

            const streamData: RemoteStreamInfo = await res.json();
            console.log(`[API:STREAM:SUCCESS] Resolved stream URL: ${streamData.url ? `${streamData.url.substring(0, 50)}...` : 'None'} | Format: ${streamData.format || streamData.codec} | AudioMode: ${streamData.audioMode || 'Stereo'}`);
            return NextResponse.json({ stream: streamData });
        } catch (fetchErr: unknown) {
            clearTimeout(timeoutId);
            const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error';
            console.error(`[API:STREAM:ERROR] Resolution failed: ${msg}`);
            return NextResponse.json({ error: `Stream request failed: ${msg}` }, { status: 502 });
        }
    } catch (error) {
        console.error('Error fetching stream:', error);
        return NextResponse.json({ error: 'Internal server error resolving stream' }, { status: 500 });
    }
}
