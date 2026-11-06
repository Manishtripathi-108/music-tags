import { z } from 'zod';

/**
 * Reusable validator for directory paths. Requires a non-empty string
 * and rejects `..` sequences to prevent directory traversal attacks.
 * Used by both `ScanFolderRequestSchema` and `RemoveFolderRequestSchema`.
 */
const directoryPathValidator = z.string().trim()
    .min(1, 'Directory path is required')
    .refine((val) => !val.includes('..'), 'Directory path cannot contain ".." to prevent directory traversal');

/**
 * Request body schema for `POST /api/scan` — initiates a folder scan job
 * that crawls the given directory for audio files.
 *
 * Used by:
 * - `app/api/scan/route.ts` — server-side request validation.
 * - `ScanModal.tsx` — client-side form validation via `zodResolver`.
 */
export const ScanFolderRequestSchema = z.object({
    folderPath: directoryPathValidator,
    recursive: z.boolean().default(true),
    forceReindex: z.boolean().default(false),
});

/** Inferred type for a validated scan folder request. */
export type ScanFolderRequest = z.infer<typeof ScanFolderRequestSchema>;

/**
 * Request body schema for `POST /api/folders/remove` — removes all
 * tracks belonging to a directory from the database.
 *
 * Used by:
 * - `app/api/folders/remove/route.ts` — server-side request validation.
 */
export const RemoveFolderRequestSchema = z.object({
    directory: directoryPathValidator,
    syncBeforeDelete: z.boolean().default(false),
});

/** Inferred type for a validated remove folder request. */
export type RemoveFolderRequest = z.infer<typeof RemoveFolderRequestSchema>;
