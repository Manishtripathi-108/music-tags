import { type Track, type RawTag } from './track';
import { type BinaryVerificationResult } from '@/infrastructure/media-tools/binary-status';

export interface TracksApiResponse {
    tracks: Track[];
    total: number;
}

export interface TrackDetailApiResponse {
    metadata: Track;
    rawTags: RawTag[];
}

export interface TrackPatchApiResponse {
    success: boolean;
    track?: Track;
    message?: string;
    error?: string;
}

export interface ScanApiResponse {
    success: boolean;
    jobId: string;
    message: string;
}

export interface StatusApiResponse {
    binaries: BinaryVerificationResult;
    allReady: boolean;
}

export interface RemoveFolderApiResponse {
    success: boolean;
    removedCount: number;
    syncedCount: number;
    message: string;
}

export interface NormalizeLrcApiResponse {
    success: boolean;
    trackId: string;
    normalizedLrc: string;
    lrcPath?: string;
    message: string;
}

export interface NormalizeAllLyricsApiResponse {
    success: boolean;
    jobId: string;
    message: string;
}

export interface ResolveDuplicatesApiResponse {
    success: boolean;
    removedCount: number;
    deletedFilesCount: number;
    message: string;
}
