'use client';

import React, { useEffect } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import ThemeToggler from '@/components/ui/ThemeToggler';
import { useAudioStore } from '@/store/audioStore';

import { FieldInput } from '../ui/Field';

export function WorkstationTopBar() {
    const {
        totalTracks,
        tracks,
        activeFilter,
        searchQuery,
        setSearchQuery,
        fetchTracks,
        setIsScanModalOpen,
        isLoadingTracks,
        systemStatus,
        fetchSystemStatus,
        isNormalizingLyrics,
        normalizeAllLyrics,
        setIsDuplicateModalOpen,
    } = useAudioStore();

    useEffect(() => {
        fetchTracks().catch(console.error);
        fetchSystemStatus().catch(console.error);
    }, [fetchTracks, fetchSystemStatus]);

    const exif = systemStatus?.binaries.exiftool;
    const ffprobe = systemStatus?.binaries.ffprobe;
    const ffmpeg = systemStatus?.binaries.ffmpeg;

    return (
        <header className="bg-background text-foreground flex h-10 items-center justify-between border-b px-3 select-none">
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
                            className="text-muted-foreground hover:text-foreground absolute top-2 right-2 cursor-pointer text-[10px]">
                            CLEAR
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="mr-2 hidden items-center gap-1.5 font-mono lg:flex">
                    <Badge
                        variant={exif?.found ? 'success' : 'destructive'}
                        size="sm"
                        className="flex cursor-help items-center gap-1 transition-opacity hover:opacity-80"
                        title={
                            exif?.found
                                ? `ExifTool ${exif.version || ''}\nPath: ${exif.path || 'in PATH'}`
                                : `ExifTool missing: ${exif?.error || 'not found in PATH'}`
                        }>
                        <Icon icon={exif?.found ? 'success' : 'warning'} className="size-3" />
                        <span>ExifTool{exif?.version ? ` v${exif.version}` : ''}</span>
                    </Badge>

                    <Badge
                        variant={ffmpeg?.found ? 'success' : 'destructive'}
                        size="sm"
                        className="flex cursor-help items-center gap-1 transition-opacity hover:opacity-80"
                        title={
                            ffmpeg?.found
                                ? `FFmpeg ${ffmpeg.version || ''}\nPath: ${ffmpeg.path || 'in PATH'}`
                                : `FFmpeg missing: ${ffmpeg?.error || 'not found in PATH'}`
                        }>
                        <Icon icon={ffmpeg?.found ? 'success' : 'warning'} className="size-3" />
                        <span>FFmpeg{ffmpeg?.version ? ` v${ffmpeg.version}` : ''}</span>
                    </Badge>

                    <Badge
                        variant={ffprobe?.found ? 'success' : 'destructive'}
                        size="sm"
                        className="flex cursor-help items-center gap-1 transition-opacity hover:opacity-80"
                        title={
                            ffprobe?.found
                                ? `FFprobe ${ffprobe.version || ''}\nPath: ${ffprobe.path || 'in PATH'}`
                                : `FFprobe missing: ${ffprobe?.error || 'not found in PATH'}`
                        }>
                        <Icon icon={ffprobe?.found ? 'success' : 'warning'} className="size-3" />
                        <span>FFprobe</span>
                    </Badge>
                </div>

                <Button variant="outline" size="sm" onClick={() => fetchTracks()} disabled={isLoadingTracks} className="h-7 gap-1.5 text-xs">
                    <Icon icon={isLoadingTracks ? 'loading' : 'refresh'} className="size-3.5" />
                    <span>Refresh</span>
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        const targetFolder = activeFilter.startsWith('folder:') ? activeFilter.slice('folder:'.length) : undefined;
                        normalizeAllLyrics(targetFolder);
                    }}
                    disabled={isNormalizingLyrics || tracks.length === 0}
                    className="h-7 gap-1.5 text-xs">
                    <Icon icon={isNormalizingLyrics ? 'loading' : 'magic'} className="text-primary size-3.5" />
                    <span>{isNormalizingLyrics ? 'Normalizing Lyrics...' : 'Normalize All Lyrics'}</span>
                </Button>

                <Button variant="outline" size="sm" onClick={() => setIsDuplicateModalOpen(true)} className="h-7 gap-1.5 text-xs">
                    <Icon icon="copy" className="text-primary size-3.5" />
                    <span>Find Duplicates</span>
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

export default WorkstationTopBar;
