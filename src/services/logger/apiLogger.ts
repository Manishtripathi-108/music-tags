export interface ApiCallLogEntry {
    id: string;
    timestamp: number;
    action: string;
    targetAddon?: string;
    method: string;
    url: string;
    requestHeaders: Record<string, string>;
    requestBody?: any;
    status: number;
    statusText: string;
    durationMs: number;
    responseHeaders?: Record<string, string>;
    responsePreview?: string;
    notice?: { level?: string; title?: string; message: string } | null;
    error?: string | null;
}

const MAX_LOG_ENTRIES = 250;
const logRingBuffer: ApiCallLogEntry[] = [];

export function getApiLogs(): ApiCallLogEntry[] {
    return [...logRingBuffer];
}

export function clearApiLogs(): void {
    logRingBuffer.length = 0;
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (!v) continue;
        const lowerKey = k.toLowerCase();
        if (lowerKey === 'authorization' || lowerKey === 'x-eclipse-access' || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')) {
            if (v.length > 24) {
                sanitized[k] = `${v.slice(0, 16)}...${v.slice(-8)}`;
            } else {
                sanitized[k] = '••••••••';
            }
        } else {
            sanitized[k] = v;
        }
    }
    return sanitized;
}

export function recordAndPrintLog(entry: ApiCallLogEntry): void {
    // Save to ring buffer
    logRingBuffer.unshift(entry);
    if (logRingBuffer.length > MAX_LOG_ENTRIES) {
        logRingBuffer.pop();
    }

    const isError = entry.status >= 400 || Boolean(entry.error);
    const isRetry = entry.status === 503;
    const timeStr = new Date(entry.timestamp).toISOString();

    const tag = isRetry
        ? '[BITCHORD:API:503_RETRY]'
        : isError
        ? '[BITCHORD:API:ERROR]'
        : '[BITCHORD:API:OK]';

    const divider = '─'.repeat(78);

    console.log(`\n${divider}`);
    console.log(`${tag} ${entry.method} ${entry.url}`);
    console.log(`Action: ${entry.action.toUpperCase()} | Status: ${entry.status} ${entry.statusText} (${entry.durationMs}ms) | Time: ${timeStr}`);

    const safeReqHeaders = sanitizeHeaders(entry.requestHeaders);
    if (Object.keys(safeReqHeaders).length > 0) {
        console.log(`Request Headers:`, safeReqHeaders);
    }

    if (entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0) {
        const retryAfter = entry.responseHeaders['retry-after'];
        if (retryAfter) {
            console.log(`Retry-After Header: ${retryAfter}s`);
        }
    }

    if (entry.error) {
        console.error(`Error: ${entry.error}`);
    }
    if (entry.notice) {
        console.log(`Addon Notice: [${entry.notice.level || 'info'}] ${entry.notice.title || ''} - ${entry.notice.message}`);
    }
    if (entry.responsePreview && !isError) {
        console.log(`Payload Preview: ${entry.responsePreview}`);
    }
    console.log(`${divider}\n`);
}

export async function loggedFetch(
    url: string | URL,
    init: RequestInit,
    context: {
        action: string;
        targetAddon?: string;
    }
): Promise<Response> {
    const startTime = performance.now();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const urlStr = url.toString();
    const method = (init.method || 'GET').toUpperCase();

    // Extract request headers
    const reqHeaders: Record<string, string> = {};
    if (init.headers) {
        if (init.headers instanceof Headers) {
            init.headers.forEach((v, k) => {
                reqHeaders[k] = v;
            });
        } else if (Array.isArray(init.headers)) {
            for (const [k, v] of init.headers) reqHeaders[k] = v;
        } else {
            Object.assign(reqHeaders, init.headers);
        }
    }

    let res: Response;
    let errorMsg: string | null = null;

    try {
        res = await fetch(urlStr, init);
    } catch (err: unknown) {
        const durationMs = Math.round(performance.now() - startTime);
        errorMsg = err instanceof Error ? err.message : String(err);

        const entry: ApiCallLogEntry = {
            id,
            timestamp: Date.now(),
            action: context.action,
            targetAddon: context.targetAddon,
            method,
            url: urlStr,
            requestHeaders: reqHeaders,
            status: 0,
            statusText: 'Network Failure / Timeout',
            durationMs,
            error: errorMsg,
        };
        recordAndPrintLog(entry);
        throw err;
    }

    const durationMs = Math.round(performance.now() - startTime);
    const respHeaders: Record<string, string> = {};
    if (res.headers && typeof res.headers.forEach === 'function') {
        res.headers.forEach((v, k) => {
            respHeaders[k] = v;
        });
    }

    // Inspect preview or notice if text/json, without consuming audio media binary streams
    let preview: string | undefined;
    let noticeObj = null;

    const contentType = (res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : '') || '';
    const isStreamableAudio = contentType.startsWith('audio/') || contentType.includes('octet-stream');

    if (!isStreamableAudio && typeof res.clone === 'function') {
        try {
            const clone = res.clone();
            if (typeof clone.text === 'function') {
                const text = await clone.text();
                if (text) {
                    preview = text.length > 300 ? `${text.slice(0, 300)}...` : text;
                    try {
                        const parsed = JSON.parse(text);
                        if (parsed.notice) noticeObj = parsed.notice;
                        if (parsed.error) {
                            errorMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                        }
                    } catch {}
                }
            }
        } catch {}
    } else if (isStreamableAudio) {
        const contentLength = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-length') : null;
        const sizeMb = contentLength ? (parseInt(contentLength, 10) / (1024 * 1024)).toFixed(2) + ' MB' : 'chunked';
        preview = `[Audio Stream Content-Type: ${contentType}, Size: ${sizeMb}]`;
    }

    const entry: ApiCallLogEntry = {
        id,
        timestamp: Date.now(),
        action: context.action,
        targetAddon: context.targetAddon,
        method,
        url: urlStr,
        requestHeaders: reqHeaders,
        status: res.status,
        statusText: res.statusText || 'OK',
        durationMs,
        responseHeaders: respHeaders,
        responsePreview: preview,
        notice: noticeObj,
        error: !res.ok ? errorMsg || `HTTP ${res.status} ${res.statusText}` : null,
    };

    recordAndPrintLog(entry);
    return res;
}
