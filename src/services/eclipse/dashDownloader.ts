import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { loggedFetch } from '@/services/logger/apiLogger';

export interface DashSegmentTimelineItem {
    duration: number;
    repeat: number; // 0 means 1 segment, 38 means 39 segments (1 + 38)
    timeOffset?: number;
}

export interface DashManifestInfo {
    timescale: number;
    startNumber: number;
    codecs: string;
    mimeType: string;
    initUrl: string;
    mediaUrlTemplate: string;
    segmentNumbers: number[];
}

/**
 * Decodes XML entities such as &amp;, &lt;, &gt;, &quot;, &apos;
 */
export function unescapeXml(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

/**
 * Tests whether content or URL indicates an MPEG-DASH MPD manifest.
 */
export function isDashManifest(urlOrContent: string, contentType?: string): boolean {
    if (!urlOrContent) return false;
    if (contentType && (contentType.includes('dash+xml') || contentType.includes('application/xml') || contentType.includes('text/xml'))) {
        return true;
    }
    const clean = urlOrContent.trim();
    if (clean.startsWith('<?xml') || clean.startsWith('<MPD') || clean.includes('<MPD xmlns=')) {
        return true;
    }
    try {
        const parsed = new URL(urlOrContent);
        if (parsed.pathname.toLowerCase().endsWith('.mpd')) {
            return true;
        }
    } catch {}
    return false;
}

/**
 * Parses an MPEG-DASH MPD XML document and extracts audio initialization & media segment URLs.
 */
export function parseDashMpd(manifestXml: string, manifestBaseUrl: string): DashManifestInfo {
    // 1. Locate Representation tag
    const repMatch = manifestXml.match(/<Representation\b([^>]+)>/i);
    const repAttrs = repMatch ? repMatch[1] : '';

    const codecsMatch = repAttrs.match(/codecs="([^"]+)"/i);
    const codecs = codecsMatch ? codecsMatch[1].toLowerCase() : 'flac';

    const mimeMatch = manifestXml.match(/mimeType="([^"]+)"/i);
    const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'audio/mp4';

    // 2. Locate SegmentTemplate
    const templateMatch = manifestXml.match(/<SegmentTemplate\b([^>]+)>/i);
    if (!templateMatch) {
        throw new Error('MPEG-DASH manifest is missing <SegmentTemplate>');
    }
    const templateAttrs = templateMatch[1];

    const initMatch = templateAttrs.match(/initialization="([^"]+)"/i);
    if (!initMatch) {
        throw new Error('MPEG-DASH <SegmentTemplate> missing initialization attribute');
    }
    const rawInit = unescapeXml(initMatch[1]);
    const initUrl = new URL(rawInit, manifestBaseUrl).toString();

    const mediaMatch = templateAttrs.match(/media="([^"]+)"/i);
    if (!mediaMatch) {
        throw new Error('MPEG-DASH <SegmentTemplate> missing media attribute');
    }
    const rawMedia = unescapeXml(mediaMatch[1]);

    const startNumMatch = templateAttrs.match(/startNumber="([^"]+)"/i);
    const startNumber = startNumMatch ? parseInt(startNumMatch[1], 10) : 1;

    const timescaleMatch = templateAttrs.match(/timescale="([^"]+)"/i);
    const timescale = timescaleMatch ? parseInt(timescaleMatch[1], 10) : 48000;

    // 3. Parse SegmentTimeline
    const timelineMatch = manifestXml.match(/<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/i);
    const segmentNumbers: number[] = [];

    if (timelineMatch) {
        const sRegex = /<S\b([^>]+?)\/?>/gi;
        let sMatch: RegExpExecArray | null;
        let currentNum = startNumber;

        while ((sMatch = sRegex.exec(timelineMatch[1])) !== null) {
            const attrs = sMatch[1];
            const dMatch = attrs.match(/d="([^"]+)"/i);
            const rMatch = attrs.match(/r="([^"]+)"/i);
            const duration = dMatch ? parseInt(dMatch[1], 10) : 0;
            const repeat = rMatch ? parseInt(rMatch[1], 10) : 0;

            const count = 1 + repeat;
            for (let i = 0; i < count; i++) {
                segmentNumbers.push(currentNum++);
            }
        }
    } else {
        // Fallback for duration / timescale calculation if SegmentTimeline is absent
        const durationMatch = templateAttrs.match(/duration="([^"]+)"/i);
        const presDurationMatch = manifestXml.match(/mediaPresentationDuration="PT(?:(\d+)M)?([\d.]+)S"/i);
        if (durationMatch && presDurationMatch) {
            const segDuration = parseInt(durationMatch[1], 10);
            const mins = presDurationMatch[1] ? parseInt(presDurationMatch[1], 10) : 0;
            const secs = parseFloat(presDurationMatch[2] || '0');
            const totalSecs = mins * 60 + secs;
            const segSecs = segDuration / timescale;
            const count = Math.ceil(totalSecs / segSecs);
            for (let i = 0; i < count; i++) {
                segmentNumbers.push(startNumber + i);
            }
        }
    }

    if (segmentNumbers.length === 0) {
        throw new Error('Unable to determine segment list from MPEG-DASH manifest');
    }

    return {
        timescale,
        startNumber,
        codecs,
        mimeType,
        initUrl,
        mediaUrlTemplate: rawMedia,
        segmentNumbers,
    };
}

