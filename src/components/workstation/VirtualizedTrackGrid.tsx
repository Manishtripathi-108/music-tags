'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDuration } from '@/lib/utils';
import { useAudioStore } from '@/store/audioStore';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { InlineTableCellEditable } from '@/components/ui/Editable';
import Badge from '../ui/Badge';

export function VirtualizedTrackGrid() {
    const {
        tracks,
        isLoadingTracks,
        selectedTrackIds,
        activeTrackId,
        selectTrack,
        sortBy,
        sortOrder,
        setSorting,
        setIsScanModalOpen,
        updateTrackInline,
    } = useAudioStore();

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: tracks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32, // Density row height with editable padding
        overscan: 20,
    });

    // Handle keyboard navigation (Up/Down arrow keys)
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!tracks.length) return;
            // Ignore if active element is an input
            if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
                return;
            }

            const currentIndex = activeTrackId ? tracks.findIndex((t) => t.id === activeTrackId) : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = Math.min(currentIndex + 1, tracks.length - 1);
                if (nextIndex >= 0 && nextIndex < tracks.length) {
                    selectTrack(tracks[nextIndex].id, false, e.shiftKey);
                    rowVirtualizer.scrollToIndex(nextIndex, { align: 'auto' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = Math.max(currentIndex - 1, 0);
                if (prevIndex >= 0 && prevIndex < tracks.length) {
                    selectTrack(tracks[prevIndex].id, false, e.shiftKey);
                    rowVirtualizer.scrollToIndex(prevIndex, { align: 'auto' });
                }
            }
        },
        [tracks, activeTrackId, selectTrack, rowVirtualizer]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const toggleSort = (column: string) => {
        if (sortBy === column) {
            setSorting(column, sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSorting(column, 'asc');
        }
    };

    const renderSortIcon = (column: string) => {
        if (sortBy !== column) {
            return <Icon icon="down" className="h-3 w-3 opacity-30 transition-opacity group-hover:opacity-100" />;
        }
        return sortOrder === 'asc' ? <Icon icon="up" className="text-primary h-3 w-3" /> : <Icon icon="down" className="text-primary h-3 w-3" />;
    };

    if (!isLoadingTracks && tracks.length === 0) {
        return (
            <div className="bg-card/40 flex flex-1 flex-col items-center justify-center p-8 text-center select-none">
                <div className="bg-card mb-3 flex h-12 w-12 items-center justify-center rounded-full border">
                    <Icon icon="audio" className="text-muted-foreground h-6 w-6" />
                </div>
                <h3 className="text-foreground mb-1 text-sm font-semibold">No Audio Tracks In View</h3>
                <p className="text-muted-foreground mb-4 max-w-sm text-xs leading-relaxed">
                    Select a local music folder to scan and index your audio files with ExifTool and FFprobe.
                </p>
                <Button variant="primary" size="sm" onClick={() => setIsScanModalOpen(true)}>
                    <Icon icon="open" className="size-3.5" />
                    <span>Scan Music Folder</span>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden select-none">
            {/* Sticky Table Header */}
            <div className="bg-muted/60 text-muted-foreground flex h-7 items-center border-b px-2 font-mono text-[11px] font-semibold">
                <div className="w-7 text-center">#</div>
                <div
                    onClick={() => toggleSort('title')}
                    className="group hover:text-foreground flex min-w-37.5 flex-1 cursor-pointer items-center justify-between px-2">
                    <span>TITLE (DBL-CLICK TO EDIT)</span>
                    {renderSortIcon('title')}
                </div>
                <div
                    onClick={() => toggleSort('artist')}
                    className="group hover:text-foreground hidden w-36 cursor-pointer items-center justify-between px-2 md:flex">
                    <span>ARTIST</span>
                    {renderSortIcon('artist')}
                </div>
                <div
                    onClick={() => toggleSort('album')}
                    className="group hover:text-foreground hidden w-36 cursor-pointer items-center justify-between px-2 lg:flex">
                    <span>ALBUM</span>
                    {renderSortIcon('album')}
                </div>
                <div
                    onClick={() => toggleSort('year')}
                    className="group hover:text-foreground hidden w-16 cursor-pointer items-center justify-center gap-0.5 px-1 text-center sm:flex">
                    <span>YEAR</span>
                    {renderSortIcon('year')}
                </div>
                <div
                    onClick={() => toggleSort('bpm')}
                    className="group hover:text-foreground hidden w-16 cursor-pointer items-center justify-center gap-0.5 px-1 text-center xl:flex">
                    <span>BPM</span>
                    {renderSortIcon('bpm')}
                </div>
                <div className="hidden w-12 px-1 text-center xl:block">KEY</div>
                <div className="hidden w-16 px-1 text-center sm:block">FORMAT</div>
                <div
                    onClick={() => toggleSort('durationSeconds')}
                    className="group hover:text-foreground flex w-14 cursor-pointer items-center justify-end gap-0.5 px-1 pr-2 text-right">
                    <span>TIME</span>
                    {renderSortIcon('durationSeconds')}
                </div>
            </div>

            {/* Virtualized Rows Container */}
            <div ref={parentRef} className="bg-background flex-1 overflow-auto font-mono text-xs">
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const track = tracks[virtualRow.index];
                        if (!track) return null;

                        const isSelected = selectedTrackIds.has(track.id);
                        const isActive = activeTrackId === track.id;

                        return (
                            <div
                                key={track.id}
                                onClick={(e) => {
                                    // Only select if not directly clicking inside an active editable input
                                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                        selectTrack(track.id, e.ctrlKey || e.metaKey, e.shiftKey);
                                    }
                                }}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className={`border-border/60 flex cursor-pointer items-center border-b px-2 text-[11px] transition-colors ${
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : isSelected
                                          ? 'border-primary/30 bg-primary/25 text-foreground'
                                          : virtualRow.index % 2 === 0
                                            ? 'bg-background text-foreground hover:bg-muted/60'
                                            : 'bg-background/80 text-foreground hover:bg-muted/60'
                                }`}>
                                {/* Track Number / Icon */}
                                <div className="text-muted-foreground w-7 truncate text-center">
                                    {track.trackNumber != null ? (
                                        <span className={isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'}>
                                            {track.trackNumber.toString().padStart(2, '0')}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] opacity-40">-</span>
                                    )}
                                </div>

                                {/* Title & Cover Indicator */}
                                <div className="flex min-w-37.5 flex-1 items-center gap-1.5 truncate px-2">
                                    <Icon
                                        icon={track.hasCoverArt ? 'gallery' : 'galleryRemove'}
                                        className={`h-3 w-3 shrink-0 ${isActive ? 'text-primary-foreground' : track.hasCoverArt ? 'text-success' : 'text-destructive'}`}
                                    />
                                    <InlineTableCellEditable
                                        required
                                        defaultValue={track.title || ''}
                                        placeholder="Unknown Title"
                                        onValueCommit={(newTitle) => updateTrackInline(track.id, { title: newTitle.value })}
                                        isActiveRow={isActive}
                                    />
                                </div>

                                {/* Artist */}
                                <div className="hidden w-36 truncate px-2 md:block">
                                    <InlineTableCellEditable
                                        defaultValue={track.artist || ''}
                                        placeholder="Unknown Artist"
                                        onValueCommit={(newArtist) => updateTrackInline(track.id, { artist: newArtist.value })}
                                        isActiveRow={isActive}
                                    />
                                </div>

                                {/* Album */}
                                <div className="hidden w-36 truncate px-2 lg:block">
                                    <InlineTableCellEditable
                                        defaultValue={track.album || ''}
                                        placeholder="Unknown Album"
                                        onValueCommit={(newAlbum) => updateTrackInline(track.id, { album: newAlbum.value })}
                                        isActiveRow={isActive}
                                    />
                                </div>

                                {/* Year */}
                                <div className="hidden w-16 truncate px-1 text-center sm:block">
                                    <InlineTableCellEditable
                                        defaultValue={track.year ? String(track.year) : ''}
                                        placeholder="-"
                                        onValueCommit={(newYear) => {
                                            const parsed = parseInt(newYear.value, 10);
                                            updateTrackInline(track.id, { year: isNaN(parsed) ? null : parsed });
                                        }}
                                        isActiveRow={isActive}
                                        previewClassName="text-center"
                                        inputClassName="text-center"
                                    />
                                </div>

                                {/* BPM */}
                                <div className="hidden w-16 truncate px-1 text-center xl:block">
                                    <InlineTableCellEditable
                                        defaultValue={track.bpm ? String(Math.round(track.bpm)) : ''}
                                        placeholder="-"
                                        onValueCommit={(newBpm) => {
                                            const parsed = parseFloat(newBpm.value);
                                            updateTrackInline(track.id, { bpm: isNaN(parsed) ? null : parsed });
                                        }}
                                        isActiveRow={isActive}
                                        previewClassName="text-center"
                                        inputClassName="text-center"
                                    />
                                </div>

                                {/* Key */}
                                <div
                                    className={`hidden w-12 truncate px-1 text-center xl:block ${isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                                    {track.initialKey || '-'}
                                </div>

                                {/* Format / Lossless Badge */}
                                <div className="hidden w-16 truncate px-1 text-center sm:block">
                                    <Badge
                                        variant={isActive ? 'outline' : track.lossless ? 'success' : 'muted'}
                                        size="xs"
                                        className={`px-1 py-0 text-[9px] ${isActive ? 'border-foreground' : ''}`}>
                                        {track.codec ? track.codec.toUpperCase() : track.extension.replace('.', '').toUpperCase()}
                                    </Badge>
                                </div>

                                {/* Duration */}
                                <div
                                    className={`w-14 truncate px-1 pr-2 text-right ${isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                                    {formatDuration(track.durationSeconds)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default VirtualizedTrackGrid;
