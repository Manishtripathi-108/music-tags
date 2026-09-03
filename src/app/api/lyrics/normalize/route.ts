import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { audioFiles, canonicalAudioMetadata } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeTrackLrcFile } from '@/core/lyrics/lrcNormalizer';
import { NormalizeLrcRequestSchema, type NormalizeLrcApiResponse } from '@/types/audio';
import { ensureDatabaseInitialized } from '@/db/init';

export async function POST(
    request: NextRequest
): Promise<NextResponse<NormalizeLrcApiResponse | { error: string }>> {
    await ensureDatabaseInitialized();

    try {
        const body = await request.json();
        const validation = NormalizeLrcRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0]?.message || 'Invalid request payload' },
                { status: 400 }
            );
        }

        const { trackId, lrcContent } = validation.data;

        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(eq(audioFiles.id, trackId))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json({ error: 'Track not found' }, { status: 404 });
        }

        const file = rows[0].audio_files;
        const meta = rows[0].canonical_audio_metadata;

        const trackData = {
            id: file.id,
            filename: file.filename,
            filePath: file.path,
            title: meta?.title || file.filename.replace(/\.[^/.]+$/, ''),
            album: meta?.album || '',
            artist: meta?.artist || '',
            albumArtist: meta?.albumArtist || '',
            durationSeconds: meta?.durationSeconds || null,
            lyrics: meta?.lyrics || null,
        };

        const result = await normalizeTrackLrcFile(trackData, lrcContent);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to normalize LRC file' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            trackId: file.id,
            normalizedLrc: result.normalizedLrc || '',
            lrcPath: result.lrcPath,
            message: 'LRC normalized successfully and written to disk',
        });
    } catch (error) {
        console.error('Error normalizing track LRC:', error);
        return NextResponse.json(
            { error: 'Internal server error while normalizing LRC' },
            { status: 500 }
        );
    }
}
