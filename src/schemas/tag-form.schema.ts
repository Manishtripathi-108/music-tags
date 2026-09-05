import { z } from 'zod';

import { coreFieldValidators } from './common.schema';

export const tagFieldValidators = coreFieldValidators;

export const TagFormSchema = z.object({
    title: tagFieldValidators.title,
    artist: tagFieldValidators.artist,
    albumArtist: tagFieldValidators.albumArtist,
    album: tagFieldValidators.album,
    trackNumber: tagFieldValidators.trackNumber,
    year: tagFieldValidators.year,
    bpm: tagFieldValidators.bpm,
    genre: tagFieldValidators.genre,
    initialKey: tagFieldValidators.initialKey,
    comment: tagFieldValidators.comment,
    composer: tagFieldValidators.composer,
    publisher: tagFieldValidators.publisher,
    copyright: tagFieldValidators.copyright,
    isrc: tagFieldValidators.isrc,
    lyrics: tagFieldValidators.lyrics,
});

export type TagFormValues = z.infer<typeof TagFormSchema>;

export const InlineEditSchemas = {
    title: tagFieldValidators.title,
    artist: tagFieldValidators.artist,
    album: tagFieldValidators.album,
    year: tagFieldValidators.year,
    bpm: tagFieldValidators.bpm,
} as const;

export type InlineEditField = keyof typeof InlineEditSchemas;
