import { describe, expect, it } from 'vitest';

import {
    DEFAULT_TAG_FORM_VALUES,
    InlineEditSchemas,
    TagFormSchema,
} from '@/schemas';

describe('Tag Form Zod Schemas', () => {
    describe('DEFAULT_TAG_FORM_VALUES', () => {
        it('provides empty string defaults for all tag form fields', () => {
            expect(DEFAULT_TAG_FORM_VALUES).toEqual({
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
            });
        });
    });

    describe('TagFormSchema', () => {
        it('validates and coerces numeric string inputs', () => {
            const result = TagFormSchema.safeParse({
                title: 'Midnight City',
                artist: 'M83',
                albumArtist: 'M83',
                album: "Hurry Up, We're Dreaming",
                trackNumber: '5',
                year: '2011',
                bpm: '105.5',
                genre: 'Synthpop',
                initialKey: '8A',
                comment: 'Great track',
                composer: 'Anthony Gonzalez',
                publisher: 'Naïve',
                copyright: '© 2011 M83',
                isrc: 'FR-6V8-11-00001',
                lyrics: 'Waiting in a car...',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.trackNumber).toBe(5);
                expect(result.data.year).toBe(2011);
                expect(result.data.bpm).toBe(105.5);
                expect(result.data.title).toBe('Midnight City');
            }
        });

        it('rejects payload when required title is empty', () => {
            const result = TagFormSchema.safeParse({
                ...DEFAULT_TAG_FORM_VALUES,
                title: '',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                const titleIssue = result.error.issues.find((issue) => issue.path.includes('title'));
                expect(titleIssue).toBeDefined();
            }
        });

        it('accepts undefined for optional numeric fields', () => {
            const result = TagFormSchema.safeParse({
                title: 'Intro',
                artist: 'The xx',
                albumArtist: '',
                album: '',
                genre: '',
                initialKey: '',
                comment: '',
                composer: '',
                publisher: '',
                copyright: '',
                isrc: '',
                lyrics: '',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.trackNumber).toBeUndefined();
                expect(result.data.year).toBeUndefined();
                expect(result.data.bpm).toBeUndefined();
            }
        });

        it('validates releaseDate as Date and rejects strings', () => {
            const validDate = new Date(Date.UTC(2024, 4, 18));
            const validResult = TagFormSchema.safeParse({
                ...DEFAULT_TAG_FORM_VALUES,
                title: 'Valid Date Track',
                releaseDate: validDate,
            });
            expect(validResult.success).toBe(true);
            if (validResult.success) {
                expect(validResult.data.releaseDate).toBeInstanceOf(Date);
                expect(validResult.data.releaseDate?.getTime()).toBe(validDate.getTime());
            }

            const stringResult = TagFormSchema.safeParse({
                ...DEFAULT_TAG_FORM_VALUES,
                title: 'String Date Track',
                releaseDate: '18-05-2024',
            });
            expect(stringResult.success).toBe(false);

            const invalidResult = TagFormSchema.safeParse({
                ...DEFAULT_TAG_FORM_VALUES,
                title: 'Invalid Date Track',
                releaseDate: new Date('invalid'),
            });
            expect(invalidResult.success).toBe(false);

            const nullResult = TagFormSchema.safeParse({
                ...DEFAULT_TAG_FORM_VALUES,
                title: 'Null Date Track',
                releaseDate: null,
            });
            expect(nullResult.success).toBe(true);
        });

        it('validates discNumber', () => {
            const validResult = TagFormSchema.safeParse({
                ...DEFAULT_TAG_FORM_VALUES,
                title: 'Multi-disc Track',
                discNumber: '2',
            });
            expect(validResult.success).toBe(true);
            if (validResult.success) {
                expect(validResult.data.discNumber).toBe(2);
            }
        });
    });

    describe('InlineEditSchemas', () => {
        it('validates individual inline editable cell values', () => {
            expect(InlineEditSchemas.title.safeParse('Song Title').success).toBe(true);
            expect(InlineEditSchemas.title.safeParse('').success).toBe(false);

            expect(InlineEditSchemas.artist.safeParse('Artist Name').success).toBe(true);
            expect(InlineEditSchemas.album.safeParse('Album Name').success).toBe(true);

            expect(InlineEditSchemas.year.safeParse(2023).success).toBe(true);
            expect(InlineEditSchemas.year.safeParse('2023').success).toBe(true);
            expect(InlineEditSchemas.year.safeParse(999).success).toBe(false);
            expect(InlineEditSchemas.year.safeParse(2100).success).toBe(false);

            expect(InlineEditSchemas.discNumber.safeParse(1).success).toBe(true);
            expect(InlineEditSchemas.discNumber.safeParse('2').success).toBe(true);
            expect(InlineEditSchemas.discNumber.safeParse(0).success).toBe(false);

            expect(InlineEditSchemas.releaseDate.safeParse(new Date()).success).toBe(true);
            expect(InlineEditSchemas.releaseDate.safeParse(null).success).toBe(true);
            expect(InlineEditSchemas.releaseDate.safeParse('18-05-2024').success).toBe(false);
            expect(InlineEditSchemas.releaseDate.safeParse('invalid-date').success).toBe(false);

            expect(InlineEditSchemas.bpm.safeParse(128).success).toBe(true);
            expect(InlineEditSchemas.bpm.safeParse('128').success).toBe(true);
            expect(InlineEditSchemas.bpm.safeParse(10).success).toBe(false);
            expect(InlineEditSchemas.bpm.safeParse(500).success).toBe(false);
        });
    });
});
