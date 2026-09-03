export type ScanJobStatus =
    | 'IDLE'
    | 'SCANNING'
    | 'EXTRACTING'
    | 'NORMALIZING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';

export interface BaseScanStats {
    status: ScanJobStatus;
    scannedFiles: number;
    extractedFiles: number;
    totalEstimated: number;
    filesPerSecond: number;
    indexedFiles?: number;
    currentDirectory?: string;
    errorMessage?: string;
}

export interface ScanJob extends BaseScanStats {
    jobId?: string;
    currentFile?: string;
}

export interface ScanProgressEvent extends BaseScanStats {
    jobId: string;
    currentFile?: string;
}
