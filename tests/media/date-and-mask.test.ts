import { describe, expect, it } from 'vitest';

import {
    CalendarDate,
    calendarDateToDate,
    dateToCalendarDate,
    deriveYearFromDate,
    formatDateToDDMMYYYY,
    formatDateToISO,
    normalizeReleaseDate,
    parseReleaseDate,
    REGEX_DD_MM_YYYY,
} from '@/domain/media/date';

describe('parseReleaseDate', () => {
    it('parses YYYY-MM-DD to Date', () => {
        const d = parseReleaseDate('2024-05-18');
        expect(d).toBeInstanceOf(Date);
        expect(d?.toISOString()).toBe('2024-05-18T00:00:00.000Z');
    });

    it('parses YYYY/MM/DD and YYYY:MM:DD to Date', () => {
        const d1 = parseReleaseDate('2024/05/18');
        const d2 = parseReleaseDate('2024:05:18');
        expect(d1?.toISOString()).toBe('2024-05-18T00:00:00.000Z');
        expect(d2?.toISOString()).toBe('2024-05-18T00:00:00.000Z');
    });

    it('parses DD-MM-YYYY and DD/MM/YYYY to Date', () => {
        const d1 = parseReleaseDate('18-05-2024');
        const d2 = parseReleaseDate('18/05/2024');
        expect(d1?.toISOString()).toBe('2024-05-18T00:00:00.000Z');
        expect(d2?.toISOString()).toBe('2024-05-18T00:00:00.000Z');
    });

    it('parses 4-digit year to Date (Jan 1st)', () => {
        const d = parseReleaseDate('2024');
        expect(d?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
        const dNum = parseReleaseDate(2024);
        expect(dNum?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('parses Date instances and CalendarDate objects', () => {
        const jsDate = new Date('2024-05-18T00:00:00.000Z');
        expect(parseReleaseDate(jsDate)).toBe(jsDate);

        const cal = new CalendarDate(2024, 5, 18);
        const parsedCal = parseReleaseDate(cal);
        expect(parsedCal?.toISOString()).toBe('2024-05-18T00:00:00.000Z');
    });

    it('returns null for empty or invalid inputs', () => {
        expect(parseReleaseDate('')).toBeNull();
        expect(parseReleaseDate(null)).toBeNull();
        expect(parseReleaseDate(undefined)).toBeNull();
        expect(parseReleaseDate('invalid-date')).toBeNull();
    });
});

describe('normalizeReleaseDate', () => {
    it('normalizes YYYY-MM-DD to DD-MM-YYYY', () => {
        expect(normalizeReleaseDate('2024-05-18')).toBe('18-05-2024');
        expect(normalizeReleaseDate('1999-12-31')).toBe('31-12-1999');
    });

    it('normalizes YYYY/MM/DD and YYYY:MM:DD to DD-MM-YYYY', () => {
        expect(normalizeReleaseDate('2024/05/18')).toBe('18-05-2024');
        expect(normalizeReleaseDate('2024:05:18')).toBe('18-05-2024');
    });

    it('preserves and pads already DD-MM-YYYY dates', () => {
        expect(normalizeReleaseDate('18-05-2024')).toBe('18-05-2024');
        expect(normalizeReleaseDate('5-6-2024')).toBe('05-06-2024');
    });

    it('normalizes DD/MM/YYYY to DD-MM-YYYY', () => {
        expect(normalizeReleaseDate('18/05/2024')).toBe('18-05-2024');
        expect(normalizeReleaseDate('01/01/2020')).toBe('01-01-2020');
    });

    it('normalizes 4-digit year to 01-01-YYYY', () => {
        expect(normalizeReleaseDate('2024')).toBe('01-01-2024');
        expect(normalizeReleaseDate('1984')).toBe('01-01-1984');
    });

    it('handles ISO 8601 timestamps', () => {
        expect(normalizeReleaseDate('2024-05-18T14:30:00Z')).toBe('18-05-2024');
    });

    it('returns null for empty or invalid inputs', () => {
        expect(normalizeReleaseDate('')).toBeNull();
        expect(normalizeReleaseDate(null)).toBeNull();
        expect(normalizeReleaseDate(undefined)).toBeNull();
        expect(normalizeReleaseDate('invalid-date')).toBeNull();
    });

    it('matches REGEX_DD_MM_YYYY regex', () => {
        const result = normalizeReleaseDate('2024-05-18');
        expect(result).not.toBeNull();
        expect(REGEX_DD_MM_YYYY.test(result!)).toBe(true);
        expect(REGEX_DD_MM_YYYY.test('18/05/2024')).toBe(true);
    });
});

describe('deriveYearFromDate', () => {
    it('extracts year from DD-MM-YYYY strings', () => {
        expect(deriveYearFromDate('18-05-2024')).toBe(2024);
        expect(deriveYearFromDate('01-01-1995')).toBe(1995);
    });

    it('extracts year from Date instances', () => {
        expect(deriveYearFromDate(new Date('2024-05-18T00:00:00.000Z'))).toBe(2024);
        expect(deriveYearFromDate(new Date('1995-01-01T00:00:00.000Z'))).toBe(1995);
    });

    it('extracts year from arbitrary date strings', () => {
        expect(deriveYearFromDate('2023-11-04')).toBe(2023);
        expect(deriveYearFromDate('2020')).toBe(2020);
    });

    it('returns null when no year found', () => {
        expect(deriveYearFromDate('')).toBeNull();
        expect(deriveYearFromDate(null)).toBeNull();
        expect(deriveYearFromDate('no-year')).toBeNull();
    });
});

describe('formatters and @internationalized/date bridge', () => {
    const d = new Date('2024-05-18T00:00:00.000Z');

    it('formats to DD/MM/YYYY and ISO', () => {
        expect(formatDateToDDMMYYYY(d)).toBe('18/05/2024');
        expect(formatDateToDDMMYYYY(d, '-')).toBe('18-05-2024');
        expect(formatDateToISO(d)).toBe('2024-05-18');
    });

    it('bridges between Date and CalendarDate', () => {
        const cal = dateToCalendarDate(d);
        expect(cal).not.toBeNull();
        expect(cal?.year).toBe(2024);
        expect(cal?.month).toBe(5);
        expect(cal?.day).toBe(18);

        const backToDate = calendarDateToDate(cal);
        expect(backToDate?.toISOString()).toBe('2024-05-18T00:00:00.000Z');
    });
});
