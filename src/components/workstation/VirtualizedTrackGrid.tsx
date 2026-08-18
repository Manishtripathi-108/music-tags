'use client';

import React, { useCallback, useEffect, useRef } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';

import Icon from '@/components/common/Icon';
import { formatDuration } from '@/lib/utils';
import { useAudioStore } from '@/store/audioStore';

export function VirtualizedTrackGrid() {
    const { tracks, isLoadingTracks, selectedTrackIds, activeTrackId, selectTrack, sortBy, sortOrder, setSorting, setIsScanModalOpen } =
        useAudioStore();

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: tracks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 28, // High-density row height
        overscan: 20,
    });

    // Handle keyboard navigation (Up/Down arrow keys)
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!tracks.length) return;
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
        return sortOrder === 'asc' ? <Icon icon="up" className="h-3 w-3 text-blue-400" /> : <Icon icon="down" className="h-3 w-3 text-blue-400" />;
    };

    if (!isLoadingTracks && tracks.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950/50 p-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                    <Icon icon="audio" className="h-6 w-6 text-zinc-500" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-zinc-200">No Audio Tracks In View</h3>
                <p className="mb-4 max-w-sm text-xs leading-relaxed text-zinc-500">
                    Select a local music folder to scan and index your audio files with ExifTool and FFprobe.
                </p>
                <button
                    onClick={() => setIsScanModalOpen(true)}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow transition-colors hover:bg-blue-500">
                    Scan Music Folder
                </button>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-950 select-none">
            {/* Sticky Table Header */}
            <div className="flex h-7 items-center border-b border-zinc-800 bg-zinc-900/90 px-2 font-mono text-[11px] font-semibold text-zinc-400">
                <div className="w-7 text-center">#</div>
                <div
                    onClick={() => toggleSort('title')}
                    className="group flex min-w-[140px] flex-1 cursor-pointer items-center justify-between px-2 hover:text-zinc-100">
                    <span>TITLE</span>
                    {renderSortIcon('title')}
                </div>
                <div
                    onClick={() => toggleSort('artist')}
                    className="group flex hidden w-36 cursor-pointer items-center justify-between px-2 hover:text-zinc-100 md:flex">
                    <span>ARTIST</span>
                    {renderSortIcon('artist')}
                </div>
                <div
                    onClick={() => toggleSort('album')}
                    className="group flex hidden w-36 cursor-pointer items-center justify-between px-2 hover:text-zinc-100 lg:flex">
                    <span>ALBUM</span>
                    {renderSortIcon('album')}
                </div>
                <div
                    onClick={() => toggleSort('year')}
                    className="group hidden w-14 cursor-pointer items-center justify-center gap-0.5 px-1 text-center hover:text-zinc-100 sm:flex">
                    <span>YEAR</span>
                    {renderSortIcon('year')}
                </div>
                <div
                    onClick={() => toggleSort('bpm')}
                    className="group hidden w-14 cursor-pointer items-center justify-center gap-0.5 px-1 text-center hover:text-zinc-100 xl:flex">
                    <span>BPM</span>
                    {renderSortIcon('bpm')}
                </div>
                <div className="hidden w-12 px-1 text-center xl:block">KEY</div>
                <div className="hidden w-16 px-1 text-center sm:block">FORMAT</div>
                <div
                    onClick={() => toggleSort('duration')}
                    className="group flex w-14 cursor-pointer items-center justify-end gap-0.5 px-1 pr-2 text-right hover:text-zinc-100">
                    <span>TIME</span>
                    {renderSortIcon('duration')}
                </div>
            </div>

            {/* Virtualized Rows Container */}
            <div ref={parentRef} className="flex-1 overflow-auto bg-zinc-950 font-mono text-xs">
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
                                onClick={(e) => selectTrack(track.id, e.ctrlKey || e.metaKey, e.shiftKey)}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className={`flex cursor-pointer items-center border-b border-zinc-900/60 px-2 text-[11px] transition-colors ${
                                    isActive
                                        ? 'bg-blue-600 font-medium text-white shadow-sm'
                                        : isSelected
                                          ? 'border-blue-900/30 bg-blue-950/50 text-blue-200'
                                          : virtualRow.index % 2 === 0
                                            ? 'bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
                                            : 'bg-zinc-925/40 text-zinc-300 hover:bg-zinc-900'
                                }`}>
                                {/* Track Number / Icon */}
                                <div className="w-7 truncate text-center text-zinc-500">
                                    {track.trackNumber != null ? (
                                        <span className={isActive ? 'text-blue-200' : 'text-zinc-400'}>
                                            {track.trackNumber.toString().padStart(2, '0')}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] opacity-40">-</span>
                                    )}
                                </div>

                                {/* Title & Cover Indicator */}
                                <div className="flex min-w-[140px] flex-1 items-center gap-1.5 truncate px-2">
                                    {track.hasCoverArt && (
                                        <Icon icon="image" className={`h-3 w-3 shrink-0 ${isActive ? 'text-blue-200' : 'text-emerald-500/70'}`} />
                                    )}
                                    <span className="truncate">{track.title || track.filename}</span>
                                </div>

                                {/* Artist */}
                                <div className={`hidden w-36 truncate px-2 md:block ${isActive ? 'text-blue-100' : 'text-zinc-400'}`}>
                                    {track.artist || '-'}
                                </div>

                                {/* Album */}
                                <div className={`hidden w-36 truncate px-2 lg:block ${isActive ? 'text-blue-100' : 'text-zinc-500'}`}>
                                    {track.album || '-'}
                                </div>

                                {/* Year */}
                                <div className={`hidden w-14 truncate px-1 text-center sm:block ${isActive ? 'text-blue-200' : 'text-zinc-500'}`}>
                                    {track.year || '-'}
                                </div>

                                {/* BPM */}
                                <div className={`hidden w-14 truncate px-1 text-center xl:block ${isActive ? 'text-blue-200' : 'text-zinc-400'}`}>
                                    {track.bpm ? Math.round(track.bpm) : '-'}
                                </div>

                                {/* Key */}
                                <div className={`hidden w-12 truncate px-1 text-center xl:block ${isActive ? 'text-blue-200' : 'text-zinc-500'}`}>
                                    {track.initialKey || '-'}
                                </div>

                                {/* Format / Lossless Badge */}
                                <div className="hidden w-16 truncate px-1 text-center sm:block">
                                    <span
                                        className={`py-0.2 rounded px-1 text-[9px] font-semibold ${
                                            track.lossless
                                                ? isActive
                                                    ? 'bg-blue-800 text-white'
                                                    : 'border border-emerald-900/50 bg-emerald-950 text-emerald-400'
                                                : isActive
                                                  ? 'bg-blue-800 text-white'
                                                  : 'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {track.codec ? track.codec.toUpperCase() : track.extension.replace('.', '').toUpperCase()}
                                    </span>
                                </div>

                                {/* Duration */}
                                <div className={`w-14 truncate px-1 pr-2 text-right ${isActive ? 'text-blue-100' : 'text-zinc-500'}`}>
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
