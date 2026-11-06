import { z } from 'zod';

import { parseDateOrNow, parseDateSafe } from '@/domain/media/date';

/**
 * Schema for the subset of file metadata extracted directly from the filesystem
 * during a directory crawl (stat-level info only, no database identity).
 *
 * Used by the scanner/crawler service to validate filesystem entries before
 * they are persisted to the `media_files` table via `audio-repository.ts`.
 * Extended by `mediaFileSchema` which adds database-level fields.
 */
export const extractedMediaFileSchema = z.object({
    path: z.string().min(1),
    filename: z.string().min(1),
    directory: z.string(),
    extension: z.string().min(1),
    sizeBytes: z.coerce.number().int().nonnegative().default(0),
    mtimeMs: z.coerce.number().int().default(0),

    updatedAt: z.preprocess(parseDateOrNow, z.date().default(() => new Date())),
});

/**
 * Full media file schema including database identity, hash digests, status flags,
 * and scan lifecycle timestamps. Extends `extractedMediaFileSchema`.
 *
 * Used by:
 * - `audio-repository.ts` — validates rows before INSERT/UPDATE into `media_files`.
 * - `trackDbRowInputSchema` — composes this as the `file` field for Track construction.
 * - `mappers.ts` — `buildTrackFromDb()` uses `MediaFileInput` for the `file` parameter.
 */
export const mediaFileSchema = extractedMediaFileSchema.extend({
    id: z.string().min(1),

    createdAt: z.preprocess(parseDateOrNow, z.date().default(() => new Date())),
    ctimeMs: z.coerce.number().int().nullable().optional(),
    birthtimeMs: z.coerce.number().int().nullable().optional(),

    fileHash: z.string().nullable().optional(),
    audioHash: z.string().nullable().optional(),

    isMissing: z.coerce.boolean().default(false),
    isReadOnly: z.coerce.boolean().default(false),
    isLocked: z.coerce.boolean().default(false),
    isCorrupt: z.coerce.boolean().default(false),
    isSymlink: z.coerce.boolean().default(false),

    scanStatus: z.string().nullable().optional(),
    scanError: z.string().nullable().optional(),

    lastScannedAt: z.preprocess(parseDateSafe, z.date().nullish()),
    lastVerifiedAt: z.preprocess(parseDateSafe, z.date().nullish()),
});

/**
 * Input type for `mediaFileSchema` — accepts raw data before defaults are applied.
 * Used by `mappers.ts` → `buildTrackFromDb()` to type the `file` parameter.
 */
export type MediaFileInput = z.input<typeof mediaFileSchema>;

/**
 * Output type for `mediaFileSchema` — all defaults applied, ready for DB persistence.
 * Used by `audio-repository.ts` to type validated file records.
 */
export type MediaFileOutput = z.infer<typeof mediaFileSchema>;
