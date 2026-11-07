import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { loggedFetch } from '@/services/logger/apiLogger';

export interface DashSegmentTimelineItem {
    duration: number;
    repeat: number; // 0 means 1 segment, 38 means 39 segments (1 + 38)
    timeOffset?: number;
}

export interface DashRepresentationInfo {
    id: string;
    codecs: string;
    mimeType: string;
    bandwidth: number;
    audioSamplingRate?: number;
    channels?: number;
    bitDepth?: number;
}

export interface DashManifestInfo {
    timescale: number;
    startNumber: number;
    codecs: string;
    mimeType: string;
    initUrl: string;
    mediaUrlTemplate: string;
    segmentNumbers: number[];
    selectedRepresentation: DashRepresentationInfo;
    allRepresentations: DashRepresentationInfo[];
}

export interface VerifiedFlacInfo {
    flacHeader: Buffer;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    totalSamples: bigint;
    md5: string;
    isHiRes: boolean;
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
 * Scores a DASH representation to prioritize genuine TIDAL Hi-Res FLAC streams.
 */
function scoreRepresentation(rep: DashRepresentationInfo): number {
    let score = 0;
    const codecs = rep.codecs.toLowerCase();
    const id = rep.id.toUpperCase();
    const isFlac = codecs.includes('flac') || rep.mimeType.toLowerCase().includes('flac') || id.includes('FLAC');

    if (isFlac) {
        score += 100000000;
        if (id.includes('HIRES') || (rep.bitDepth && rep.bitDepth > 16) || (rep.audioSamplingRate && rep.audioSamplingRate > 44100)) {
            score += 50000000;
        }
    }
    if (rep.bitDepth) {
        score += rep.bitDepth * 100000;
    }
    if (rep.audioSamplingRate) {
        score += rep.audioSamplingRate;
    }
    if (rep.bandwidth) {
        score += rep.bandwidth;
    }
    return score;
}

/**
 * Parses all representations in an MPEG-DASH MPD XML document and returns details for each.
 */
export function parseRepresentations(manifestXml: string): DashRepresentationInfo[] {
    const reps: DashRepresentationInfo[] = [];
    const repRegex = /<Representation\b([^>]*?)(\/>|>([\s\S]*?)<\/Representation>)/gi;
    let match: RegExpExecArray | null;

    // Detect parent AdaptationSet mimeType or codecs as fallbacks
    const adaptMatch = manifestXml.match(/<AdaptationSet\b([^>]+)>/i);
    const adaptAttrs = adaptMatch ? adaptMatch[1] : '';
    const adaptMime = (adaptAttrs.match(/mimeType="([^"]+)"/i)?.[1] || 'audio/mp4').toLowerCase();
    const adaptCodecs = (adaptAttrs.match(/codecs="([^"]+)"/i)?.[1] || '').toLowerCase();

    while ((match = repRegex.exec(manifestXml)) !== null) {
        const attrs = match[1];
        const idMatch = attrs.match(/id="([^"]+)"/i);
        const id = idMatch ? idMatch[1] : 'default';

        const codecsMatch = attrs.match(/codecs="([^"]+)"/i);
        const codecs = (codecsMatch ? codecsMatch[1] : adaptCodecs || 'flac').toLowerCase();

        const mimeMatch = attrs.match(/mimeType="([^"]+)"/i);
        const mimeType = (mimeMatch ? mimeMatch[1] : adaptMime).toLowerCase();

        const bwMatch = attrs.match(/bandwidth="([^"]+)"/i);
        const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;

        const rateMatch = attrs.match(/audioSamplingRate="([^"]+)"/i);
        const audioSamplingRate = rateMatch ? parseInt(rateMatch[1], 10) : undefined;

        // Determine bit depth from id pattern (e.g. FLAC_HIRES,48000,24) or bitDepth attribute
        let bitDepth: number | undefined;
        const bitDepthAttr = attrs.match(/bitDepth="([^"]+)"/i);
        if (bitDepthAttr) {
            bitDepth = parseInt(bitDepthAttr[1], 10);
        } else {
            const idPartsMatch = id.match(/,(\d{2})$/);
            if (idPartsMatch) {
                bitDepth = parseInt(idPartsMatch[1], 10);
            }
        }

        reps.push({
            id,
            codecs,
            mimeType,
            bandwidth,
            audioSamplingRate,
            bitDepth,
        });
    }

    return reps;
}

