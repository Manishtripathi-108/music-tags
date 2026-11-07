import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/eclipse/route';

describe('Eclipse Music Addon Client Route', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const createPostRequest = (body: Record<string, any>) => {
        return new NextRequest('http://localhost:3000/api/eclipse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    };

    it('returns error when addonUrl is missing', async () => {
        const req = createPostRequest({ action: 'manifest' });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('addonUrl');
    });

    it('fetches manifest from addon server', async () => {
        const mockManifest = {
            id: 'com.example.addon',
            name: 'Example Addon',
            version: '1.0.0',
            resources: ['search', 'stream', 'catalog', 'settings'],
            types: ['track'],
            settings: [
                { key: 'quality', type: 'select', label: 'Quality', default: 'high' },
            ],
            catalogs: [
                { id: 'top', type: 'track', name: 'Top Songs' },
            ],
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockManifest,
        } as Response);

        const req = createPostRequest({
            addonUrl: 'https://addon.example.com',
            action: 'manifest',
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.manifest.id).toBe('com.example.addon');
        expect(data.manifest.name).toBe('Example Addon');
        expect(global.fetch).toHaveBeenCalledWith(
            'https://addon.example.com/manifest.json',
            expect.objectContaining({
                headers: expect.objectContaining({ Accept: 'application/json' }),
            })
        );
    });

    it('forwards custom HTTP headers (e.g. Authorization, X-API-Key) in outbound addon requests', async () => {
        const mockManifest = {
            id: 'com.private.addon',
            name: 'Private Addon',
            version: '1.0.0',
            resources: ['search', 'stream'],
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockManifest,
        } as Response);

        const req = createPostRequest({
            addonUrl: 'https://addon.example.com',
            action: 'manifest',
            headers: {
                Authorization: 'Bearer test-token-12345',
                'X-Custom-Client': 'MusicTagsClient',
            },
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(global.fetch).toHaveBeenCalledWith(
            'https://addon.example.com/manifest.json',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-token-12345',
                    'X-Custom-Client': 'MusicTagsClient',
                    Accept: 'application/json',
                }),
            })
        );
    });

    it('extracts and surfaces detailed addon error responses and notice objects', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: async () =>
                JSON.stringify({
                    error: 'Invalid or expired API token',
                    notice: {
                        level: 'error',
                        title: 'Auth Rejected',
                        message: 'Please re-authenticate with a valid Bearer token',
                    },
                }),
        } as Response);

        const req = createPostRequest({
            addonUrl: 'https://addon.example.com',
            action: 'search',
            query: 'test query',
            headers: { Authorization: 'Bearer invalid-token' },
        });

        const res = await POST(req);
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data.error).toContain('Addon Error (401 Unauthorized): Invalid or expired API token');
        expect(data.notice).toEqual({
            level: 'error',
            title: 'Auth Rejected',
            message: 'Please re-authenticate with a valid Bearer token',
        });
    });

    it('executes search and appends settings query parameters', async () => {
        const mockSearch = {
            tracks: [
                { id: '101', title: 'Song 1', artist: 'Artist 1', duration: 200, format: 'flac' },
            ],
            albums: [],
            artists: [],
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockSearch,
        } as Response);

        const req = createPostRequest({
            addonUrl: 'https://addon.example.com',
            action: 'search',
            query: 'Kalyani',
            settings: { quality: 'lossless', region: 'US' },
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.tracks).toHaveLength(1);
        expect(data.tracks[0].title).toBe('Song 1');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://addon.example.com/search?quality=lossless&region=US&q=Kalyani'),
            expect.any(Object)
        );
    });

    it('resolves stream URL with settings query parameters', async () => {
        const mockStream = {
            url: 'https://cdn.example.com/stream/track_101.flac',
            format: 'flac',
            quality: 'lossless',
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockStream,
        } as Response);

        const req = createPostRequest({
            addonUrl: 'https://addon.example.com',
            action: 'stream',
            id: 'track_101',
            settings: { bitrate: '320' },
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.stream.url).toBe('https://cdn.example.com/stream/track_101.flac');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://addon.example.com/stream/track_101?bitrate=320'),
            expect.any(Object)
        );
    });

    it('resolves ISRC via resolve-isrc according to Eclipse section 7', async () => {
        const mockResolve = { trackId: 'track_999' };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockResolve,
        } as Response);

        const req = createPostRequest({
            addonUrl: 'https://addon.example.com',
            action: 'resolve-isrc',
            isrc: 'USRC12345678',
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.trackId).toBe('track_999');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://addon.example.com/resolve-isrc?isrc=USRC12345678'),
            expect.any(Object)
        );
    });

    it('fetches catalog shelves with skip parameter', async () => {
        const mockCatalog = {
            items: [
                { id: '1', title: 'Catalog Item 1', artist: 'Artist 1', type: 'track' },
            ],
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockCatalog,
        } as Response);

        const req = createPostRequest({
            addonUrl: 'https://addon.example.com',
            action: 'catalog',
            id: 'top-songs',
            skip: 100,
            settings: { quality: 'high' },
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://addon.example.com/catalog/top-songs?quality=high&skip=100'),
            expect.any(Object)
        );
    });
});
