import { type ScanProgressEvent } from '@/domain/scanner/types';

export interface EventStreamOptions {
    subscribe: (listener: (event: ScanProgressEvent) => void) => void;
    unsubscribe?: (listener: (event: ScanProgressEvent) => void) => void;
    isTerminal?: (event: ScanProgressEvent) => boolean;
}

/**
 * Creates a standard Server-Sent Events (SSE) Response for job progress monitoring.
 */
export function createProgressEventStream(options: EventStreamOptions): Response {
    const encoder = new TextEncoder();
    const isTerminal = options.isTerminal || ((event) => event.status === 'COMPLETED' || event.status === 'FAILED' || event.status === 'CANCELLED');

    const stream = new ReadableStream({
        start(controller) {
            const listener = (event: ScanProgressEvent) => {
                try {
                    const payload = `data: ${JSON.stringify(event)}\n\n`;
                    controller.enqueue(encoder.encode(payload));

                    if (isTerminal(event)) {
                        if (options.unsubscribe) {
                            options.unsubscribe(listener);
                        }
                        controller.close();
                    }
                } catch {
                    if (options.unsubscribe) {
                        try {
                            options.unsubscribe(listener);
                        } catch {}
                    }
                    try {
                        controller.close();
                    } catch {}
                }
            };

            options.subscribe(listener);
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
