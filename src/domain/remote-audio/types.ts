import { type Track } from '@/domain/media/track';

export interface RemoteTrackSummary {
    id: string;
    title: string;
    artist?: string;
    album?: string;
    duration?: number;
    artworkURL?: string;
    format?: string;
    audioQuality?: string;
    atmos?: boolean;
    audioModes?: string[];
    streamURL?: string;
}

export interface RemoteStreamInfo {
    url: string;
    format?: string;
    quality?: string;
    codec?: string;
    container?: string;
    manifest?: string;
    encrypted?: boolean;
    sampleRate?: number;
    bitDepth?: number;
    bitrate?: number;
    audioMode?: string;
    error?: string;
}

export interface AudioQualityTier {
    isLossless: boolean;
    bitDepth: number | null;
    sampleRateHz: number | null;
    bitrateKbps: number | null;
    isDolbyAtmos: boolean;
    codec: string;
    score: number;
    label: string;
}

export type AudioComparisonStatus =
    | 'upgrade_available'
    | 'dolby_available'
    | 'same_quality'
    | 'local_higher'
    | 'no_match'
    | 'not_searched';

export interface RemoteTrackMatchRecord {
    id: string;
    localTrackId: string;
    providerUrl: string;
    remoteTrackId: string;
    title: string | null;
    artist: string | null;
    album: string | null;
    duration: number | null;
    artworkUrl: string | null;
    format: string | null;
    audioQuality: string | null;
    isDolby: boolean;
    hasDolby: boolean;
    qualityScore: number | null;
    streamUrl: string | null;
    rawSearchJson: string | null;
    rawStreamJson: string | null;
    downloadStatus: 'idle' | 'downloading' | 'completed' | 'failed';
    downloadError: string | null;
    downloadPath: string | null;
    downloadedAt: Date | null;
    lastCheckedAt: Date | null;
}

export interface AudioComparisonItem {
    localTrack: Track;
    cachedMatch: RemoteTrackMatchRecord | null;
    remoteTrack: RemoteTrackSummary | null;
    localQuality: AudioQualityTier;
    remoteQuality: AudioQualityTier | null;
    status: AudioComparisonStatus;
    statusMessage: string;
    isDolbyAvailable: boolean;
    canDownloadLossless: boolean;
    canDownloadDolby: boolean;
    candidates?: RemoteTrackSummary[];
}

export interface RemoteApiConfig {
    apiUrl: string;
    downloadDirectory: string;
    qualityPreference: 'max' | 'hires' | 'lossless' | 'high' | 'low';
    atmosPreference: 'auto' | 'none';
    customParams: Record<string, string>;
    downloadMode: 'highest_lossless' | 'dolby_atmos';
    forceRefetch: boolean;
}
