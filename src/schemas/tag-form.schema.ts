import { z } from 'zod';

import { coreFieldValidators } from './common.schema';

/**
 * Client-side validation schema for the tag editing form in the
 * workstation inspector panel (`AudioInspector.tsx` → `TagFormTab.tsx`).
 *
 * Uses `coreFieldValidators` as the single source of truth for field
 * constraints. Numeric fields (`trackNumber`, `year`, `bpm`) use
 * `z.coerce.number().optional()` because they arrive as strings from
 * HTML inputs and need coercion before validation.
 *
 * Used by:
 * - `AudioInspector.tsx` — passed to `zodResolver(TagFormSchema)` for
 *   React Hook Form validation.
 */
export const TagFormSchema = z.object({
    title: coreFieldValidators.title,
    artist: coreFieldValidators.artist,
    albumArtist: coreFieldValidators.albumArtist,
    album: coreFieldValidators.album,
    discNumber: coreFieldValidators.discNumber,
    trackNumber: coreFieldValidators.trackNumber,
    releaseDate: coreFieldValidators.releaseDate,
    year: coreFieldValidators.year,
    bpm: coreFieldValidators.bpm,
    genre: coreFieldValidators.genre,
    initialKey: coreFieldValidators.initialKey,
    comment: coreFieldValidators.comment,
    composer: coreFieldValidators.composer,
    conductor: coreFieldValidators.conductor,
    lyricist: coreFieldValidators.lyricist,
    publisher: coreFieldValidators.publisher,
    label: coreFieldValidators.label,
    copyright: coreFieldValidators.copyright,
    isrc: coreFieldValidators.isrc,
    barcode: coreFieldValidators.barcode,
    catalogNumber: coreFieldValidators.catalogNumber,
    mood: coreFieldValidators.mood,
    rating: coreFieldValidators.rating,
    lyrics: coreFieldValidators.lyrics,
});

/**
 * Input type for `TagFormSchema` — represents the raw form values before
 * coercion (numbers may be empty strings from HTML inputs).
 *
 * Used by:
 * - `AudioInspector.tsx` — types the `useForm<TagFormValues>()` generic.
 * - `TagFormTab.tsx` — types the `onSubmit` callback parameter.
 */
export type TagFormValues = z.input<typeof TagFormSchema>;

/**
 * Default empty values for the tag form. Used as the initial form state
 * when no track is selected or metadata is unavailable.
 *
 * Used by `AudioInspector.tsx` as the fallback for `useMemo` form values.
 */
export const DEFAULT_TAG_FORM_VALUES: TagFormValues = {
    title: '',
    artist: '',
    albumArtist: '',
    album: '',
    trackNumber: '',
    discNumber: '',
    releaseDate: null,
    year: '',
    bpm: '',
    genre: '',
    initialKey: '',
    comment: '',
    composer: '',
    publisher: '',
    copyright: '',
    isrc: '',
    lyrics: '',
};

/**
 * Per-field validation schemas for inline (in-cell) editing in the track table.
 * Each entry maps a column key to the corresponding `coreFieldValidators` rule.
 *
 * Used by `trackTableFeatures.tsx` → `validateAndCommit()` to validate
 * single-field edits before dispatching the patch to the API.
 */
export const InlineEditSchemas = {
    title: coreFieldValidators.title,
    artist: coreFieldValidators.artist,
    album: coreFieldValidators.album,
    trackNumber: coreFieldValidators.trackNumber,
    discNumber: coreFieldValidators.discNumber,
    year: coreFieldValidators.year,
    releaseDate: coreFieldValidators.releaseDate,
    bpm: coreFieldValidators.bpm,
} as const;

/**
 * Union of field names that support inline editing in the track table.
 */
export type InlineEditField = keyof typeof InlineEditSchemas;
