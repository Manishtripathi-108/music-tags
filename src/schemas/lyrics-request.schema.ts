import { z } from 'zod';

/**
 * Request body schema for `POST /api/lyrics/normalize` — normalises
 * embedded LRC lyrics for a single track (re-formats timestamps,
 * strips invalid lines, writes back to the file).
 *
 * Used by:
 * - `app/api/lyrics/normalize/route.ts` — server-side request validation.
 */
export const NormalizeLrcRequestSchema = z.object({
    trackId: z.string().min(1, 'Track ID is required'),
    lrcContent: z.string().optional(),
});

/** Inferred type for a validated single-track LRC normalisation request. */
export type NormalizeLrcRequest = z.infer<typeof NormalizeLrcRequestSchema>;

/**
 * Request body schema for `POST /api/lyrics/normalize-all` — batch-normalises
 * lyrics across all tracks, optionally scoped to a folder.
 *
 * Used by:
 * - `app/api/lyrics/normalize-all/route.ts` — server-side request validation.
 */
export const NormalizeAllLyricsRequestSchema = z.object({
    folderPath: z.string().optional(),
});

/** Inferred type for a validated batch lyrics normalisation request. */
export type NormalizeAllLyricsRequest = z.infer<typeof NormalizeAllLyricsRequestSchema>;
