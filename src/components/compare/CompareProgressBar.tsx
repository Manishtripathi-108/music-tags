'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { useCompareStore } from '@/store/compareStore';

export function CompareProgressBar() {
    const { isSearching, searchProgress, isDownloading, downloadProgress, connectionStatus } = useCompareStore();

    if (!isSearching && !isDownloading && !connectionStatus) {
        return null;
    }

    return (
        <div className="bg-muted/30 border-b px-3 py-2 space-y-1.5 select-none text-xs font-mono">
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
                        <div className="text-muted-foreground">
                            <span>
                                {searchProgress.current} / {searchProgress.total} (
                                {searchProgress.total > 0 ? Math.round((searchProgress.current / searchProgress.total) * 100) : 0}%)
                            </span>
                            {searchProgress.errorCount > 0 && (
                                <span className="text-rose-400 ml-2">Errors: {searchProgress.errorCount}</span>
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
                        <div className="text-muted-foreground">
                            <span>
                                {downloadProgress.current} / {downloadProgress.total} (
                                {downloadProgress.total > 0 ? Math.round((downloadProgress.current / downloadProgress.total) * 100) : 0}%)
                            </span>
                            {downloadProgress.errorCount > 0 && (
                                <span className="text-rose-400 ml-2">Errors: {downloadProgress.errorCount}</span>
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
        </div>
    );
}
