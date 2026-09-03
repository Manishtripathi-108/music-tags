import { z } from 'zod';

/**
 * Validation schema for partial track metadata updates (PATCH /api/files/[id]/tags).
 */
export const TrackPatchSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(255).optional(),
    artist: z.string().trim().max(255).optional(),
    albumArtist: z.string().trim().max(255).optional(),
    album: z.string().trim().max(255).optional(),
    trackNumber: z.number().int().min(1).max(999).nullable().optional(),
    discNumber: z.number().int().min(1).max(99).nullable().optional(),
    year: z.number().int().min(1000).max(2099).nullable().optional(),
    releaseDate: z.string().trim().max(50).nullable().optional(),
    genre: z.string().trim().max(100).optional(),
    bpm: z.number().min(20).max(400).nullable().optional(),
    initialKey: z.string().trim().max(20).optional(),
    comment: z.string().trim().max(2000).optional(),
    composer: z.string().trim().max(255).nullable().optional(),
    conductor: z.string().trim().max(255).nullable().optional(),
    lyricist: z.string().trim().max(255).nullable().optional(),
    publisher: z.string().trim().max(255).nullable().optional(),
    label: z.string().trim().max(255).nullable().optional(),
    copyright: z.string().trim().max(255).nullable().optional(),
    isrc: z.string().trim().max(50).nullable().optional(),
    barcode: z.string().trim().max(50).nullable().optional(),
    catalogNumber: z.string().trim().max(50).nullable().optional(),
    mood: z.string().trim().max(100).nullable().optional(),
    rating: z.number().int().min(0).max(100).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    lyrics: z.string().max(50000).nullable().optional(),
    lyricsUnsynced: z.string().max(50000).nullable().optional(),
    lyricsSyncedJson: z.string().max(100000).nullable().optional(),
});

export type TrackPatch = z.infer<typeof TrackPatchSchema>;
