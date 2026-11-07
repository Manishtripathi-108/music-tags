import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/eclipse/stream-proxy/route';
import { createMockStreamInfo } from '@/services/eclipse/dashDownloader';

describe('Eclipse Stream Proxy API Route', () => {
    it('returns 400 when url parameter is missing', async () => {
        const req = new NextRequest('http://localhost:3000/api/eclipse/stream-proxy');
        const res = await GET(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('Missing target url');
    });

    it('returns 400 when url is not http/https', async () => {
        const req = new NextRequest('http://localhost:3000/api/eclipse/stream-proxy?url=file:///etc/passwd');
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it('rewrites DASH MPD XML to proxy initialization and media segment URLs', async () => {
        const sampleXml = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet mimeType="audio/mp4">
      <Representation id="1" codecs="flac">
        <SegmentTemplate initialization="https://cdn.example.com/audio/0.mp4?token=abc&amp;v=1" media="https://cdn.example.com/audio/$Number$.mp4?token=abc" />
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

        // Mock global fetch for target URL
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({
                'content-type': 'application/dash+xml',
            }),
            text: async () => sampleXml,
        } as unknown as Response);

        try {
            const req = new NextRequest('http://localhost:3000/api/eclipse/stream-proxy?url=https://example.com/stream.mpd');
            const res = await GET(req);
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('application/dash+xml');
            expect(res.headers.get('access-control-allow-origin')).toBe('*');

            const body = await res.text();
            // initialization should point to /api/eclipse/stream-proxy?url=
            expect(body).toContain('initialization="/api/eclipse/stream-proxy?url=https%3A%2F%2Fcdn.example.com%2Faudio%2F0.mp4%3Ftoken%3Dabc%26v%3D1"');
            // media template should point to proxy while preserving $Number$ unencoded
            expect(body).toContain('media="/api/eclipse/stream-proxy?url=https%3A%2F%2Fcdn.example.com%2Faudio%2F$Number$.mp4%3Ftoken%3Dabc"');
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('streams progressive native FLAC when mode=stream', async () => {
        const sampleXml = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet mimeType="audio/mp4">
      <Representation id="FLAC_HIRES,48000,24" codecs="flac" bandwidth="1792546" audioSamplingRate="48000">
        <SegmentTemplate timescale="48000" initialization="https://cdn.example.com/audio/0.mp4" media="https://cdn.example.com/audio/$Number$.mp4" startNumber="1">
          <SegmentTimeline>
            <S d="48000" r="1" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

        // Construct mock init segment (0.mp4) with valid dfLa box
        const streamInfoData = createMockStreamInfo({
            sampleRate: 48000,
            channels: 2,
            bitsPerSample: 24,
        });
        const metaBlockHeader = Buffer.from([0x00, 0x00, 0x00, 34]);
        const dfLaPayload = Buffer.concat([metaBlockHeader, streamInfoData]);
        const dfLaBox = Buffer.concat([
            Buffer.from([0, 0, 0, 4 + 4 + 4 + dfLaPayload.length]),
            Buffer.from('dfLa', 'ascii'),
            Buffer.from([0, 0, 0, 0]),
            dfLaPayload,
        ]);
        const initSegment = Buffer.concat([Buffer.alloc(16), dfLaBox]);

        // Construct mock media segment (1.mp4) with valid FLAC sync header
        const validFlacFrame = Buffer.from([0xff, 0xf8, 0x11, 0x22, 0x33, 0x44]);
        const mdatBox = Buffer.concat([
            Buffer.from([0, 0, 0, 8 + validFlacFrame.length]),
            Buffer.from('mdat', 'ascii'),
            validFlacFrame,
        ]);

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation(async (input: string) => {
            if (input.includes('stream.mpd')) {
                return {
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/dash+xml' }),
                    text: async () => sampleXml,
                } as unknown as Response;
            }
            if (input.includes('0.mp4')) {
                return {
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'audio/mp4' }),
                    arrayBuffer: async () => new Uint8Array(initSegment).buffer,
                } as unknown as Response;
            }
            if (input.includes('1.mp4') || input.includes('2.mp4')) {
                return {
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'audio/mp4' }),
                    arrayBuffer: async () => new Uint8Array(mdatBox).buffer,
                } as unknown as Response;
            }
            return { ok: false, status: 404 } as unknown as Response;
        });

        try {
            const req = new NextRequest('http://localhost:3000/api/eclipse/stream-proxy?url=https://example.com/stream.mpd&mode=stream');
            const res = await GET(req);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('audio/flac');
            expect(res.headers.get('access-control-allow-origin')).toBe('*');

            // Read chunks from response body stream
            const reader = res.body?.getReader();
            expect(reader).toBeDefined();

            const chunk1 = await reader!.read();
            expect(chunk1.done).toBe(false);
            const chunk1Buf = Buffer.from(chunk1.value!);
            // First chunk must start with FLAC stream marker 'fLaC'
            expect(chunk1Buf.subarray(0, 4).toString('ascii')).toBe('fLaC');

            const chunk2 = await reader!.read();
            expect(chunk2.done).toBe(false);
            const chunk2Buf = Buffer.from(chunk2.value!);
            // Second chunk must contain audio frames with sync code 0xFFF8
            expect(chunk2Buf[0]).toBe(0xff);
            expect(chunk2Buf[1] & 0xfe).toBe(0xf8);
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('handles OPTIONS preflight with CORS headers', async () => {
        const res = await OPTIONS();
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
        expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    });
});