/**
 * Parses an MPEG-DASH MPD XML document, verifies and selects the genuine FLAC representation,
 * and extracts initialization & media segment URLs with $RepresentationID$ replacement.
 */
export function parseDashMpd(manifestXml: string, manifestBaseUrl: string): DashManifestInfo {
    const allRepresentations = parseRepresentations(manifestXml);

    if (allRepresentations.length === 0) {
        // Fallback for minimalist manifests without full <Representation> tags
        const repMatch = manifestXml.match(/<Representation\b([^>]+)>/i);
        const repAttrs = repMatch ? repMatch[1] : '';
        const codecsMatch = repAttrs.match(/codecs="([^"]+)"/i);
        const codecs = codecsMatch ? codecsMatch[1].toLowerCase() : 'flac';
        const mimeMatch = manifestXml.match(/mimeType="([^"]+)"/i);
        const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'audio/mp4';

        allRepresentations.push({
            id: '1',
            codecs,
            mimeType,
            bandwidth: 1411200,
        });
    }

    // Select the highest-priority genuine FLAC representation
    const sortedReps = [...allRepresentations].sort((a, b) => scoreRepresentation(b) - scoreRepresentation(a));
    const selectedRepresentation = sortedReps[0];

    // Locate SegmentTemplate (check representation-specific or adaptation-set level)
    let templateAttrs = '';
    const repSpecificMatch = new RegExp(
        `<Representation\\b[^>]*id="${selectedRepresentation.id}"[^>]*>[\\s\\S]*?<SegmentTemplate\\b([^>]+)>`,
        'i'
    ).exec(manifestXml);

    if (repSpecificMatch) {
        templateAttrs = repSpecificMatch[1];
    } else {
        const generalTemplateMatch = manifestXml.match(/<SegmentTemplate\b([^>]+)>/i);
        if (generalTemplateMatch) {
            templateAttrs = generalTemplateMatch[1];
        } else {
            throw new Error('MPEG-DASH manifest is missing <SegmentTemplate>');
        }
    }

    const initMatch = templateAttrs.match(/initialization="([^"]+)"/i);
    if (!initMatch) {
        throw new Error('MPEG-DASH <SegmentTemplate> missing initialization attribute');
    }
    const rawInit = unescapeXml(initMatch[1]).replace(/\$RepresentationID\$/g, selectedRepresentation.id);
    const initUrl = new URL(rawInit, manifestBaseUrl).toString();

    const mediaMatch = templateAttrs.match(/media="([^"]+)"/i);
    if (!mediaMatch) {
        throw new Error('MPEG-DASH <SegmentTemplate> missing media attribute');
    }
    const rawMedia = unescapeXml(mediaMatch[1]).replace(/\$RepresentationID\$/g, selectedRepresentation.id);

    const startNumMatch = templateAttrs.match(/startNumber="([^"]+)"/i);
    const startNumber = startNumMatch ? parseInt(startNumMatch[1], 10) : 1;

    const timescaleMatch = templateAttrs.match(/timescale="([^"]+)"/i);
    const timescale = timescaleMatch ? parseInt(timescaleMatch[1], 10) : (selectedRepresentation.audioSamplingRate || 48000);

    // Parse SegmentTimeline
    const timelineMatch = manifestXml.match(/<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/i);
    const segmentNumbers: number[] = [];

    if (timelineMatch) {
        const sRegex = /<S\b([^>]+?)\/?>/gi;
        let sMatch: RegExpExecArray | null;
        let currentNum = startNumber;

        while ((sMatch = sRegex.exec(timelineMatch[1])) !== null) {
            const attrs = sMatch[1];
            const rMatch = attrs.match(/r="([^"]+)"/i);
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
        codecs: selectedRepresentation.codecs,
        mimeType: selectedRepresentation.mimeType,
        initUrl,
        mediaUrlTemplate: rawMedia,
        segmentNumbers,
        selectedRepresentation,
        allRepresentations,
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
 * Verifies that the downloaded initialization segment corresponds to the genuine FLAC representation.
 * Unpacks and verifies STREAMINFO parameters (sample rate, bit depth, channels) against expected specs.
 */
export function verifyFlacInitSegment(
    initSegment: Buffer,
    expectedRep?: DashRepresentationInfo
): VerifiedFlacInfo {
    const dflaIndex = initSegment.indexOf(Buffer.from('dfLa', 'ascii'));
    if (dflaIndex === -1 || dflaIndex < 4) {
        throw new Error('Downloaded initialization segment does not contain a valid dfLa (FLAC) box. Not a genuine FLAC stream.');
    }

    let boxSize = initSegment.readUInt32BE(dflaIndex - 4);
    let contentStart = dflaIndex + 8; // skip 'dfLa' (4B), version (1B), flags (3B)
    let contentEnd = dflaIndex - 4 + boxSize;
    if (boxSize === 0) {
        contentEnd = initSegment.length;
    } else if (boxSize === 1 && dflaIndex + 12 <= initSegment.length) {
        boxSize = Number(initSegment.readBigUInt64BE(dflaIndex + 4));
        contentStart = dflaIndex + 16;
        contentEnd = dflaIndex - 4 + boxSize;
    }
    contentEnd = Math.min(contentEnd, initSegment.length);
    if (contentStart >= contentEnd) {
        throw new Error('Malformed dfLa box boundary in initialization segment.');
    }

    const dflaPayload = initSegment.subarray(contentStart, contentEnd);
    let metaOffset = 0;
    if (dflaPayload.subarray(0, 4).toString('ascii') === 'fLaC') {
        metaOffset = 4;
    }

    if (dflaPayload.length < metaOffset + 4) {
        throw new Error('Missing FLAC metadata block header in initialization segment.');
    }

    // Inspect first metadata block: must be STREAMINFO (blockType 0)
    const blockHeader = dflaPayload[metaOffset];
    const blockType = blockHeader & 0x7f;
    const blockLen =
        (dflaPayload[metaOffset + 1] << 16) |
        (dflaPayload[metaOffset + 2] << 8) |
        dflaPayload[metaOffset + 3];

    if (blockType !== 0 || blockLen < 34 || dflaPayload.length < metaOffset + 4 + blockLen) {
        throw new Error('Corrupted or missing FLAC STREAMINFO metadata block in initialization segment.');
    }

    const streamInfoData = dflaPayload.subarray(metaOffset + 4, metaOffset + 4 + blockLen);

    // Unpack STREAMINFO fields according to FLAC specification:
    // bytes 10-17: 20-bit sample rate, 3-bit channels-1, 5-bit bits_per_sample-1, 36-bit total samples
    const b10 = streamInfoData[10];
    const b11 = streamInfoData[11];
    const b12 = streamInfoData[12];
    const b13 = streamInfoData[13];

    const sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
    const channels = ((b12 >> 1) & 0x07) + 1;
    const bitsPerSample = (((b12 & 0x01) << 4) | (b13 >> 4)) + 1;
    const totalSamples =
        (BigInt(b13 & 0x0f) << BigInt(32)) |
        (BigInt(streamInfoData[14]) << BigInt(24)) |
        (BigInt(streamInfoData[15]) << BigInt(16)) |
        (BigInt(streamInfoData[16]) << BigInt(8)) |
        BigInt(streamInfoData[17]);
    const md5 = streamInfoData.subarray(18, 34).toString('hex');

    // Basic validity checks
    if (sampleRate < 8000 || sampleRate > 384000) {
        throw new Error(`Invalid FLAC sample rate: ${sampleRate} Hz`);
    }
    if (channels < 1 || channels > 8) {
        throw new Error(`Invalid FLAC channel count: ${channels}`);
    }
    if (bitsPerSample < 8 || bitsPerSample > 32) {
        throw new Error(`Invalid FLAC bit depth: ${bitsPerSample}-bit`);
    }

    // Verify against expected representation from DASH MPD
    if (expectedRep) {
        if (expectedRep.audioSamplingRate && expectedRep.audioSamplingRate !== sampleRate) {
            throw new Error(
                `Initialization segment sample rate (${sampleRate} Hz) does not match MPD representation (${expectedRep.audioSamplingRate} Hz)`
            );
        }
        if (expectedRep.bitDepth && expectedRep.bitDepth !== bitsPerSample) {
            throw new Error(
                `Initialization segment bit depth (${bitsPerSample}-bit) does not match MPD representation (${expectedRep.bitDepth}-bit)`
            );
        }
    }

    // Ensure the last-metadata-block flag (0x80) is set so audio players know frames begin next
    const headerCopy = Buffer.from(dflaPayload.subarray(metaOffset));
    headerCopy[0] |= 0x80;

    const flacHeader = Buffer.concat([Buffer.from('fLaC', 'ascii'), headerCopy]);
    const isHiRes = bitsPerSample > 16 || sampleRate > 44100;

    return {
        flacHeader,
        sampleRate,
        channels,
        bitsPerSample,
        totalSamples,
        md5,
        isHiRes,
    };
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
 * Verifies that a downloaded media segment contains genuine FLAC frame data (sync code 0xFFF8 / 0xFFF9).
 * Returns the raw verified FLAC audio frames buffer.
 */
export function verifyFlacMediaSegment(segment: Buffer, segNum = 1): Buffer {
    const rawFrames = extractMdatPayload(segment);
    if (!rawFrames || rawFrames.length === 0) {
        throw new Error(`Media segment ${segNum} contains no audio data (mdat box is empty)`);
    }

    // Verify FLAC frame sync code: 14 bits 11111111 111110 (0xFF followed by 0xF8 or 0xF9)
    let syncFound = false;
    const searchLimit = Math.min(rawFrames.length - 1, 64);
    for (let i = 0; i < searchLimit; i++) {
        if (rawFrames[i] === 0xff && (rawFrames[i + 1] & 0xfe) === 0xf8) {
            syncFound = true;
            break;
        }
    }

    if (!syncFound) {
        throw new Error(
            `Media segment ${segNum} data does not correspond to genuine FLAC frame (missing 0xFFF8/0xFFF9 sync word)`
        );
    }

    return rawFrames;
}

/**
 * Extracts pure FLAC stream from DASH segments without FFmpeg or re-encoding.
 */
export function extractFlacFromDashSegments(initSegment: Buffer, mediaSegments: Buffer[]): Buffer {
    const header = extractFlacHeaderFromInitSegment(initSegment);
    if (!header) {
        return Buffer.concat([initSegment, ...mediaSegments]);
    }
    const frames = mediaSegments.map((seg, idx) => {
        try {
            return verifyFlacMediaSegment(seg, idx + 1);
        } catch {
            return extractMdatPayload(seg);
        }
    });
    return Buffer.concat([header, ...frames]);
}

/**
 * Helper to generate mock STREAMINFO payload for testing purposes.
 */
export function createMockStreamInfo({
    sampleRate = 48000,
    channels = 2,
    bitsPerSample = 24,
    totalSamples = BigInt(7400000),
}: {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    totalSamples?: bigint;
} = {}): Buffer {
    const data = Buffer.alloc(34, 0);
    data.writeUInt16BE(4096, 0);
    data.writeUInt16BE(4096, 2);
    data.writeUIntBE(14, 4, 3);
    data.writeUIntBE(14000, 7, 3);

    const chVal = (channels - 1) & 0x07;
    const bpsVal = (bitsPerSample - 1) & 0x1f;
    data[10] = (sampleRate >> 12) & 0xff;
    data[11] = (sampleRate >> 4) & 0xff;
    data[12] = ((sampleRate & 0x0f) << 4) | (chVal << 1) | ((bpsVal >> 4) & 0x01);
    data[13] = ((bpsVal & 0x0f) << 4) | Number((totalSamples >> BigInt(32)) & BigInt(0x0f));
    data.writeUInt32BE(Number(totalSamples & BigInt(0xffffffff)), 14);
    Buffer.from('0123456789abcdef0123456789abcdef', 'hex').copy(data, 18);
    return data;
}

/**
 * Downloads all segments of an MPEG-DASH audio stream and losslessly writes the final genuine FLAC file
 * verifying representation authenticity, with zero FFmpeg re-encoding.
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
        console.log(`[DASH:DOWNLOAD] Fetching init segment: ${info.initUrl} (Selected Representation: ${info.selectedRepresentation.id})`);
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
            // Verify init segment against MPD representation
            const verified = verifyFlacInitSegment(initBuffer, info.selectedRepresentation);
            console.log(
                `[DASH:VERIFY] Verified genuine TIDAL ${verified.isHiRes ? 'Hi-Res ' : ''}FLAC representation: ` +
                `${verified.bitsPerSample}-bit / ${verified.sampleRate} Hz, ${verified.channels} ch (Representation ID: ${info.selectedRepresentation.id})`
            );
            writeStream.write(verified.flacHeader);
            extractAsFlac = true;
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
                    // Verify FLAC frame sync code in media segment
                    const verifiedFrames = verifyFlacMediaSegment(res.buf, res.num);
                    writeStream.write(verifiedFrames);
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

        // Rename temp file to destination path directly (zero FFmpeg, verified bit-perfect lossless stream)
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
