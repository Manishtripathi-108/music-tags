import { z } from 'zod';

export const rawAudioMetadataSchema = z.object({
    fileId: z.string().min(1),

    exiftoolJson: z.string().nullable(),
    ffprobeJson: z.string().nullable(),

    extractionStatus: z.string().nullable(),
    extractionError: z.string().nullable(),

    createdAt: z.number().int(),
    updatedAt: z.number().int(),
});
