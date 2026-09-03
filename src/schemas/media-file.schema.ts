import { z } from 'zod';

export const mediaFileSchema = z.object({
    id: z.string().min(1),
    path: z.string().min(1),
    filename: z.string().min(1),
    directory: z.string(),
    extension: z.string().min(1),

    sizeBytes: z.number().int().nonnegative(),
    mtimeMs: z.number().int(),
    ctimeMs: z.number().int().nullable(),
    birthtimeMs: z.number().int().nullable(),

    fileHash: z.string().nullable(),
    audioHash: z.string().nullable(),

    isMissing: z.boolean().default(false),
    isReadOnly: z.boolean().default(false),
    isLocked: z.boolean().default(false),
    isCorrupt: z.boolean().default(false),
    isSymlink: z.boolean().default(false),

    scanStatus: z.string().nullable(),
    scanError: z.string().nullable(),

    lastScannedAt: z.number().int().nullable(),
    lastVerifiedAt: z.number().int().nullable(),

    updatedAt: z
        .number()
        .int()
        .default(() => Date.now()),
});
