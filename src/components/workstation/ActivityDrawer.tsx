'use client';

import { Progress } from '@ark-ui/react/Progress';

import Icon from '@/components/ui/Icon';
import { useAudioStore } from '@/store/audioStore';

export function ActivityDrawer() {
    const { activeScanJob, setActiveScanJob } = useAudioStore();

    if (!activeScanJob) return null;

    const { status, scannedFiles, extractedFiles, totalEstimated, filesPerSecond, errorMessage } = activeScanJob;

    const isScanning = status === 'SCANNING';
    const isExtracting = status === 'EXTRACTING';
    const isNormalizing = status === 'NORMALIZING';
    const isCompleted = status === 'COMPLETED';
    const isFailed = status === 'FAILED';

    const processedCount = isNormalizing ? scannedFiles : isExtracting ? extractedFiles : scannedFiles;
    const percent = totalEstimated > 0 ? Math.min(Math.round((processedCount / totalEstimated) * 100), 100) : 0;

    return (
        <div className="border-border bg-card text-foreground flex h-9 items-center justify-between border-t px-3 font-mono text-[11px] select-none">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <Icon
                    icon={isCompleted ? 'success' : isFailed ? 'warning' : 'loading'}
                    className={`size-3.5 shrink-0 ${isCompleted ? 'text-success' : isFailed ? 'text-destructive' : 'text-primary'}`}
                />

                <span className="text-foreground shrink-0 font-semibold tracking-wide uppercase">
                    {isNormalizing ? 'NORMALIZING LYRICS:' : `${status}:`}
                </span>

                <span className="text-muted-foreground truncate text-xs">
                    {isScanning && `Discovered ${scannedFiles.toLocaleString()} audio tracks... (${filesPerSecond} files/s)`}

                    {isExtracting &&
                        `Ingesting metadata: ${extractedFiles.toLocaleString()} / ${totalEstimated.toLocaleString()} tracks (${filesPerSecond}/s)`}

                    {isNormalizing && `Normalizing ${scannedFiles.toLocaleString()} / ${totalEstimated.toLocaleString()} lyrics...`}

                    {isCompleted && (errorMessage || `Completed (${scannedFiles.toLocaleString()} tracks in library)`)}

                    {isFailed && (errorMessage || 'Operation encountered an issue')}
                </span>

                {(isScanning || isExtracting || isNormalizing) && (
                    <Progress.Root
                        value={isScanning ? null : percent}
                        className="hidden min-w-0 flex-1 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
                        <Progress.Track className="bg-muted col-start-1 h-1.5 w-full overflow-hidden rounded-full">
                            <Progress.Range className="bg-primary h-full transition-all duration-200" />
                        </Progress.Track>

                        <Progress.ValueText className="text-muted-foreground col-start-2 text-right font-mono text-[10px]" />
                    </Progress.Root>
                )}
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-3">
                <button
                    onClick={() => setActiveScanJob(null)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-colors">
                    <Icon icon="close" className="size-3.5" />
                </button>
            </div>
        </div>
    );
}

export default ActivityDrawer;
