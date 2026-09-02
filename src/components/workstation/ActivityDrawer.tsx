'use client';

import React from 'react';

import Icon from '@/components/ui/Icon';
import { useAudioStore } from '@/store/audioStore';

export function ActivityDrawer() {
    const { activeScanJob, setActiveScanJob } = useAudioStore();

    if (!activeScanJob) return null;

    const { status, scannedFiles, extractedFiles, totalEstimated, filesPerSecond, errorMessage } = activeScanJob;

    const isScanning = status === 'SCANNING';
    const isExtracting = status === 'EXTRACTING';
    const isCompleted = status === 'COMPLETED';
    const isFailed = status === 'FAILED';

    const percent = totalEstimated > 0 ? Math.min(Math.round(((isExtracting ? extractedFiles : scannedFiles) / totalEstimated) * 100), 100) : 0;

    return (
        <div className="border-border bg-card text-foreground flex h-9 items-center justify-between border-t px-3 font-mono text-[11px] select-none">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <Icon
                    icon={isCompleted ? 'success' : isFailed ? 'warning' : 'loading'}
                    className={`h-3.5 w-3.5 shrink-0 ${isCompleted ? 'text-success' : isFailed ? 'text-destructive' : 'text-primary'}`}
                />

                <span className="text-foreground shrink-0 font-semibold tracking-wide uppercase">{status}:</span>

                <span className="text-muted-foreground truncate text-xs">
                    {isScanning && `Discovered ${scannedFiles.toLocaleString()} audio tracks... (${filesPerSecond} files/s)`}
                    {isExtracting &&
                        `Ingesting metadata: ${extractedFiles.toLocaleString()} / ${totalEstimated.toLocaleString()} tracks (${filesPerSecond}/s)`}
                    {isCompleted && `Ingestion completed (${scannedFiles.toLocaleString()} tracks in library)`}
                    {isFailed && (errorMessage || 'Scan encountered an issue')}
                </span>

                {(isScanning || isExtracting) && (
                    <div className="bg-muted hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full sm:block">
                        <div className="bg-primary h-full transition-all duration-200" style={{ width: `${percent}%` }} />
                    </div>
                )}
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-3">
                {(isScanning || isExtracting) && <span className="text-muted-foreground font-mono text-[10px]">{percent}%</span>}
                <button
                    onClick={() => setActiveScanJob(null)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-colors">
                    <Icon icon="close" className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

export default ActivityDrawer;
