import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { audioFiles, canonicalAudioMetadata } from '@/infrastructure/database/schema';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { type TracksApiResponse } from '@/domain/media/dto';

export async function GET(): Promise<NextResponse<TracksApiResponse>> {
    await ensureDatabaseInitialized();

    try {
        const rows = await db
            .select()
            .from(audioFiles)
            .leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId));

        const tracks = rows.map(({ audio_files: file, canonical_audio_metadata: meta }) =>
            buildTrackFromDb(file, meta)
        );

        return NextResponse.json({
            tracks,
            total: tracks.length,
        });
    } catch (error) {
        console.error('Error fetching tracks from database:', error);
        return NextResponse.json(
            { tracks: [], total: 0 },
            { status: 500 }
        );
    }
}
