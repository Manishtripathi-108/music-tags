'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import ThemeToggler from '@/components/ui/ThemeToggler';

import { useAudioStore } from '@/store/audioStore';
import { FieldInput } from '../ui/Field';
import { MediaStatusResponse } from '@/types/client.types';
import axios from 'axios';

type SystemStatus = {
    exiftool?: boolean;
    ffprobe?: boolean;
    ffmpeg?: boolean;
};

export function WorkstationTopBar() {
    const { totalTracks, searchQuery, setSearchQuery, fetchTracks, setIsScanModalOpen, isLoadingTracks } = useAudioStore();

    const [systemStatus, setSystemStatus] = useState<SystemStatus>({
        exiftool: true,
        ffprobe: true,
        ffmpeg: true,
    });

    useEffect(() => {
        // Fetch system status
        axios
            .get<MediaStatusResponse>('/api/status')
            .then((res) => {
                const data = res.data;
                if (data.binaries) {
                    setSystemStatus({
                        exiftool: data.binaries.exiftool?.found,
                        ffprobe: data.binaries.ffprobe?.found,
                        ffmpeg: data.binaries.ffmpeg?.found,
                    });
                }
            })
            .catch(() => {
                setSystemStatus({
                    exiftool: false,
                    ffprobe: false,
                    ffmpeg: false,
                });
            });
    }, []);

    return (
        <header className="bg-background text-foreground flex h-10 items-center justify-between border-b px-3 select-none">
            {/* Brand & Stats */}
            <div className="flex items-center gap-3">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs leading-0 font-bold tracking-wider uppercase">
                    <Icon icon="audio" className="text-primary h-4 w-4" />
                    <span>MetaTagStudio</span>
                    <Badge variant="outline" size="xs" className="text-muted-foreground">
                        AUDIO
                    </Badge>
                </div>

                <div className="bg-border h-4 w-px" />

                <div className="text-muted-foreground flex items-center gap-1 font-mono text-xs leading-0">
                    <Icon icon="audio" className="size-3.5" />
                    <span>{totalTracks.toLocaleString()} tracks</span>
                </div>
            </div>

            {/* Center Search Input */}
            <div className="mx-4 max-w-md flex-1">
                <div className="relative">
                    <Icon icon="search" className="text-muted-foreground absolute top-1.5 left-2 size-3.5" />
                    <FieldInput
                        type="text"
                        placeholder="Search titles, artists, albums, genres..."
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        className="placeholder:text-muted-foreground h-7 pr-12 pl-7 text-xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="text-muted-foreground absolute top-2 right-2 cursor-pointer text-[10px] hover:text-foreground">
                            CLEAR
                        </button>
                    )}
                </div>
            </div>

            {/* Action Controls & Engine Status */}
            <div className="flex items-center gap-2">
                <div className="mr-2 hidden items-center gap-1 font-mono lg:flex">
                    <Badge variant={systemStatus.exiftool ? 'success' : 'warning'} size="sm" className="flex items-center gap-1">
                        <Icon icon={systemStatus.exiftool ? 'success' : 'warning'} className="size-3" /> ExifTool
                    </Badge>
                    <Badge variant={systemStatus.ffprobe ? 'success' : 'warning'} size="sm" className="flex items-center gap-1">
                        <Icon icon={systemStatus.ffprobe ? 'success' : 'warning'} className="size-3" /> FFprobe
                    </Badge>
                </div>

                <Button variant="outline" size="sm" onClick={() => fetchTracks()} disabled={isLoadingTracks} className="h-7 gap-1.5 text-xs">
                    <Icon icon={isLoadingTracks ? 'loading' : 'refresh'} className={`size-3.5`} />
                    <span>Refresh</span>
                </Button>

                <Button variant="primary" size="sm" onClick={() => setIsScanModalOpen(true)}>
                    <Icon icon="open" className="size-3.5" />
                    <span>Scan Music Folder</span>
                </Button>

                <ThemeToggler />
            </div>
        </header>
    );
}
