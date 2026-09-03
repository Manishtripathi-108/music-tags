import { type Track } from '../media/track';

export type DuplicateMatchMode = 'all' | 'isrc' | 'hash' | 'exact_tags' | 'similar_tags' | 'phonetic';

export type DuplicateMatchReason = 'isrc' | 'file_hash' | 'exact_tags' | 'similar_tags' | 'phonetic';

export interface DuplicateTrackComparison {
    track: Track;
    isRecommendedKeeper: boolean;
    qualityScore: number;
    reasons: string[];
}

export interface DuplicateCluster {
    id: string;
    matchReason: DuplicateMatchReason;
    matchReasonLabel: string;
    confidence: number;
    displayTitle: string;
    displayArtist: string;
    tracks: DuplicateTrackComparison[];
}

export interface DuplicateFindOptions {
    mode: DuplicateMatchMode;
    similarityThreshold?: number;
    durationToleranceSec?: number;
    folderPath?: string;
}

export interface DuplicateFindApiResponse {
    clusters: DuplicateCluster[];
    totalDuplicateTracks: number;
    totalClusters: number;
    mode: DuplicateMatchMode;
}
