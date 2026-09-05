import { cleanMetadataString } from './normalization';

const SOUNDEX_MAPPING: Record<string, string> = {
    B: '1',
    F: '1',
    P: '1',
    V: '1',
    C: '2',
    G: '2',
    J: '2',
    K: '2',
    Q: '2',
    S: '2',
    X: '2',
    Z: '2',
    D: '3',
    T: '3',
    L: '4',
    M: '5',
    N: '5',
    R: '6',
};

/**
 * Calculates American Soundex phonetic code for a single word with music digraph support.
 */
export function soundexWord(word: string): string {
    let clean = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (!clean) return '';

    // Phonetic digraph normalization for music titles and artist names
    clean = clean.replace(/^PH/, 'F').replace(/^KN/, 'N').replace(/^WR/, 'R').replace(/^X/, 'Z').replace(/^PS/, 'S').replace(/^GN/, 'N');

    let result = clean[0];
    let prevCode = SOUNDEX_MAPPING[clean[0]] || '';

    for (let i = 1; i < clean.length; i++) {
        const char = clean[i];
        const code = SOUNDEX_MAPPING[char] || '';

        if (code && code !== prevCode) {
            result += code;
            prevCode = code;
        } else if (!code) {
            prevCode = ''; // Vowels and unmapped letters separate identical codes
        }

        if (result.length === 4) break;
    }

    return result.padEnd(4, '0');
}

/**
 * Computes a multi-word phonetic signature of a string.
 */
export function phoneticSignature(str?: string | null): string {
    const cleaned = cleanMetadataString(str);
    if (!cleaned) return '';

    const words = cleaned.split(' ').filter((w) => w.length > 1);
    const codes = words.map(soundexWord).filter(Boolean);
    return Array.from(new Set(codes)).sort().join('-');
}
