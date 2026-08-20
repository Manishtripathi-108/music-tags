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
        <div className="flex h-9 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-3 font-mono text-[11px] text-zinc-300 select-none">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                {isCompleted ? (
                    <Icon icon="success" className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : isFailed ? (
                    <Icon icon="warning" className="h-3.5 w-3.5 shrink-0 text-red-400" />
                ) : (
                    <Icon icon="loading" className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                )}

                <span className="shrink-0 font-semibold tracking-wide text-zinc-100 uppercase">{status}:</span>

                <span className="truncate text-xs text-zinc-400">
                    {isScanning && `Discovered ${scannedFiles.toLocaleString()} audio tracks... (${filesPerSecond} files/s)`}
                    {isExtracting &&
                        `Ingesting metadata: ${extractedFiles.toLocaleString()} / ${totalEstimated.toLocaleString()} tracks (${filesPerSecond}/s)`}
                    {isCompleted && `Ingestion completed (${scannedFiles.toLocaleString()} tracks in library)`}
                    {isFailed && (errorMessage || 'Scan encountered an issue')}
                </span>

                {(isScanning || isExtracting) && (
                    <div className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-zinc-800 sm:block">
                        <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${percent}%` }} />
                    </div>
                )}
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-3">
                {(isScanning || isExtracting) && <span className="font-mono text-[10px] text-zinc-500">{percent}%</span>}
                <button onClick={() => setActiveScanJob(null)} className="p-1 text-zinc-500 transition-colors hover:text-zinc-300">
                    <Icon icon="close" className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
