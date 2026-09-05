import { z } from 'zod';

export const extractedMediaFileSchema = z.object({
    path: z.string().min(1),
    filename: z.string().min(1),
    directory: z.string(),
    extension: z.string().min(1),
    sizeBytes: z.coerce.number().int().nonnegative(),
    mtimeMs: z.coerce.number().int(),

    updatedAt: z.coerce
        .number()
        .int()
        .default(() => Date.now()),
});

export const mediaFileSchema = extractedMediaFileSchema.extend({
    id: z.string().min(1),

    ctimeMs: z.coerce.number().int().nullable(),
    birthtimeMs: z.coerce.number().int().nullable(),

    fileHash: z.string().nullable(),
    audioHash: z.string().nullable(),

    isMissing: z.coerce.boolean().default(false),
    isReadOnly: z.coerce.boolean().default(false),
    isLocked: z.coerce.boolean().default(false),
    isCorrupt: z.coerce.boolean().default(false),
    isSymlink: z.coerce.boolean().default(false),

    scanStatus: z.string().nullable(),
    scanError: z.string().nullable(),

    lastScannedAt: z.coerce.number().int().nullable(),
    lastVerifiedAt: z.coerce.number().int().nullable(),
});
