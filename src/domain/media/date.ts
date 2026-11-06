import { CalendarDate, type DateValue, parseDate } from '@internationalized/date';

export { CalendarDate, type DateValue, parseDate };

/**
 * Matches DD-MM-YYYY or DD/MM/YYYY date format (e.g. "18-05-2024", "18/05/2024", "01-01-2011").
 * Validates day (01-31), month (01-12), and year (1000-2099).
 */
export const REGEX_DD_MM_YYYY = /^(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](1\d{3}|20\d{2})$/;

/**
 * Normalizes any freeform date string, number, or Date representation into
 * a native JavaScript `Date` object (at UTC midnight) or `null`.
 *
 * Supported input variants:
 * - JavaScript Date instance
 * - CalendarDate / DateValue instance
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY (e.g. "18/05/2024", "18-05-2024")
 * - MM/DD/YYYY (e.g. "05/18/2024")
 * - YYYY-MM-DD, YYYY/MM/DD, YYYY:MM:DD (e.g. "2024:05:18 12:30:00")
 * - YYYY-MM (e.g. "2024-05" -> 2024-05-01)
 * - Single 4-digit year (e.g. "2024", 2024 -> 2024-01-01)
 * - Freeform text / ISO timestamps (e.g. "2024-05-18T00:00:00Z")
 *
 * @param dateInput - Raw input value from metadata or user entry.
 * @returns Date at UTC midnight or null if unparseable.
 */
export function parseReleaseDate(dateInput?: unknown): Date | null {
    if (dateInput === null || dateInput === undefined) return null;

    if (dateInput instanceof Date) {
        return isNaN(dateInput.getTime()) ? null : dateInput;
    }

    // Check if input is a DateValue / CalendarDate object
    if (
        typeof dateInput === 'object' &&
        dateInput !== null &&
        'year' in dateInput &&
        'month' in dateInput &&
        'day' in dateInput
    ) {
        const d = dateInput as { year: number; month: number; day: number };
        return new Date(Date.UTC(d.year, d.month - 1, d.day));
    }

    if (typeof dateInput === 'number') {
        if (dateInput >= 1000 && dateInput <= 2099) {
            return new Date(Date.UTC(dateInput, 0, 1));
        }
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? null : d;
    }

    const str = String(dateInput).trim();
    if (!str) return null;

    // 1. DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY or MM/DD/YYYY
    const separatedMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (separatedMatch) {
        const p1 = parseInt(separatedMatch[1], 10);
        const p2 = parseInt(separatedMatch[2], 10);
        const y = parseInt(separatedMatch[3], 10);

        let d = p1;
        let m = p2;
        // If second part is > 12 and first <= 12, input was MM/DD/YYYY
        if (p2 > 12 && p1 <= 12) {
            d = p2;
            m = p1;
        }

        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1000 && y <= 2099) {
            return new Date(Date.UTC(y, m - 1, d));
        }
    }

    // 2. YYYY-MM-DD, YYYY/MM/DD, YYYY:MM:DD (with optional timestamp)
    const yyyyMmDdMatch = str.match(/^(\d{4})[-/:.](\d{1,2})[-/:.](\d{1,2})/);
    if (yyyyMmDdMatch) {
        const y = parseInt(yyyyMmDdMatch[1], 10);
        const m = parseInt(yyyyMmDdMatch[2], 10);
        const d = parseInt(yyyyMmDdMatch[3], 10);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1000 && y <= 2099) {
            return new Date(Date.UTC(y, m - 1, d));
        }
    }

    // 3. YYYY-MM (e.g. "2024-05")
    const yyyyMmMatch = str.match(/^(\d{4})[-/:.](\d{1,2})$/);
    if (yyyyMmMatch) {
        const y = parseInt(yyyyMmMatch[1], 10);
        const m = parseInt(yyyyMmMatch[2], 10);
        if (m >= 1 && m <= 12 && y >= 1000 && y <= 2099) {
            return new Date(Date.UTC(y, m - 1, 1));
        }
    }

    // 4. Exact 4-digit year (e.g. "2024")
    const yearMatch = str.match(/^\b(1\d{3}|20\d{2})\b$/);
    if (yearMatch) {
        return new Date(Date.UTC(parseInt(yearMatch[1], 10), 0, 1));
    }

    // 5. JavaScript Date parsing fallback (handles ISO, RFC2822, etc.)
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getUTCFullYear();
        if (y >= 1000 && y <= 2099) {
            return new Date(Date.UTC(y, parsed.getUTCMonth(), parsed.getUTCDate()));
        }
    }

    // 6. Embedded 4-digit year fallback if present
    const extractYear = str.match(/\b(1\d{3}|20\d{2})\b/);
    if (extractYear) {
        return new Date(Date.UTC(parseInt(extractYear[1], 10), 0, 1));
    }

    return null;
}

/**
 * Formats a Date object to "DD-MM-YYYY" or "DD/MM/YYYY" string.
 */
export function formatDateToDDMMYYYY(date: Date | null | undefined, separator: '/' | '-' = '/'): string {
    if (!date || isNaN(date.getTime())) return '';
    const d = String(date.getUTCDate()).padStart(2, '0');
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${d}${separator}${m}${separator}${y}`;
}

/**
 * Formats a Date object to "YYYY-MM-DD" ISO date string.
 */
export function formatDateToISO(date: Date | null | undefined): string {
    if (!date || isNaN(date.getTime())) return '';
    const d = String(date.getUTCDate()).padStart(2, '0');
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${y}-${m}-${d}`;
}

/**
 * Normalizes any date input into canonical "DD-MM-YYYY" string or null if unparseable.
 * Kept for backwards compatibility across tests and existing consumers.
 */
export function normalizeReleaseDate(dateInput?: unknown): string | null {
    const parsed = parseReleaseDate(dateInput);
    if (!parsed) return null;
    return formatDateToDDMMYYYY(parsed, '-');
}

/**
 * Converts a JavaScript Date to an `@internationalized/date` CalendarDate.
 */
export function dateToCalendarDate(date: Date | null | undefined): CalendarDate | null {
    if (!date || isNaN(date.getTime())) return null;
    return new CalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Converts an `@internationalized/date` DateValue to a native JavaScript Date (UTC midnight).
 */
export function calendarDateToDate(calDate: DateValue | null | undefined): Date | null {
    if (!calDate) return null;
    return new Date(Date.UTC(calDate.year, calDate.month - 1, calDate.day));
}

/**
 * Extracts 4-digit year from a Date object or date string or returns null.
 */
export function deriveYearFromDate(dateInput: Date | string | number | null | undefined): number | null {
    if (dateInput === null || dateInput === undefined) return null;
    if (dateInput instanceof Date) {
        const y = dateInput.getUTCFullYear();
        return isNaN(y) || y < 1000 || y > 2099 ? null : y;
    }
    const match = String(dateInput).match(/\b(1\d{3}|20\d{2})\b/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Safely parses any date, timestamp number, or string representation into a valid Date or null.
 * Guarantees that an Invalid Date is never returned.
 */
export function parseDateSafe(val: unknown): Date | null {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
        const num = Number(val);
        if (!isNaN(num) && num > 100000) {
            const d = new Date(num);
            if (!isNaN(d.getTime())) return d;
        }
        return parseReleaseDate(val);
    }
    return null;
}

/**
 * Parses date or returns current date as fallback.
 */
export function parseDateOrNow(val: unknown): Date {
    const d = parseDateSafe(val);
    return d ?? new Date();
}
