import { NextRequest, NextResponse } from 'next/server';
import { globalLyricsNormalizer } from '@/core/lyrics/lrcNormalizer';
import {
    NormalizeAllLyricsRequestSchema,
    type NormalizeAllLyricsApiResponse,
    type ScanProgressEvent,
} from '@/types/audio';
import { ensureDatabaseInitialized } from '@/db/init';

export async function POST(
    request: NextRequest
): Promise<NextResponse<NormalizeAllLyricsApiResponse | { error: string }>> {
    await ensureDatabaseInitialized();

    try {
        const body = await request.json().catch(() => ({}));
        const validation = NormalizeAllLyricsRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0]?.message || 'Invalid request payload' },
                { status: 400 }
            );
        }

        const { folderPath } = validation.data;
        const jobId = globalLyricsNormalizer.createJob();

        // Process batch in background without blocking response
        globalLyricsNormalizer.normalizeAll(jobId, folderPath).catch((err) => {
            console.error(`[LyricsNormalizer Job ${jobId}] Failed:`, err);
        });

        return NextResponse.json({
            success: true,
            jobId,
            message: `Batch normalization started${folderPath ? ` for folder "${folderPath}"` : ' for library'}`,
        });
    } catch (error) {
        console.error('Error starting batch LRC normalization:', error);
        return NextResponse.json(
            { error: 'Failed to start batch LRC normalization' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const listener = (event: ScanProgressEvent) => {
                try {
                    const payload = `data: ${JSON.stringify(event)}\n\n`;
                    controller.enqueue(encoder.encode(payload));

                    if (event.status === 'COMPLETED' || event.status === 'FAILED' || event.status === 'CANCELLED') {
                        controller.close();
                    }
                } catch {
                    try {
                        controller.close();
                    } catch {}
                }
            };

            globalLyricsNormalizer.subscribe(jobId, listener);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}
