import { describe, expect, it } from 'vitest';

import { formatLrcDuration, normalizeLrc } from '@/domain/lyrics/lrc-parser';

describe('formatLrcDuration', () => {
    it('formats positive seconds into mm:ss.xx', () => {
        expect(formatLrcDuration(243.15)).toBe('04:03.15');
        expect(formatLrcDuration(60)).toBe('01:00.00');
        expect(formatLrcDuration(9.5)).toBe('00:09.50');
    });

    it('returns empty string for null, undefined, NaN, or non-positive seconds', () => {
        expect(formatLrcDuration(null)).toBe('');
        expect(formatLrcDuration(undefined)).toBe('');
        expect(formatLrcDuration(0)).toBe('');
        expect(formatLrcDuration(-10)).toBe('');
        expect(formatLrcDuration(NaN)).toBe('');
    });
});

describe('normalizeLrc', () => {
    const track = {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        durationSeconds: 354.2,
    };

    it('successfully normalizes LRC content with generated headers and preserved timestamps', () => {
        const inputLrc = `[00:10.50]Is this the real life?
[00:15.20]Is this just fantasy?
[00:20.00]Caught in a landslide`;

        const result = normalizeLrc(track, inputLrc);
        expect(result.success).toBe(true);
        expect(result.preservedTimestampCount).toBe(3);
        expect(result.normalizedLrc).toContain('[ti:Bohemian Rhapsody]');
        expect(result.normalizedLrc).toContain('[al:A Night at the Opera]');
        expect(result.normalizedLrc).toContain('[ar:Queen]');
        expect(result.normalizedLrc).toContain('[length:05:54.20]');
        expect(result.normalizedLrc).toContain('[00:10.50]Is this the real life?');
    });

    it('replaces existing metadata header tags with canonical headers', () => {
        const inputLrc = `[ti:Old Title]
[ar:Old Artist]
[00:05.00]First line`;

        const result = normalizeLrc(track, inputLrc);
        expect(result.success).toBe(true);
        expect(result.normalizedLrc).toContain('[ti:Bohemian Rhapsody]');
        expect(result.normalizedLrc).not.toContain('[ti:Old Title]');
        expect(result.normalizedLrc).toContain('[00:05.00]First line');
    });

    it('fails when no timestamped lines are present', () => {
        const rawText = 'Just plain text lyrics without timestamps';
        const result = normalizeLrc(track, rawText);
        expect(result.success).toBe(false);
        expect(result.preservedTimestampCount).toBe(0);
        expect(result.error).toContain('No valid timestamped lyric lines detected');
    });

    it('fails when content is empty or invalid', () => {
        const result = normalizeLrc(track, '');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Empty or invalid LRC content');
    });
});