/**
 * Builds the media segment URL for a given segment number.
 */
export function buildSegmentUrl(mediaTemplate: string, num: number, baseUrl: string): string {
    const formatted = mediaTemplate
        .replace(/\$Number%0(\d+)d\$/g, (_, width) => String(num).padStart(parseInt(width, 10), '0'))
        .replace(/\$Number\$/g, String(num));
    return new URL(formatted, baseUrl).toString();
}

/**
 * Executes FFmpeg to remux or copy audio from temporary container into destination audio file.
 */
export async function remuxWithFfmpeg(inputPath: string, outputPath: string, codec = 'flac'): Promise<void> {
    const isFlac = codec.toLowerCase().includes('flac');

    // 1. First attempt bitstream copy (-c:a copy)
    const copyArgs = ['-v', 'error', '-y', '-i', inputPath, '-c:a', 'copy', outputPath];
    const copySuccess = await new Promise<boolean>((resolve) => {
        const child = spawn('ffmpeg', copyArgs, { shell: false, windowsHide: true });
        const timer = setTimeout(() => {
            child.kill();
            resolve(false);
        }, 30000);

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve(code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024);
        });
        child.on('error', () => {
            clearTimeout(timer);
            resolve(false);
        });
    });

    if (copySuccess) {
        return;
    }

    // 2. Fallback: Remux/re-encode to target container/codec
    const fallbackArgs = isFlac
        ? ['-v', 'error', '-y', '-i', inputPath, '-c:a', 'flac', outputPath]
        : ['-v', 'error', '-y', '-i', inputPath, outputPath];

    const fallbackSuccess = await new Promise<boolean>((resolve) => {
        const child = spawn('ffmpeg', fallbackArgs, { shell: false, windowsHide: true });
        const timer = setTimeout(() => {
            child.kill();
            resolve(false);
        }, 60000);

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve(code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024);
        });
        child.on('error', () => {
            clearTimeout(timer);
            resolve(false);
        });
    });

    if (!fallbackSuccess) {
        throw new Error('FFmpeg failed to remux downloaded MPEG-DASH audio stream into final audio file');
    }
}

/**
 * Extracts FLAC stream header (dfLa box) from an initialization segment (0.mp4).
 */
export function extractFlacHeaderFromInitSegment(initSegment: Buffer): Buffer | null {
    const dflaIndex = initSegment.indexOf(Buffer.from('dfLa', 'ascii'));
    if (dflaIndex !== -1 && dflaIndex >= 4) {
        const boxSize = initSegment.readUInt32BE(dflaIndex - 4);
        const contentStart = dflaIndex + 8; // skip 'dfLa' (4B), version (1B), flags (3B)
        const contentEnd = dflaIndex - 4 + boxSize;
        if (contentEnd <= initSegment.length && contentStart < contentEnd) {
            const dflaPayload = initSegment.subarray(contentStart, contentEnd);
            if (dflaPayload.subarray(0, 4).toString('ascii') === 'fLaC') {
                return dflaPayload;
            }
            return Buffer.concat([Buffer.from('fLaC', 'ascii'), dflaPayload]);
        }
    }
    return null;
}

/**
 * Extracts media data (raw audio frames) from mdat boxes in a media segment.
 */
export function extractMdatPayload(segment: Buffer): Buffer {
    let offset = 0;
    const parts: Buffer[] = [];
    while (offset < segment.length - 8) {
        let boxSize = segment.readUInt32BE(offset);
        const boxType = segment.subarray(offset + 4, offset + 8).toString('ascii');
        let headerSize = 8;
        if (boxSize === 1) {
            if (offset + 16 > segment.length) break;
            boxSize = Number(segment.readBigUInt64BE(offset + 8));
            headerSize = 16;
        } else if (boxSize === 0) {
            boxSize = segment.length - offset;
        }

        if (boxType === 'mdat') {
            const end = Math.min(segment.length, offset + boxSize);
            parts.push(segment.subarray(offset + headerSize, end));
        }

        if (boxSize <= 0) break;
        offset += boxSize;
    }
    return parts.length > 0 ? Buffer.concat(parts) : segment;
}

/**
 * Extracts pure FLAC stream from DASH segments without FFmpeg or re-encoding.
 */
export function extractFlacFromDashSegments(initSegment: Buffer, mediaSegments: Buffer[]): Buffer {
    const header = extractFlacHeaderFromInitSegment(initSegment);
    if (!header) {
        // Fallback: concatenate container segments as-is
        return Buffer.concat([initSegment, ...mediaSegments]);
    }
    const frames = mediaSegments.map((seg) => extractMdatPayload(seg));
    return Buffer.concat([header, ...frames]);
}

/**
 * Downloads all segments of an MPEG-DASH audio stream and losslessly writes the final audio file
 * without using FFmpeg and without re-encoding the stream.
 */
