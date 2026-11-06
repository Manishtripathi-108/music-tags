import { z } from 'zod';

/**
 * Request body schema for `DELETE /api/duplicates` — resolves a duplicate
 * cluster by removing the specified track IDs, optionally deleting the
 * underlying files from disk.
 *
 * Used by:
 * - `app/api/duplicates/route.ts` — server-side request validation.
 */
export const ResolveDuplicatesRequestSchema = z.object({
    clusterId: z.string().optional(),
    removeTrackIds: z.array(z.string()).min(1, 'At least one track ID is required'),
    deleteFiles: z.boolean().default(false),
});

/** Inferred type for a validated resolve-duplicates request. */
export type ResolveDuplicatesRequest = z.infer<typeof ResolveDuplicatesRequestSchema>;
