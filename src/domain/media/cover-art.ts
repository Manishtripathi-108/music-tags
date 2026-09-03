/**
 * Artwork metadata associated with an audio track.
 */
export interface CoverArtInfo {
    hasCoverArt?: boolean;
    coverArtMime?: string | null;
    coverArtWidth?: number | null;
    coverArtHeight?: number | null;
    coverArtType?: string | null;
    coverArtDescription?: string | null;
}