export async function downloadDashAudioStream({
    manifestXml,
    manifestUrl,
    destinationPath,
    customHeaders,
    addonUrl,
    onProgress,
}: {
    manifestXml: string;
    manifestUrl: string;
    destinationPath: string;
    customHeaders?: Record<string, string>;
    addonUrl?: string;
    onProgress?: (current: number, total: number) => void;
}): Promise<{ destinationPath: string; sizeBytes: number; segmentsCount: number }> {
    const info = parseDashMpd(manifestXml, manifestUrl);
    const targetDir = path.dirname(destinationPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const isFlac = info.codecs.toLowerCase().includes('flac') && destinationPath.toLowerCase().endsWith('.flac');
    const tempFile = destinationPath + '.part';
    if (fs.existsSync(tempFile)) {
        try {
            fs.unlinkSync(tempFile);
        } catch {}
    }

    const writeStream = fs.createWriteStream(tempFile, { flags: 'a' });

    try {
        // 1. Download Initialization Segment (0.mp4)
        console.log(`[DASH:DOWNLOAD] Fetching init segment: ${info.initUrl}`);
        const initRes = await loggedFetch(
            info.initUrl,
            {
                headers: {
                    Accept: '*/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    ...(customHeaders || {}),
                },
                signal: AbortSignal.timeout(30000),
            },
            { action: 'dash-init-segment', targetAddon: addonUrl }
        );

        if (!initRes.ok) {
            throw new Error(`Failed to download DASH init segment (HTTP ${initRes.status})`);
        }

        const initBuffer = Buffer.from(await initRes.arrayBuffer());

        let extractAsFlac = false;
        if (isFlac) {
            const flacHeader = extractFlacHeaderFromInitSegment(initBuffer);
            if (flacHeader) {
                console.log(`[DASH:DOWNLOAD] Direct lossless FLAC extraction enabled (no FFmpeg re-encoding)`);
                writeStream.write(flacHeader);
                extractAsFlac = true;
            } else {
                writeStream.write(initBuffer);
            }
        } else {
            writeStream.write(initBuffer);
        }

        // 2. Download Media Segments (1..N) with batch concurrency (4 at a time)
        const total = info.segmentNumbers.length;
        console.log(`[DASH:DOWNLOAD] Downloading ${total} media segments for codec "${info.codecs}"...`);

        const BATCH_SIZE = 4;
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batchNumbers = info.segmentNumbers.slice(i, i + BATCH_SIZE);
            const batchPromises = batchNumbers.map(async (num) => {
                const segUrl = buildSegmentUrl(info.mediaUrlTemplate, num, manifestUrl);
                let attempts = 3;
                let lastError = '';

                while (attempts > 0) {
                    try {
                        const res = await loggedFetch(
                            segUrl,
                            {
                                headers: {
                                    Accept: '*/*',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                                    ...(customHeaders || {}),
                                },
                                signal: AbortSignal.timeout(30000),
                            },
                            { action: `dash-segment-${num}`, targetAddon: addonUrl }
                        );

                        if (res.status === 503 || res.status === 429) {
                            const retryAfter = parseInt(res.headers?.get('Retry-After') || '2', 10);
                            await new Promise((r) => setTimeout(r, Math.min(10, retryAfter) * 1000));
                            attempts--;
                            continue;
                        }

                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status}`);
                        }

                        const buf = Buffer.from(await res.arrayBuffer());
                        return { num, buf };
                    } catch (e: unknown) {
                        lastError = e instanceof Error ? e.message : 'Download failed';
                        attempts--;
                        await new Promise((r) => setTimeout(r, 1000));
                    }
                }
                throw new Error(`Segment ${num} failed after 3 attempts: ${lastError}`);
            });

            const results = await Promise.all(batchPromises);
            results.sort((a, b) => a.num - b.num);

            for (const res of results) {
                if (extractAsFlac) {
                    const rawFrames = extractMdatPayload(res.buf);
                    writeStream.write(rawFrames);
                } else {
                    writeStream.write(res.buf);
                }
            }

            onProgress?.(Math.min(i + BATCH_SIZE, total), total);
        }

        // Wait for file stream flush
        await new Promise<void>((resolve, reject) => {
            writeStream.end(() => resolve());
            writeStream.on('error', reject);
        });

        // Rename temp file to destination path directly (zero FFmpeg, bit-perfect lossless stream)
        if (fs.existsSync(destinationPath)) {
            try {
                fs.unlinkSync(destinationPath);
            } catch {}
        }
        fs.renameSync(tempFile, destinationPath);

        const finalStats = fs.statSync(destinationPath);
        console.log(`[DASH:DOWNLOAD] Download complete: ${destinationPath} (${(finalStats.size / (1024 * 1024)).toFixed(2)} MB, zero-encoded)`);

        return {
            destinationPath,
            sizeBytes: finalStats.size,
            segmentsCount: total,
        };
    } catch (err) {
        // Clean up partial files on failure
        try {
            writeStream.destroy();
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
        } catch {}
        throw err;
    }
}
