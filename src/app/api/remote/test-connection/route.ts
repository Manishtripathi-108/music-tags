import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const { apiUrl, downloadDirectory } = body;

        const results: {
            apiOk: boolean;
            apiMessage: string;
            manifest?: unknown;
            directoryOk: boolean;
            directoryMessage: string;
        } = {
            apiOk: false,
            apiMessage: '',
            directoryOk: false,
            directoryMessage: '',
        };

        // 1. Test API connection
        if (apiUrl) {
            const normalized = apiUrl.replace(/\/+$/, '');
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                // Try manifest first, if 404 try a test search
                let res = await fetch(`${normalized}/manifest.json`, {
                    headers: { 'User-Agent': 'MetaTagStudio/1.0' },
                    signal: controller.signal,
                });

                if (!res.ok) {
                    res = await fetch(`${normalized}/search?q=test`, {
                        headers: { 'User-Agent': 'MetaTagStudio/1.0' },
                        signal: controller.signal,
                    });
                }

                clearTimeout(timeoutId);

                if (res.ok) {
                    results.apiOk = true;
                    results.apiMessage = `Successfully connected (HTTP ${res.status})`;
                    try {
                        results.manifest = await res.json();
                    } catch {}
                } else {
                    results.apiOk = false;
                    results.apiMessage = `Endpoint responded with HTTP ${res.status}: ${res.statusText}`;
                }
            } catch (err: unknown) {
                results.apiOk = false;
                results.apiMessage = err instanceof Error ? err.message : 'Connection failed';
            }
        } else {
            results.apiMessage = 'No API URL provided';
        }

        // 2. Test directory validity & write permission
        if (downloadDirectory) {
            try {
                const targetDir = path.resolve(downloadDirectory);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Check write permissions by creating and unlinking a small probe file
                const testFile = path.join(targetDir, `.write_test_${Date.now()}.tmp`);
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);

                results.directoryOk = true;
                results.directoryMessage = `Valid and writable directory: ${targetDir}`;
            } catch (dirErr: unknown) {
                results.directoryOk = false;
                results.directoryMessage = dirErr instanceof Error ? dirErr.message : 'Directory is not writable';
            }
        } else {
            results.directoryMessage = 'No download directory specified';
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error in test-connection route:', error);
        return NextResponse.json({ error: 'Internal server error testing connection' }, { status: 500 });
    }
}
