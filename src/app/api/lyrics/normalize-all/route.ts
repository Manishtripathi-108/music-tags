import { NextRequest, NextResponse } from 'next/server';

import { type NormalizeAllLyricsApiResponse } from '@/domain/media/dto';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { createProgressEventStream } from '@/infrastructure/http/sse';
import { NormalizeAllLyricsRequestSchema } from '@/schemas';
import { globalLyricsNormalizer } from '@/services/lyrics/lyrics-service';

export async function POST(request: NextRequest): Promise<NextResponse<NormalizeAllLyricsApiResponse | { error: string }>> {
    await ensureDatabaseInitialized();

    try {
        const body = await request.json().catch(() => ({}));
        const validation = NormalizeAllLyricsRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0]?.message || 'Invalid request payload' }, { status: 400 });
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
        return NextResponse.json({ error: 'Failed to start batch LRC normalization' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }

    return createProgressEventStream({
        subscribe: (listener) => globalLyricsNormalizer.subscribe(jobId, listener),
        unsubscribe: (listener) => globalLyricsNormalizer.unsubscribe(jobId, listener),
    });
}
