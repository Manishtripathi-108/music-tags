import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/eclipse/[[...slug]]/route';

describe('Eclipse Music Addon API Route', () => {
    const makeRequest = (urlStr: string, headers: Record<string, string> = {}) => {
        return new NextRequest(new URL(urlStr, 'http://localhost:3000'), {
            headers: new Headers({
                host: 'localhost:3000',
                ...headers,
            }),
        });
    };

    it('handles OPTIONS preflight with complete CORS headers', async () => {
        const res = await OPTIONS();
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
        expect(res.headers.get('access-control-allow-methods')).toContain('GET');
        expect(res.headers.get('access-control-expose-headers')).toContain('Content-Range');
    });

    it('serves valid Eclipse Addon manifest on GET /manifest.json', async () => {
        const req = makeRequest('http://localhost:3000/api/eclipse/manifest.json');
        const context = { params: Promise.resolve({ slug: ['manifest.json'] }) };

        const res = await GET(req, context);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.id).toBe('com.metatagstudio.eclipse');
        expect(data.name).toBe('MetaTagStudio Music');
        expect(data.resources).toContain('search');
        expect(data.resources).toContain('stream');
        expect(data.resources).toContain('isrc');
        expect(data.resources).toContain('resolve');
        expect(data.contentType).toBe('music');
        expect(Array.isArray(data.catalogs)).toBe(true);
    });

    it('serves manifest when slug is empty', async () => {
        const req = makeRequest('http://localhost:3000/api/eclipse');
        const context = { params: Promise.resolve({ slug: [] }) };

        const res = await GET(req, context);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.id).toBe('com.metatagstudio.eclipse');
    });

    it('returns search results matching Eclipse specification', async () => {
        const req = makeRequest('http://localhost:3000/api/eclipse/search?q=Sway');
        const context = { params: Promise.resolve({ slug: ['search'] }) };

        const res = await GET(req, context);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(Array.isArray(data.tracks)).toBe(true);
        expect(Array.isArray(data.albums)).toBe(true);
        expect(Array.isArray(data.artists)).toBe(true);

        if (data.tracks.length > 0) {
            const track = data.tracks[0];
            expect(track).toHaveProperty('id');
            expect(track).toHaveProperty('title');
            expect(track).toHaveProperty('artist');
            expect(track).toHaveProperty('streamURL');
            expect(track.streamURL).toContain('/api/eclipse/audio/');
        }
    });

    it('resolves track stream metadata with codec and container specs', async () => {
        // Query for existing track in database
        const searchReq = makeRequest('http://localhost:3000/api/eclipse/search?q=*');
        const searchContext = { params: Promise.resolve({ slug: ['search'] }) };
        const searchRes = await GET(searchReq, searchContext);
        const searchData = await searchRes.json();

        if (searchData.tracks.length > 0) {
            const trackId = searchData.tracks[0].id;
            const streamReq = makeRequest(`http://localhost:3000/api/eclipse/stream/${trackId}`);
            const streamContext = { params: Promise.resolve({ slug: ['stream', trackId] }) };

            const streamRes = await GET(streamReq, streamContext);
            expect(streamRes.status).toBe(200);

            const streamData = await streamRes.json();
            expect(streamData.url).toContain(`/api/eclipse/audio/${trackId}`);
            expect(streamData.manifest).toBe('none');
            expect(streamData).toHaveProperty('format');
            expect(streamData).toHaveProperty('quality');
        }
    });

    it('handles ISRC resolution according to Eclipse section 7', async () => {
        const reqNotFound = makeRequest('http://localhost:3000/api/eclipse/resolve-isrc?isrc=NONEXISTENT123');
        const context = { params: Promise.resolve({ slug: ['resolve-isrc'] }) };

        const resNotFound = await GET(reqNotFound, context);
        expect(resNotFound.status).toBe(200);
        const dataNotFound = await resNotFound.json();
        expect(dataNotFound.trackId).toBeNull();
    });

    it('handles catalog listing with paging according to Eclipse catalog spec', async () => {
        const req = makeRequest('http://localhost:3000/api/eclipse/catalog/all-tracks?skip=0');
        const context = { params: Promise.resolve({ slug: ['catalog', 'all-tracks'] }) };

        const res = await GET(req, context);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(Array.isArray(data.items)).toBe(true);
        if (data.items.length > 0) {
            const item = data.items[0];
            expect(item).toHaveProperty('id');
            expect(item.type).toBe('track');
            expect(item).toHaveProperty('title');
            expect(item).toHaveProperty('durationMs');
        }
    });
});
