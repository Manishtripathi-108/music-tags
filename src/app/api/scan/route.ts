import { NextRequest, NextResponse } from 'next/server';

import { type ScanApiResponse } from '@/domain/media/dto';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { createProgressEventStream } from '@/infrastructure/http/sse';
import { ScanFolderRequestSchema } from '@/schemas';
import { globalScanner } from '@/services/scanner/scanner-service';

export async function POST(request: NextRequest): Promise<NextResponse<ScanApiResponse | { error: string }>> {
    await ensureDatabaseInitialized();

    try {
        const body = await request.json();
        const validation = ScanFolderRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0]?.message || 'Invalid folder scan request' }, { status: 400 });
        }

        const { folderPath, recursive, forceReindex } = validation.data;
        const jobId = globalScanner.createJob();
        console.log(`\n[API:SCAN:POST] Request received for folder: "${folderPath}" (recursive=${recursive}, forceReindex=${forceReindex}) -> Assigned Job ID: ${jobId}`);

        // Launch ingestion in the background
        globalScanner.scanDirectory(jobId, folderPath, recursive, forceReindex).catch((err) => {
            console.error(`[Scanner Job ${jobId}] Background scan failed:`, err);
        });

        return NextResponse.json({
            success: true,
            jobId,
            message: `Ingestion job started for "${folderPath}"`,
        });
    } catch (error) {
        console.error('Error creating scan job:', error);
        return NextResponse.json({ error: 'Failed to initiate scan job' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }

    if (!globalScanner.hasJob(jobId)) {
        console.warn(`[API:SCAN:SSE] SSE connection rejected: Job ID "${jobId}" not found or expired`);
        return NextResponse.json({ error: 'Scan job not found or already expired' }, { status: 404 });
    }

    console.log(`[API:SCAN:SSE] Client connected to progress event stream for Job ID: ${jobId}`);
    return createProgressEventStream({
        subscribe: (listener) => globalScanner.subscribe(jobId, listener),
        unsubscribe: (listener) => globalScanner.unsubscribe(jobId, listener),
    });
}
