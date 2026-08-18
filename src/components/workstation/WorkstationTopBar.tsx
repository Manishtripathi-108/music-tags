'use client';

import React, { useEffect, useState } from 'react';

import Icon from '@/components/common/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAudioStore } from '@/store/audioStore';

export function WorkstationTopBar() {
    const { totalTracks, searchQuery, setSearchQuery, fetchTracks, setIsScanModalOpen, isLoadingTracks } = useAudioStore();

    const [systemStatus, setSystemStatus] = useState<{
        exiftool?: boolean;
        ffprobe?: boolean;
        ffmpeg?: boolean;
    }>({});

    useEffect(() => {
        fetch('/api/status')
            .then((res) => res.json())
            .then((data) => {
                if (data.binaries) {
                    setSystemStatus({
                        exiftool: data.binaries.exiftool?.found,
                        ffprobe: data.binaries.ffprobe?.found,
                        ffmpeg: data.binaries.ffmpeg?.found,
                    });
                }
            })
            .catch(() => {});
    }, []);

    return (
        <header className="flex h-10 select-none items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3">
            {/* Brand & Stats */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-100">
                    <Icon icon="audio" className="h-4 w-4 text-blue-500" />
                    <span>MetaTagStudio</span>
                    <Badge variant="outline" className="px-1 py-0 font-mono text-[9px] text-zinc-400">
                        AUDIO
                    </Badge>
                </div>

                <div className="h-4 w-[1px] bg-zinc-800" />

                <div className="flex items-center gap-1 font-mono text-xs text-zinc-400">
                    <Icon icon="audio" className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{totalTracks.toLocaleString()} tracks</span>
                </div>
            </div>

            {/* Center Search Input */}
            <div className="mx-4 max-w-md flex-1">
                <div className="relative">
                    <Icon icon="search" className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-500" />
                    <Input
                        type="text"
                        placeholder="Search titles, artists, albums, genres..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 border-zinc-800 bg-zinc-900/80 pl-7 text-xs focus-visible:ring-blue-500"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-[10px] text-zinc-500 hover:text-zinc-300">
                            CLEAR
                        </button>
                    )}
                </div>
            </div>

            {/* Action Controls & Engine Status */}
            <div className="flex items-center gap-2">
                <div className="mr-2 hidden items-center gap-1 font-mono text-[10px] text-zinc-500 lg:flex">
                    <span
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
                            systemStatus.exiftool ? 'bg-emerald-950/30 text-emerald-400' : 'bg-amber-950/30 text-amber-500'
                        }`}>
                        <Icon icon="success" className="h-3 w-3" /> ExifTool
                    </span>
                    <span
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
                            systemStatus.ffprobe ? 'bg-emerald-950/30 text-emerald-400' : 'bg-amber-950/30 text-amber-500'
                        }`}>
                        <Icon icon="processing" className="h-3 w-3" /> FFprobe
                    </span>
                </div>

                <Button variant="outline" size="sm" onClick={() => fetchTracks()} disabled={isLoadingTracks} className="h-7 gap-1.5 text-xs">
                    <Icon icon="refresh" className={`h-3.5 w-3.5 ${isLoadingTracks ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                </Button>

                <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsScanModalOpen(true)}
                    className="h-7 gap-1.5 bg-blue-600 text-xs text-white shadow-sm hover:bg-blue-500">
                    <Icon icon="open" className="h-3.5 w-3.5" />
                    <span>Scan Music Folder</span>
                </Button>
            </div>
        </header>
    );
}
