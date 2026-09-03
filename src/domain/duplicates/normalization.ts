/**
 * Cleans and normalizes a metadata string for robust duplicate comparison.
 * Strips punctuation, casing, accents, remaster tags, and common release/tag modifiers.
 */
export function cleanMetadataString(str?: string | null): string {
    if (!str) return '';

    let cleaned = str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Strip accents

    // Remove common media suffixes in brackets/parentheses
    cleaned = cleaned.replace(
        /\s*[\(\[](?:official\s*(?:video|audio|music\s*video)|lyric\s*video|lyrics|remastered|deluxe\s*(?:edition)?|explicit|clean|hq|audio)[\)\]]/gi,
        ''
    );

    // Remove feat./ft. portions from title to focus on core title
    cleaned = cleaned.replace(/\s*(?:feat\.?|featuring|ft\.?)\s+.*$/gi, '');

    // Replace non-alphanumeric characters with space
    cleaned = cleaned.replace(/[^a-z0-9]/g, ' ');

    // Collapse multiple spaces
    return cleaned.replace(/\s+/g, ' ').trim();
}
