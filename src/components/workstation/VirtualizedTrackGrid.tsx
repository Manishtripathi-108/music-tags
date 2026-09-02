'use client';

import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTable } from '@tanstack/react-table';
import { useAudioStore } from '@/store/audioStore';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { columns, features, flexRender, type SortingState, type TrackTableMeta } from './trackTableFeatures';

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

    // TanStack Table sorting state (synced with Zustand store)
    const sorting: SortingState = sortBy ? [{ id: sortBy, desc: sortOrder === 'desc' }] : [];

    const onSortingChange = (updaterOrValue: SortingState | ((prev: SortingState) => SortingState)) => {
        const next = typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue;
        if (next.length > 0) {
            setSorting(next[0].id, next[0].desc ? 'desc' : 'asc');
        } else {
            setSorting('', 'asc');
        }
    };

    // TanStack Table instance
    const table = useTable({
        features,
        data: tracks,
        columns,
        state: { sorting },
        onSortingChange,
        getRowId: (row) => row.id,
        meta: {
            updateTrackInline,
            activeTrackId,
            selectedTrackIds,
        } satisfies TrackTableMeta,
    });

    const rows = table.getRowModel().rows;

    // Virtualization
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32,
        overscan: 20,
    });

    // Keyboard navigation (ArrowUp / ArrowDown)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!rows.length) return;
            if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
                return;
            }

            const currentIndex = activeTrackId ? rows.findIndex((r) => r.id === activeTrackId) : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = Math.min(currentIndex + 1, rows.length - 1);
                if (nextIndex >= 0 && nextIndex < rows.length) {
                    selectTrack(rows[nextIndex].id, false, e.shiftKey);
                    rowVirtualizer.scrollToIndex(nextIndex, { align: 'auto' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = Math.max(currentIndex - 1, 0);
                if (prevIndex >= 0 && prevIndex < rows.length) {
                    selectTrack(rows[prevIndex].id, false, e.shiftKey);
                    rowVirtualizer.scrollToIndex(prevIndex, { align: 'auto' });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [rows, activeTrackId, selectTrack, rowVirtualizer]);

    // Early return if no tracks are loaded and not currently loading
    if (!isLoadingTracks && tracks.length === 0) {
        return (
            <div className="bg-card/40 flex flex-1 flex-col items-center justify-center p-8 text-center select-none">
                <div className="bg-card mb-3 flex h-12 w-12 items-center justify-center rounded-full border">
                    <Icon icon="audio" className="text-muted-foreground size-6" />
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

    // Header rendering helper
    const headerGroups = table.getHeaderGroups();

    // Column visibility CSS classes
    const colVisibility: Record<string, string> = {
        trackNumber: 'w-7 text-center',
        title: 'min-w-37.5 flex-1 px-2',
        artist: 'hidden w-36 px-2 md:flex',
        album: 'hidden w-36 px-2 lg:flex',
        year: 'hidden w-16 px-1 text-center sm:flex',
        bpm: 'hidden w-16 px-1 text-center xl:flex',
        initialKey: 'hidden w-12 px-1 text-center xl:block',
        format: 'hidden w-16 px-1 text-center sm:block',
        durationSeconds: 'w-14 px-1 pr-2 text-right',
    };

    return (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden select-none">
            {/* Sticky Table Header */}
            <div className="bg-muted/60 text-muted-foreground flex h-7 items-center border-b px-2 font-mono text-[11px] font-semibold">
                {headerGroups.map((headerGroup) =>
                    headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        const sorted = header.column.getIsSorted();
                        const colId = header.column.id;
                        const baseClasses = colVisibility[colId] || '';

                        return (
                            <div
                                key={header.id}
                                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                                className={`${baseClasses} ${canSort ? 'group hover:text-foreground flex cursor-pointer items-center justify-between' : ''}`}>
                                <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                                {canSort && (
                                    <Icon
                                        icon={sorted === 'asc' ? 'up' : 'down'}
                                        className={sorted ? 'text-primary size-3' : 'size-3 opacity-30 transition-opacity group-hover:opacity-100'}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
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
                        const row = rows[virtualRow.index];
                        if (!row) return null;

                        const track = row.original;
                        const isSelected = selectedTrackIds.has(track.id);
                        const isActive = activeTrackId === track.id;

                        return (
                            <div
                                key={row.id}
                                onClick={(e) => {
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
                                {row.getAllCells().map((cell) => {
                                    const colId = cell.column.id;
                                    const wrapClasses = colVisibility[colId] || '';

                                    // Title cell renders its own wrapper (flex w/ icon)
                                    if (colId === 'title') {
                                        return (
                                            <div key={cell.id} className="min-w-37.5 flex-1">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={cell.id} className={`${wrapClasses} truncate`}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default VirtualizedTrackGrid;
