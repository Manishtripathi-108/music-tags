import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray, or, like } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { audioFiles, canonicalAudioMetadata, rawAudioMetadata } from '@/infrastructure/database/schema';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { getExifTool } from '@/infrastructure/media-tools/exiftool';
import { RemoveFolderRequestSchema } from '@/schemas';
import { toExifToolWriteTags } from '@/domain/media/mappers';
import { type RemoveFolderApiResponse } from '@/domain/media/dto';

/**
 * Removes a scanned folder and its audio tracks from the database.
 * Does NOT delete the local files on disk. Optionally syncs modified metadata to files before database purging.
 */
export async function POST(
    request: NextRequest
): Promise<NextResponse<RemoveFolderApiResponse | { error: string; details?: unknown }>> {
    await ensureDatabaseInitialized();

    try {
        const body = await request.json();
        const validation = RemoveFolderRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid payload', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const { directory, syncBeforeDelete } = validation.data;

        // Match files in this folder or any subpaths
        const matchingFiles = await db
            .select()
            .from(audioFiles)
            .where(
                or(
                    eq(audioFiles.directory, directory),
                    like(audioFiles.path, `${directory}%`)
                )
            );

        if (matchingFiles.length === 0) {
            return NextResponse.json({
                success: true,
                removedCount: 0,
                syncedCount: 0,
                message: 'No tracks found in the specified folder.',
            });
        }

        const fileIds = matchingFiles.map((f) => f.id);
        let syncedCount = 0;

        // Optionally write current database metadata back to physical files before purging from DB
        if (syncBeforeDelete) {
            const metas = await db
                .select()
                .from(canonicalAudioMetadata)
                .where(inArray(canonicalAudioMetadata.fileId, fileIds));

            const metaMap = new Map(metas.map((m) => [m.fileId, m]));
            const exifTool = getExifTool();

            for (const file of matchingFiles) {
                const meta = metaMap.get(file.id);
                if (!meta) continue;

                const tagsToWrite = toExifToolWriteTags(meta);

                if (Object.keys(tagsToWrite).length > 0) {
                    try {
                        const written = await exifTool.writeTags(file.path, tagsToWrite, false);
                        if (written) syncedCount++;
                    } catch (err) {
                        console.error(`Failed to sync tags to file ${file.path}:`, err);
                    }
                }
            }
        }

        // Purge database records in foreign key order without deleting physical files
        await db.delete(canonicalAudioMetadata).where(inArray(canonicalAudioMetadata.fileId, fileIds));
        await db.delete(rawAudioMetadata).where(inArray(rawAudioMetadata.fileId, fileIds));
        await db.delete(audioFiles).where(inArray(audioFiles.id, fileIds));

        return NextResponse.json({
            success: true,
            removedCount: fileIds.length,
            syncedCount,
            message: `Removed ${fileIds.length} track(s) from database.${
                syncBeforeDelete ? ` Synced tags to ${syncedCount} file(s).` : ''
            } Physical files were preserved.`,
        });
    } catch (error) {
        console.error('Error removing folder from database:', error);
        return NextResponse.json(
            { error: 'Internal server error while removing folder from database' },
            { status: 500 }
        );
    }
}
