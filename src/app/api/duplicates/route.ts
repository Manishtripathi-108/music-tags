import { NextRequest, NextResponse } from 'next/server';

import { eq, inArray } from 'drizzle-orm';
import fs from 'fs';

import { findDuplicates } from '@/domain/duplicates/duplicate-matcher';
import { type DuplicateFindApiResponse, type DuplicateMatchMode } from '@/domain/duplicates/types';
import { type ResolveDuplicatesApiResponse } from '@/domain/media/dto';
import { buildTrackFromDb } from '@/domain/media/mappers';
import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/infrastructure/database/schema';
import { ResolveDuplicatesRequestSchema } from '@/schemas';

export async function GET(request: NextRequest) {
    try {
        await ensureDatabaseInitialized();

        const searchParams = request.nextUrl.searchParams;
        const mode = (searchParams.get('mode') as DuplicateMatchMode) || 'all';
        const similarityThreshold = parseFloat(searchParams.get('threshold') || '0.85');
        const durationToleranceSec = parseFloat(searchParams.get('durationTolerance') || '5');
        const folderPath = searchParams.get('folder') || undefined;

        // Fetch tracks from database with joined metadata
        const rows = await db.select().from(audioFiles).leftJoin(canonicalAudioMetadata, eq(audioFiles.id, canonicalAudioMetadata.fileId));

        const tracks = rows.map(({ audio_files: file, canonical_audio_metadata: meta }) => buildTrackFromDb(file, meta));

        const clusters = findDuplicates(tracks, {
            mode,
            similarityThreshold,
            durationToleranceSec,
            folderPath,
        });

        const totalDuplicateTracks = clusters.reduce((acc, c) => acc + c.tracks.length, 0);

        const response: DuplicateFindApiResponse = {
            clusters,
            totalDuplicateTracks,
            totalClusters: clusters.length,
            mode,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error finding duplicates:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest): Promise<NextResponse<ResolveDuplicatesApiResponse | { error: string; details?: unknown }>> {
    try {
        await ensureDatabaseInitialized();

        const body = await request.json();
        const parsed = ResolveDuplicatesRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
        }

        const { removeTrackIds, deleteFiles } = parsed.data;

        // Fetch file paths if physical deletion requested
        let deletedFilesCount = 0;
        if (deleteFiles) {
            const filesToDelete = await db.select({ path: audioFiles.path }).from(audioFiles).where(inArray(audioFiles.id, removeTrackIds));

            for (const f of filesToDelete) {
                try {
                    if (fs.existsSync(f.path)) {
                        fs.unlinkSync(f.path);
                        deletedFilesCount++;
                    }
                } catch (err) {
                    console.error('Failed to delete file:', f.path, err);
                }
            }
        }

        // Remove from database
        await db.delete(canonicalAudioMetadata).where(inArray(canonicalAudioMetadata.fileId, removeTrackIds));
        await db.delete(rawAudioMetadata).where(inArray(rawAudioMetadata.fileId, removeTrackIds));
        await db.delete(audioFiles).where(inArray(audioFiles.id, removeTrackIds));

        return NextResponse.json({
            success: true,
            removedCount: removeTrackIds.length,
            deletedFilesCount,
            message: `Removed ${removeTrackIds.length} duplicate track(s) from database${
                deleteFiles ? ` and deleted ${deletedFilesCount} file(s)` : ''
            }`,
        });
    } catch (error) {
        console.error('Error resolving duplicates:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
