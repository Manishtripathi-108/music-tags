import { z } from 'zod';

export const NormalizeLrcRequestSchema = z.object({
    trackId: z.string().min(1, 'Track ID is required'),
    lrcContent: z.string().optional(),
});

export type NormalizeLrcRequest = z.infer<typeof NormalizeLrcRequestSchema>;

export const NormalizeAllLyricsRequestSchema = z.object({
    folderPath: z.string().optional(),
});

export type NormalizeAllLyricsRequest = z.infer<typeof NormalizeAllLyricsRequestSchema>;
