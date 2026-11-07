import { describe, expect, it } from 'vitest';
import {
    isTrackDolbyAtmos,
    formatEclipseTrackQuality,
    filterEclipseTracks,
    sortEclipseTracks,
} from '@/domain/remote-audio/eclipse-quality';
import { type EclipseTrack } from '@/app/api/eclipse/route';

describe('Eclipse Track Quality & Dolby Atmos Engine', () => {
    const trackDolby1: EclipseTrack = {
        id: '1',
        title: 'Dolby Song',
        artist: 'Artist A',
        isAtmos: true,
        format: 'eac3',
    };

    const trackDolby2: EclipseTrack = {
        id: '2',
        title: 'Atmos AudioModes',
        artist: 'Artist B',
        audioModes: ['STEREO', 'DOLBY_ATMOS'],
    };

    const trackHires1: EclipseTrack = {
        id: '3',
        title: 'Hi-Res 96k',
        artist: 'Artist C',
        format: 'FLAC 24-bit/96kHz',
        bitDepth: 24,
        sampleRate: 96000,
        isHiRes: true,
    };

    const trackHires2: EclipseTrack = {
        id: '4',
        title: 'Hi-Res 48k',
        artist: 'Artist D',
        audioQuality: 'HI_RES_LOSSLESS',
        format: 'FLAC',
        isHiRes: true,
    };

    const trackLossless: EclipseTrack = {
        id: '5',
        title: 'CD Quality',
        artist: 'Artist E',
        format: 'FLAC 16-bit/44.1kHz',
        audioQuality: 'LOSSLESS',
        bitDepth: 16,
        sampleRate: 44100,
    };

    const trackLossy: EclipseTrack = {
        id: '6',
        title: 'MP3 Song',
        artist: 'Artist F',
        format: 'MP3',
        audioQuality: '320 kbps',
    };

    const allTracks = [trackLossy, trackLossless, trackHires1, trackDolby1, trackHires2, trackDolby2];

    it('identifies Dolby Atmos tracks through multiple flags and formats', () => {
        expect(isTrackDolbyAtmos(trackDolby1)).toBe(true);
        expect(isTrackDolbyAtmos(trackDolby2)).toBe(true);
        expect(isTrackDolbyAtmos({ audioQuality: 'Dolby Atmos' })).toBe(true);
        expect(isTrackDolbyAtmos({ format: 'eac3-joc' })).toBe(true);
        expect(isTrackDolbyAtmos({ mediaMetadata: { tags: ['DOLBY_ATMOS'] } })).toBe(true);
        expect(isTrackDolbyAtmos(trackHires1)).toBe(false);
        expect(isTrackDolbyAtmos(trackLossless)).toBe(false);
    });

    it('extracts and formats exact 24-bit/96kHz and 24-bit/48kHz specs', () => {
        const q96 = formatEclipseTrackQuality(trackHires1);
        expect(q96.isHiRes).toBe(true);
        expect(q96.bitDepth).toBe(24);
        expect(q96.sampleRateHz).toBe(96000);
        expect(q96.displayQuality).toBe('24-bit / 96 kHz FLAC');
        expect(q96.badgeLabel).toBe('HI-RES');

        const q48 = formatEclipseTrackQuality(trackHires2);
        expect(q48.isHiRes).toBe(true);
        expect(q48.bitDepth).toBe(24);
        expect(q48.displayQuality).toContain('24-bit');
        expect(q48.badgeLabel).toBe('HI-RES');

        const qCd = formatEclipseTrackQuality(trackLossless);
        expect(qCd.isLossless).toBe(true);
        expect(qCd.bitDepth).toBe(16);
        expect(qCd.displayQuality).toBe('16-bit / 44.1 kHz FLAC');
        expect(qCd.badgeLabel).toBe('CD LOSSLESS');

        const qDolby = formatEclipseTrackQuality(trackDolby1);
        expect(qDolby.isDolbyAtmos).toBe(true);
        expect(qDolby.badgeLabel).toBe('DOLBY ATMOS');
    });

    it('filters tracks by quality tier accurately', () => {
        const dolbyOnly = filterEclipseTracks(allTracks, 'dolby');
        expect(dolbyOnly.length).toBe(2);
        expect(dolbyOnly.map((t) => t.id)).toEqual(['1', '2']);

        const hiresOnly = filterEclipseTracks(allTracks, 'hires');
        expect(hiresOnly.length).toBe(2);
        expect(hiresOnly.map((t) => t.id)).toEqual(['3', '4']);

        const losslessOnly = filterEclipseTracks(allTracks, 'lossless');
        expect(losslessOnly.length).toBe(1);
        expect(losslessOnly[0].id).toBe('5');

        const lossyOnly = filterEclipseTracks(allTracks, 'lossy');
        expect(lossyOnly.length).toBe(1);
        expect(lossyOnly[0].id).toBe('6');
    });

    it('sorts tracks with Dolby Atmos placed first at the top', () => {
        const sorted = sortEclipseTracks(allTracks, 'dolby', 'asc');
        // Both Dolby tracks should be at indices 0 and 1
        expect(isTrackDolbyAtmos(sorted[0])).toBe(true);
        expect(isTrackDolbyAtmos(sorted[1])).toBe(true);
        // Non-Dolby tracks follow
        expect(isTrackDolbyAtmos(sorted[2])).toBe(false);
    });

    it('sorts tracks by highest quality score (Dolby/Hi-Res > CD > Lossy)', () => {
        const sorted = sortEclipseTracks(allTracks, 'quality', 'asc');
        const scores = sorted.map((t) => formatEclipseTrackQuality(t).score);
        // Score order should be descending
        for (let i = 0; i < scores.length - 1; i++) {
            expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
    });
});
