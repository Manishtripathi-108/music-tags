import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/infrastructure/database/client';
import { audioFiles } from '@/infrastructure/database/schema';
import { eq } from 'drizzle-orm';
import { extractCoverArt, THUMBNAIL_DIR } from '@/infrastructure/media-tools/ffmpeg';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
    await ensureDatabaseInitialized();
    const { id } = await context.params;
    const fileId = id.replace(/\.[^/.]+$/, '');

    const targetImage = path.join(THUMBNAIL_DIR, `${fileId}.jpg`);

    // 1. If cached thumbnail doesn't exist or is empty, attempt on-demand extraction
    if (!fs.existsSync(/*turbopackIgnore: true*/ targetImage) || fs.statSync(/*turbopackIgnore: true*/ targetImage).size === 0) {
        const rows = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);

        if (rows.length > 0) {
            const track = rows[0];
            await extractCoverArt(track.path, fileId);
        }
    }

    // 2. Serve image if now available
    if (fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
        try {
            const stats = fs.statSync(/*turbopackIgnore: true*/ targetImage);
            if (stats.size > 0) {
                const buffer = fs.readFileSync(/*turbopackIgnore: true*/ targetImage);
                // Check if buffer starts with PNG magic bytes (89 50 4E 47)
                const isPng = buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
                const contentType = isPng ? 'image/png' : 'image/jpeg';

                return new Response(buffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': String(stats.size),
                        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                });
            }
        } catch (err) {
            console.error(`[CoverArtAPI] Error reading cover for ${fileId}:`, err);
        }
    }

    return new Response('Cover art not found', { status: 404 });
}
