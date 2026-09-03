import { cleanMetadataString } from './normalization';

/**
 * Calculates Dice coefficient (0.0 to 1.0) using character bigrams.
 */
export function stringSimilarity(a: string, b: string): number {
    const strA = cleanMetadataString(a);
    const strB = cleanMetadataString(b);

    if (strA === strB) return 1.0;
    if (!strA || !strB) return 0.0;
    if (strA.length < 2 || strB.length < 2) return strA === strB ? 1.0 : 0.0;

    const getBigrams = (s: string) => {
        const bigrams = new Map<string, number>();
        for (let i = 0; i < s.length - 1; i++) {
            const bg = s.substring(i, i + 2);
            bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
        }
        return bigrams;
    };

    const bigramsA = getBigrams(strA);
    const bigramsB = getBigrams(strB);

    let intersection = 0;
    for (const [bg, countA] of bigramsA.entries()) {
        if (bigramsB.has(bg)) {
            intersection += Math.min(countA, bigramsB.get(bg)!);
        }
    }

    const totalA = strA.length - 1;
    const totalB = strB.length - 1;
    return (2.0 * intersection) / (totalA + totalB);
}
