import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/eclipse/stream-proxy/route';

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

    it('handles OPTIONS preflight with CORS headers', async () => {
        const res = await OPTIONS();
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
        expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    });
});
