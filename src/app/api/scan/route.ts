import { NextRequest, NextResponse } from 'next/server';
import { globalScanner } from '@/core/scanner/crawler';
import { ScanFolderRequestSchema, type ScanApiResponse, type ScanProgressEvent } from '@/types/audio';
import { ensureDatabaseInitialized } from '@/db/init';

export async function POST(request: NextRequest): Promise<NextResponse<ScanApiResponse | { error: string }>> {
    await ensureDatabaseInitialized();

    try {
        const body = await request.json();
        const validation = ScanFolderRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0]?.message || 'Invalid folder scan request' },
                { status: 400 }
            );
        }

        const { folderPath, recursive, forceReindex } = validation.data;
        const jobId = globalScanner.createJob();

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

            globalScanner.subscribe(jobId, listener);
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
