'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { useCompareStore } from '@/store/compareStore';

export function CompareProgressBar() {
    const {
        isSearching,
        searchProgress,
        isDownloading,
        downloadProgress,
        connectionStatus,
        operationErrors,
        isErrorDrawerOpen,
        setIsErrorDrawerOpen,
        clearOperationErrors,
        dismissOperationError,
        retryOperation,
    } = useCompareStore();

    const hasErrors = operationErrors.length > 0;

    if (!isSearching && !isDownloading && !connectionStatus && !hasErrors) {
        return null;
    }

    return (
        <div className="bg-muted/30 border-b select-none text-xs font-mono">
            <div className="px-3 py-2 space-y-1.5">
                {/* Connection feedback */}
                {connectionStatus && !isSearching && !isDownloading && (
                    <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                            <span className={`inline-block size-2 rounded-full ${connectionStatus.apiOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>API: {connectionStatus.apiMessage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-block size-2 rounded-full ${connectionStatus.directoryOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>Directory: {connectionStatus.directoryMessage}</span>
                        </div>
                    </div>
                )}

                {/* Live Search Progress */}
                {isSearching && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-primary font-semibold">
                                <Icon icon="loading" className="size-3.5 animate-spin" />
                                <span>Sequential Search in progress...</span>
                                <span className="text-muted-foreground truncate max-w-xs">"{searchProgress.currentTitle}"</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span>
                                    {searchProgress.current} / {searchProgress.total} (
                                    {searchProgress.total > 0 ? Math.round((searchProgress.current / searchProgress.total) * 100) : 0}%)
                                </span>
                                {hasErrors && (
                                    <button
                                        type="button"
                                        onClick={() => setIsErrorDrawerOpen(!isErrorDrawerOpen)}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 cursor-pointer transition-colors"
                                    >
                                        <Icon icon="warning" className="size-3" />
                                        <span>Errors: {operationErrors.length}</span>
                                        <span className="text-[10px] underline">({isErrorDrawerOpen ? 'Hide' : 'View'})</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-primary h-full transition-all duration-300"
                                style={{
                                    width: `${searchProgress.total > 0 ? (searchProgress.current / searchProgress.total) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Live Download Progress */}
                {isDownloading && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-purple-400 font-semibold">
                                <Icon icon="loading" className="size-3.5 animate-spin" />
                                <span>Sequential Stream Download in progress...</span>
                                <span className="text-muted-foreground truncate max-w-xs">{downloadProgress.currentFileName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span>
                                    {downloadProgress.current} / {downloadProgress.total} (
                                    {downloadProgress.total > 0 ? Math.round((downloadProgress.current / downloadProgress.total) * 100) : 0}%)
                                </span>
                                {hasErrors && (
                                    <button
                                        type="button"
                                        onClick={() => setIsErrorDrawerOpen(!isErrorDrawerOpen)}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 cursor-pointer transition-colors"
                                    >
                                        <Icon icon="warning" className="size-3" />
                                        <span>Errors: {operationErrors.length}</span>
                                        <span className="text-[10px] underline">({isErrorDrawerOpen ? 'Hide' : 'View'})</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-purple-500 h-full transition-all duration-300"
                                style={{
                                    width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Idle / Finished with Errors banner */}
                {!isSearching && !isDownloading && hasErrors && (
                    <div className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2 text-rose-400">
                            <Icon icon="warning" className="size-4 shrink-0" />
                            <span className="font-semibold">{operationErrors.length} file{operationErrors.length > 1 ? 's' : ''} encountered errors during search or download.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsErrorDrawerOpen(!isErrorDrawerOpen)}
                                className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 cursor-pointer transition-colors"
                            >
                                {isErrorDrawerOpen ? 'Collapse Details' : 'View Failed Files & Reasons'}
                            </button>
                            <button
                                type="button"
                                onClick={clearOperationErrors}
                                className="text-muted-foreground hover:text-foreground underline cursor-pointer text-[11px]"
                            >
                                Clear Log
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Expandable Failure Details Drawer */}
            {hasErrors && isErrorDrawerOpen && (
                <div className="border-t border-rose-500/20 bg-rose-950/20 px-3 py-2 space-y-2 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between text-[11px] pb-1 border-b border-rose-500/10">
                        <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                            <Icon icon="errorCircle" className="size-3.5" />
                            <span>Failed Requests Breakdown ({operationErrors.length})</span>
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={clearOperationErrors}
                                className="text-[10px] text-muted-foreground hover:text-rose-300 transition-colors cursor-pointer"
                            >
                                Dismiss All
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsErrorDrawerOpen(false)}
                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Close Drawer"
                            >
                                <Icon icon="close" className="size-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {operationErrors.map((err) => (
                            <div
                                key={err.id}
                                className="flex items-start justify-between gap-3 p-2 rounded bg-card/60 border border-border/60 hover:border-rose-500/30 transition-colors"
                            >
                                <div className="space-y-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${
                                                err.action === 'search'
                                                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                                    : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                            }`}
                                        >
                                            {err.action}
                                        </span>
                                        <span className="font-semibold text-foreground truncate text-[11px]" title={err.fileTitle}>
                                            {err.fileTitle}
                                        </span>
                                        <span className="text-muted-foreground text-[10px] truncate max-w-[150px]">
                                            ({err.fileName})
                                        </span>
                                    </div>
                                    <div className="text-rose-400 font-mono text-[11px] break-words">
                                        {err.errorMessage}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground/60">
                                        {new Date(err.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                    <button
                                        type="button"
                                        onClick={() => retryOperation(err.id)}
                                        className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 text-[10px] font-semibold cursor-pointer transition-colors flex items-center gap-1"
                                        title={`Retry ${err.action}`}
                                    >
                                        <Icon icon="refresh" className="size-3" />
                                        <span>Retry</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dismissOperationError(err.id)}
                                        className="size-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Dismiss"
                                    >
                                        <Icon icon="close" className="size-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
