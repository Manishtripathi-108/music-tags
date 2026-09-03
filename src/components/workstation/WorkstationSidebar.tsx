'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAudioStore } from '@/store/audioStore';
import { type T_IconType } from '@/types/client.types';
import { Button } from '@/components/ui/Button';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarItem } from '@/components/ui/Sidebar';
import {
    isLossless,
    isHiRes,
    isMissingArt,
    isLowResolutionArt,
    isMissingBpm,
    isMissingLyrics,
    isSyncedLyrics,
    isUnsyncedLyrics,
} from '@/domain/media/predicates';
import { FolderRemoveDialog, type FolderItemInfo } from './FolderRemoveDialog';

export function WorkstationSidebar() {
    const {
        activeFilter,
        setActiveFilter,
        tracks,
        totalTracks,
        systemStatus,
        removeFolder,
        isNormalizingLyrics,
        normalizeAllLyrics,
        duplicateClusters,
        setIsDuplicateModalOpen,
        fetchDuplicates,
    } = useAudioStore();

    useEffect(() => {
        fetchDuplicates().catch(console.error);
    }, [fetchDuplicates]);

    const [folderToRemove, setFolderToRemove] = useState<FolderItemInfo | null>(null);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

    const losslessCount = tracks.filter(isLossless).length;
    const hiResCount = tracks.filter(isHiRes).length;
    const missingArtCount = tracks.filter(isMissingArt).length;
    const lowResArtCount = tracks.filter((t) => isLowResolutionArt(t)).length;
    const missingBpmCount = tracks.filter(isMissingBpm).length;
    const missingLyricsCount = tracks.filter(isMissingLyrics).length;
    const syncedLyricsCount = tracks.filter(isSyncedLyrics).length;
    const unsyncedLyricsCount = tracks.filter(isUnsyncedLyrics).length;

    const folders: FolderItemInfo[] = useMemo(() => {
        const map = new Map<string, { directory: string; count: number; modifiedCount: number }>();

        for (const t of tracks) {
            const dir =
                t.directory ||
                (t.filePath ? t.filePath.substring(0, Math.max(t.filePath.lastIndexOf('\\'), t.filePath.lastIndexOf('/'))) : '');

            if (!dir) continue;

            const existing = map.get(dir) || { directory: dir, count: 0, modifiedCount: 0 };
            existing.count++;
            if (t.isModified) existing.modifiedCount++;
            map.set(dir, existing);
        }

        return Array.from(map.values()).sort((a, b) => a.directory.localeCompare(b.directory));
    }, [tracks]);

    const libraryFilters: { id: string; label: string; icon: T_IconType; count: number; badge?: string; warn?: boolean }[] = [
        { id: 'all', label: 'All Tracks', icon: 'audio', count: totalTracks },
        { id: 'lossless', label: 'Lossless Audio', icon: 'musicQueue', count: losslessCount, badge: 'FLAC/WAV' },
        { id: 'hi-res', label: 'Hi-Res (>16-bit)', icon: 'presentation', count: hiResCount, badge: '24-bit' },
        { id: 'missing-art', label: 'Missing Cover Art', icon: 'galleryRemove', count: missingArtCount, warn: true },
        { id: 'low-res-art', label: 'Low Resolution Art', icon: 'gallery', count: lowResArtCount, badge: '<800px', warn: lowResArtCount > 0 },
        { id: 'missing-bpm', label: 'Missing BPM / Key', icon: 'settings', count: missingBpmCount },
        {
            id: 'duplicates',
            label: 'Duplicate Tracks',
            icon: 'copy',
            count: duplicateClusters.length,
            badge: duplicateClusters.length > 0 ? `${duplicateClusters.length} groups` : undefined,
            warn: duplicateClusters.length > 0,
        },
    ];

    const lyricsFilters: { id: string; label: string; icon: T_IconType; count: number; badge?: string; warn?: boolean }[] = [
        { id: 'missing-lyrics', label: 'Missing Lyrics', icon: 'document', count: missingLyricsCount, warn: true },
        { id: 'lyrics-synced', label: 'Synced Lyrics', icon: 'lyrics', count: syncedLyricsCount, badge: 'LRC' },
        { id: 'lyrics-unsynced', label: 'Unsynced Lyrics', icon: 'fileText', count: unsyncedLyricsCount, badge: 'TXT' },
    ];

    const exif = systemStatus?.binaries.exiftool;
    const ffmpeg = systemStatus?.binaries.ffmpeg;
    const allReady = systemStatus?.allReady;

    const getFolderBasename = (dirPath: string) => {
        const parts = dirPath.split(/[\\/]/).filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : dirPath;
    };

    return (
        <>
            <Sidebar defaultWidth={230} minWidth={180} maxWidth={340}>
                <SidebarContent>
                    <SidebarGroup label="Library Views" icon="playlist" defaultOpen>
                        {libraryFilters.map((f) => (
                            <SidebarItem
                                key={f.id}
                                id={f.id}
                                label={f.label}
                                icon={f.icon}
                                count={f.count}
                                badge={f.badge}
                                isActive={activeFilter === f.id}
                                onClick={() => {
                                    if (f.id === 'duplicates') {
                                        setIsDuplicateModalOpen(true);
                                    } else {
                                        setActiveFilter(f.id);
                                    }
                                }}
                            />
                        ))}
                    </SidebarGroup>

                    {folders.length > 0 && (
                        <SidebarGroup label="Scanned Folders" icon="folder" defaultOpen>
                            {folders.map((folder) => {
                                const filterId = `folder:${folder.directory}`;
                                const isFolderActive = activeFilter === filterId;
                                const basename = getFolderBasename(folder.directory);

                                return (
                                    <SidebarItem
                                        key={folder.directory}
                                        id={filterId}
                                        label={
                                            <span title={folder.directory} className="truncate">
                                                {basename}
                                            </span>
                                        }
                                        icon={isFolderActive ? 'folderOpen' : 'folder'}
                                        count={folder.count}
                                        isActive={isFolderActive}
                                        onClick={() => setActiveFilter(isFolderActive ? 'all' : filterId)}
                                        trailing={
                                            <div className="flex items-center gap-1">
                                                {folder.modifiedCount > 0 && (
                                                    <span
                                                        className="bg-warning size-1.5 shrink-0 rounded-full"
                                                        title={`${folder.modifiedCount} modified track(s) in this folder`}
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFolderToRemove(folder);
                                                        setIsRemoveDialogOpen(true);
                                                    }}
                                                    className="hover:text-destructive text-muted-foreground/60 p-0.5 transition-colors cursor-pointer"
                                                    title="Remove folder from database">
                                                    <Icon icon="trash" className="size-3" />
                                                </button>
                                            </div>
                                        }
                                    />
                                );
                            })}
                        </SidebarGroup>
                    )}

                    <SidebarGroup label="Lyrics Filters" icon="lyrics" defaultOpen>
                        {lyricsFilters.map((f) => (
                            <SidebarItem
                                key={f.id}
                                id={f.id}
                                label={f.label}
                                icon={f.icon}
                                count={f.count}
                                badge={f.badge}
                                isActive={activeFilter === f.id}
                                onClick={() => setActiveFilter(f.id)}
                            />
                        ))}

                        <div className="pt-2 px-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                disabled={isNormalizingLyrics || tracks.length === 0}
                                onClick={() => {
                                    const targetFolder = activeFilter.startsWith('folder:')
                                        ? activeFilter.slice('folder:'.length)
                                        : undefined;
                                    normalizeAllLyrics(targetFolder);
                                }}
                                className="w-full justify-start gap-1.5 text-[11px]">
                                <Icon icon={isNormalizingLyrics ? 'loading' : 'magic'} className="size-3 text-primary" />
                                <span>{isNormalizingLyrics ? 'Normalizing...' : 'Normalize All Lyrics'}</span>
                            </Button>
                        </div>
                    </SidebarGroup>

                    <SidebarGroup label="Workstation Tasks" icon="presentation" defaultOpen>
                        <div className="border-border bg-muted/40 text-muted-foreground space-y-1.5 rounded-md border p-2.5 text-[11px]">
                            <div className="text-foreground flex items-center justify-between font-medium">
                                <div className="flex items-center gap-1.5">
                                    <Icon icon="audio" className="text-primary size-3.5" />
                                    <span>Media Engines</span>
                                </div>
                                <span
                                    className={`inline-block size-1.5 rounded-full ${
                                        allReady ? 'bg-success' : 'bg-warning animate-pulse'
                                    }`}
                                />
                            </div>

                            <div className="space-y-1 pt-1 font-mono text-[10px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">ExifTool:</span>
                                    <span className={exif?.found ? 'text-success' : 'text-destructive'}>
                                        {exif?.found ? `v${exif.version || 'OK'}` : 'Missing'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">FFmpeg:</span>
                                    <span className={ffmpeg?.found ? 'text-success' : 'text-destructive'}>
                                        {ffmpeg?.found ? `v${ffmpeg.version || 'OK'}` : 'Missing'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </SidebarGroup>
                </SidebarContent>

                <SidebarFooter>
                    <div className="text-muted-foreground flex items-center justify-between font-mono text-[11px]">
                        <span>Target Host</span>
                        <span className="text-foreground">127.0.0.1:3000</span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center justify-between text-[10px]">
                        <span>Engine Status</span>
                        <span className={allReady ? 'text-success flex items-center gap-1' : 'text-warning flex items-center gap-1'}>
                            ● {allReady ? 'Online & Ready' : 'Binaries Pending'}
                        </span>
                    </div>
                </SidebarFooter>
            </Sidebar>

            <FolderRemoveDialog
                open={isRemoveDialogOpen}
                onOpenChange={setIsRemoveDialogOpen}
                folder={folderToRemove}
                onConfirm={async (dir, syncBeforeDelete) => {
                    await removeFolder(dir, syncBeforeDelete);
                }}
            />
        </>
    );
}

export default WorkstationSidebar;
