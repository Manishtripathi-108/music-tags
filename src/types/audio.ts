import { z } from 'zod';

export interface Track {
    id: string;
    filename: string;
    filePath?: string;
    title?: string;
    artist?: string;
    albumArtist?: string;
    album?: string;
    trackNumber?: number | null;
    discNumber?: number | null;
    year?: number | null;
    genre?: string;
    bpm?: number | null;
    initialKey?: string;
    comment?: string;
    durationSeconds?: number;
    bitrateKbps?: number;
    sampleRateHz?: number;
    channels?: number;
    channelLayout?: string;
    bitDepth?: number;
    codec?: string;
    extension: string;
    lossless?: boolean;
    hasCoverArt?: boolean;
}

export interface RawTag {
    tag: string;
    group: string;
    value: string | number;
}

export interface ActiveTrackDetail {
    metadata: Track | null;
    rawTags: RawTag[];
    isLoading: boolean;
}

export const ScanFolderRequestSchema = z.object({
    folderPath: z.string().min(1, 'Folder path is required'),
    recursive: z.boolean(),
    forceReindex: z.boolean(),
});

export type ScanFolderRequest = z.infer<typeof ScanFolderRequestSchema>;

export interface ScanJob {
    jobId?: string;
    status: 'IDLE' | 'SCANNING' | 'EXTRACTING' | 'COMPLETED' | 'FAILED';
    scannedFiles: number;
    extractedFiles: number;
    totalEstimated: number;
    filesPerSecond: number;
    errorMessage?: string;
}
