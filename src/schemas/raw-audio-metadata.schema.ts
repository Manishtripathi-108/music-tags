import { z } from 'zod';

import { parseDateOrNow } from '@/domain/media/date';

/**
 * Schema for the raw (unparsed) tool output stored in the `raw_audio_metadata`
 * table. Preserves the original JSON blobs from ExifTool and FFprobe so
 * metadata can be re-extracted without re-reading files from disk.
 *
 * Used by:
 * - `audio-repository.ts` — validates raw metadata before INSERT/UPDATE
 *   into the `raw_audio_metadata` table.
 */
export const rawAudioMetadataSchema = z.object({
    fileId: z.string().min(1),

    exiftoolJson: z.string().nullish(),
    ffprobeJson: z.string().nullish(),

    extractionStatus: z.string().nullish(),
    extractionError: z.string().nullish(),

    createdAt: z.preprocess(parseDateOrNow, z.date().default(() => new Date())),
    updatedAt: z.preprocess(parseDateOrNow, z.date().default(() => new Date())),
});

/**
 * Pre-parse input type for raw audio metadata — `createdAt`/`updatedAt`
 * are optional (defaults applied by the schema).
 */
export type RawAudioMetadataInput = z.input<typeof rawAudioMetadataSchema>;

/**
 * Post-parse output type for raw audio metadata — timestamps guaranteed present.
 */
export type RawAudioMetadataOutput = z.infer<typeof rawAudioMetadataSchema>;
