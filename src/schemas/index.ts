/**
 * Barrel re-export for all Zod schemas, inferred types, and validation utilities.
 *
 * Schema architecture (dependency order):
 * 1. `common.schema` — regex constants + `coreFieldValidators` (foundation)
 * 2. `media-file.schema` — file-level DB schemas
 * 3. `raw-audio-metadata.schema` — raw tool output preservation
 * 4. `audio-metadata.schema` — canonical normalised metadata
 * 5. `track-output.schema` — DB row → Track domain transform
 * 6. `track-patch.schema` — API PATCH request validation (derives from #1)
 * 7. `tag-form.schema` — client-side form validation (derives from #1)
 * 8. `scan-request.schema` / `lyrics-request.schema` / `duplicates-request.schema` — API request schemas
 */
export * from './common.schema';
export * from './media-file.schema';
export * from './raw-audio-metadata.schema';
export * from './audio-metadata.schema';
export * from './track-output.schema';
export * from './tag-form.schema';
export * from './scan-request.schema';
export * from './lyrics-request.schema';
export * from './duplicates-request.schema';
