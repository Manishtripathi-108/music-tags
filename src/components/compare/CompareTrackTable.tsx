'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldInput } from '@/components/ui/Field';
import Icon from '@/components/ui/Icon';
import { type AudioComparisonItem } from '@/domain/remote-audio/types';
import { type CompareFilter, useCompareStore } from '@/store/compareStore';

export function CompareTrackTable() {
    const {
        items,
        isLoading,
        activeFilter,
        setActiveFilter,
        searchQuery,
        setSearchQuery,
        selectedIds,
        toggleSelect,
        selectAll,
        clearSelection,
        startSequentialSearch,
        startSequentialDownload,
        downloadMode,
        isSearching,
        isDownloading,
        setEditingMatchItem,
        operationErrors,
        sortBy,
        sortOrder,
        toggleSort,
        setSort,
    } = useCompareStore();

    // Filtering and sorting logic
    const filteredItems = useMemo(() => {
        let list = [...items];

        if (activeFilter === 'upgrade') {
            list = list.filter((i) => i.status === 'upgrade_available');
        } else if (activeFilter === 'dolby') {
            list = list.filter((i) => i.isDolbyAvailable);
        } else if (activeFilter === 'downloaded') {
            list = list.filter((i) => i.cachedMatch?.downloadStatus === 'completed');
        } else if (activeFilter === 'same') {
            list = list.filter((i) => i.status === 'same_quality');
        } else if (activeFilter === 'nomatch') {
            list = list.filter((i) => i.status === 'no_match');
        } else if (activeFilter === 'error') {
            list = list.filter(
                (i) => operationErrors.some((e) => e.trackId === i.localTrack.id) || i.cachedMatch?.downloadStatus === 'failed'
            );
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((i) => {
                const title = (i.localTrack.title || i.localTrack.filename || '').toLowerCase();
                const artist = (i.localTrack.artist || '').toLowerCase();
                const album = (i.localTrack.album || '').toLowerCase();
                const isrc = (i.localTrack.isrc || '').toLowerCase();
                const remoteTitle = (i.remoteTrack?.title || '').toLowerCase();
                return title.includes(q) || artist.includes(q) || album.includes(q) || isrc.includes(q) || remoteTitle.includes(q);
            });
        }

        // Apply sorting
        if (sortBy === 'confidence') {
            list.sort((a, b) => {
                const diff = (a.confidence ?? 0) - (b.confidence ?? 0);
                return sortOrder === 'asc' ? diff : -diff;
            });
        } else if (sortBy === 'title') {
            list.sort((a, b) => {
                const valA = (a.localTrack.title || a.localTrack.filename || '').toLowerCase();
                const valB = (b.localTrack.title || b.localTrack.filename || '').toLowerCase();
                const cmp = valA.localeCompare(valB);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else if (sortBy === 'artist') {
            list.sort((a, b) => {
                const valA = (a.localTrack.artist || '').toLowerCase();
                const valB = (b.localTrack.artist || '').toLowerCase();
                const cmp = valA.localeCompare(valB);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else if (sortBy === 'status') {
            list.sort((a, b) => {
                const cmp = a.status.localeCompare(b.status);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        }

        return list;
    }, [items, activeFilter, searchQuery, operationErrors, sortBy, sortOrder]);

    const upgradeCount = items.filter((i) => i.status === 'upgrade_available').length;
    const dolbyCount = items.filter((i) => i.isDolbyAvailable).length;
    const downloadedCount = items.filter((i) => i.cachedMatch?.downloadStatus === 'completed').length;
    const sameCount = items.filter((i) => i.status === 'same_quality').length;
    const nomatchCount = items.filter((i) => i.status === 'no_match').length;
    const errorCount = items.filter(
        (i) => operationErrors.some((e) => e.trackId === i.localTrack.id) || i.cachedMatch?.downloadStatus === 'failed'
    ).length;

    const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.localTrack.id));

    const handleToggleSelectAllFiltered = () => {
        if (allFilteredSelected) {
            clearSelection();
        } else {
            selectAll(filteredItems.map((i) => i.localTrack.id));
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden select-none">
            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center justify-between border-b px-3 py-1.5 gap-2 bg-card/20">
                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            activeFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        All ({items.length})
                    </button>

                    <button
                        onClick={() => setActiveFilter('upgrade')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1 ${
                            activeFilter === 'upgrade'
                                ? 'bg-emerald-600 text-white font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        <span>Upgrades ({upgradeCount})</span>
                    </button>

                    <button
                        onClick={() => setActiveFilter('dolby')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1 ${
                            activeFilter === 'dolby'
                                ? 'bg-purple-600 text-white font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <span className="size-1.5 rounded-full bg-purple-400" />
                        <span>Dolby Atmos ({dolbyCount})</span>
                    </button>

                    <button
                        onClick={() => setActiveFilter('downloaded')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            activeFilter === 'downloaded' ? 'bg-blue-600 text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Downloaded ({downloadedCount})
                    </button>

                    <button
                        onClick={() => setActiveFilter('same')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            activeFilter === 'same' ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Same Quality ({sameCount})
                    </button>

                    <button
                        onClick={() => setActiveFilter('nomatch')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                            activeFilter === 'nomatch' ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        No Match ({nomatchCount})
                    </button>

                    {errorCount > 0 && (
                        <button
                            onClick={() => setActiveFilter('error')}
                            className={`px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1 ${
                                activeFilter === 'error'
                                    ? 'bg-rose-600 text-white font-semibold'
                                    : 'text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20'
                            }`}
                        >
                            <Icon icon="warning" className="size-3" />
                            <span>Errors ({errorCount})</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {sortBy !== 'none' && (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/60">
                            <span>Sort:</span>
                            <span className="text-foreground font-semibold uppercase">{sortBy}</span>
                            <span className="text-primary font-bold">({sortOrder === 'asc' ? '▲ Low→High' : '▼ High→Low'})</span>
                            <button
                                onClick={() => setSort('none')}
                                className="ml-1 text-muted-foreground hover:text-foreground text-[10px] cursor-pointer"
                                title="Reset sorting"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    <div className="relative w-64">
                        <Icon icon="search" className="text-muted-foreground absolute top-2 left-2 size-3.5" />
                        <FieldInput
                            type="text"
                            placeholder="Filter current view..."
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            className="h-7 pr-7 pl-7 text-xs"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-muted-foreground hover:text-foreground absolute top-1.5 right-2 cursor-pointer text-[10px]"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Comparison table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10 border-b backdrop-blur-xs font-mono text-[11px]">
                        <tr>
                            <th className="p-2.5 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={handleToggleSelectAllFiltered}
                                    className="cursor-pointer rounded"
                                />
                            </th>
                            <th
                                onClick={() => toggleSort('title')}
                                className="p-2.5 min-w-[220px] cursor-pointer hover:text-foreground transition-colors select-none"
                                title="Click to sort by title"
                            >
                                <div className="flex items-center gap-1">
                                    <span>Local Audio & File</span>
                                    {sortBy === 'title' ? (
                                        <span className="text-primary font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                    ) : (
                                        <Icon icon="sort" className="size-3 text-muted-foreground/30" />
                                    )}
                                </div>
                            </th>
                            <th className="p-2.5 min-w-[130px]">Local Specs</th>
                            <th className="p-2.5 min-w-[240px]">Remote Available Match</th>
                            <th
                                onClick={() => toggleSort('confidence')}
                                className="p-2.5 min-w-[130px] cursor-pointer hover:text-foreground transition-colors select-none group"
                                title="Click to sort by match confidence score"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Confidence</span>
                                    {sortBy === 'confidence' ? (
                                        <Badge variant="outline" size="xs" className="px-1 py-0 text-primary border-primary/40 font-bold">
                                            {sortOrder === 'asc' ? '▲ Low→High' : '▼ High→Low'}
                                        </Badge>
                                    ) : (
                                        <Icon icon="sort" className="size-3 text-muted-foreground/40 group-hover:text-foreground" />
                                    )}
                                </div>
                            </th>
                            <th className="p-2.5 min-w-[140px]">Available Quality</th>
                            <th className="p-2.5 min-w-[170px]">Comparison Status</th>
                            <th className="p-2.5 min-w-[110px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-muted-foreground font-mono">
                                    <Icon icon="loading" className="size-5 animate-spin mx-auto mb-2 text-primary" />
                                    <span>Loading audio catalogue & comparisons...</span>
                                </td>
                            </tr>
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-muted-foreground font-mono">
                                    No tracks match the active filter or search query.
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => {
                                const isSelected = selectedIds.has(item.localTrack.id);
                                const isDownloaded = item.cachedMatch?.downloadStatus === 'completed';
                                const activeError = operationErrors.find((e) => e.trackId === item.localTrack.id);
                                const downloadFailure = item.cachedMatch?.downloadStatus === 'failed' ? item.cachedMatch.downloadError : null;

                                return (
                                    <tr
                                        key={item.localTrack.id}
                                        className={`transition-colors hover:bg-muted/30 ${
                                            isSelected ? 'bg-primary/5' : ''
                                        } ${activeError || downloadFailure ? 'bg-rose-500/5 border-l-2 border-l-rose-500' : ''}`}
                                    >
                                        {/* Checkbox */}
                                        <td className="p-2.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(item.localTrack.id)}
                                                className="cursor-pointer rounded"
                                            />
                                        </td>

                                        {/* Local Audio & File */}
                                        <td className="p-2.5">
                                            <div className="font-semibold text-foreground truncate max-w-xs" title={item.localTrack.title || item.localTrack.filename}>
                                                {item.localTrack.title || item.localTrack.filename}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                                                {item.localTrack.artist || 'Unknown Artist'}
                                                {item.localTrack.album ? ` • ${item.localTrack.album}` : ''}
                                            </div>
                                            {item.localTrack.isrc && (
                                                <div className="text-[10px] font-mono text-muted-foreground/80">
                                                    ISRC: {item.localTrack.isrc}
                                                </div>
                                            )}
                                            {isDownloaded && (
                                                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 mt-0.5" title={item.cachedMatch?.downloadPath || 'Saved'}>
                                                    <Icon icon="check" className="size-2.5 text-emerald-400 shrink-0" />
                                                    <span className="truncate">Saved: {item.cachedMatch?.downloadPath ? item.cachedMatch.downloadPath.split(/[/\\]/).pop() : 'Downloaded'}</span>
                                                </div>
                                            )}
                                            {activeError && (
                                                <div
                                                    className="mt-1 flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded font-mono truncate max-w-xs"
                                                    title={`${activeError.action.toUpperCase()} ERROR: ${activeError.errorMessage}`}
                                                >
                                                    <Icon icon="warning" className="size-3 shrink-0 text-rose-400" />
                                                    <span className="truncate">
                                                        {activeError.action.toUpperCase()}: {activeError.errorMessage}
                                                    </span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Local Specs */}
                                        <td className="p-2.5 font-mono text-[11px]">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <Badge
                                                    variant={item.localQuality.isLossless ? 'success' : 'secondary'}
                                                    size="xs"
                                                    className={item.localQuality.isLossless ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}
                                                >
                                                    {item.localQuality.codec.toUpperCase() || (item.localQuality.isLossless ? 'FLAC' : 'MP3')}
                                                </Badge>
                                                {item.localQuality.bitDepth && (
                                                    <span className="text-foreground">{item.localQuality.bitDepth}-bit</span>
                                                )}
                                                {item.localQuality.sampleRateHz && (
                                                    <span className="text-muted-foreground">{item.localQuality.sampleRateHz / 1000}kHz</span>
                                                )}
                                            </div>
                                            {item.localQuality.bitrateKbps && !item.localQuality.isLossless && (
                                                <div className="text-[10px] text-muted-foreground">
                                                    {item.localQuality.bitrateKbps} kbps
                                                </div>
                                            )}
                                        </td>

                                        {/* Remote Available Match */}
                                        <td className="p-2.5">
                                            {item.remoteTrack ? (
                                                <div className="flex items-start gap-2.5">
                                                    {item.remoteTrack.artworkURL ? (
                                                        <img
                                                            src={item.remoteTrack.artworkURL}
                                                            alt=""
                                                            className="size-8 rounded object-cover border border-border/80 shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                                            <Icon icon="audio" className="size-4" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-foreground truncate max-w-xs" title={item.remoteTrack.title}>
                                                            {item.remoteTrack.title}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                                                            {item.remoteTrack.artist || '—'}
                                                            {item.remoteTrack.album ? ` • ${item.remoteTrack.album}` : ''}
                                                        </div>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-[9px] font-mono text-muted-foreground/70 bg-muted px-1 py-0.5 rounded">
                                                                ID: {item.remoteTrack.id}
                                                            </span>
                                                            {item.cachedMatch?.lastCheckedAt && (
                                                                <span className="text-[9px] text-muted-foreground/60 font-mono">
                                                                    (Cached)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : item.status === 'no_match' ? (
                                                <span className="text-muted-foreground italic text-[11px]">No match in remote catalogue</span>
                                            ) : (
                                                <span className="text-muted-foreground/60 italic text-[11px]">Not searched yet</span>
                                            )}
                                        </td>

                                        {/* Match Confidence Score */}
                                        <td className="p-2.5 font-mono text-[11px]">
                                            {item.remoteTrack ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge
                                                            variant="outline"
                                                            size="xs"
                                                            className={`font-semibold font-mono ${
                                                                (item.confidence ?? 0) >= 0.85
                                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                                    : (item.confidence ?? 0) >= 0.65
                                                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                                            }`}
                                                        >
                                                            {Math.round((item.confidence ?? 0) * 100)}% Match
                                                        </Badge>
                                                    </div>
                                                    <div className="w-16 bg-muted/60 h-1 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-300 ${
                                                                (item.confidence ?? 0) >= 0.85
                                                                    ? 'bg-emerald-500'
                                                                    : (item.confidence ?? 0) >= 0.65
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-rose-500'
                                                            }`}
                                                            style={{ width: `${Math.round((item.confidence ?? 0) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : item.status === 'no_match' ? (
                                                <span className="text-muted-foreground/50 text-[10px]">0%</span>
                                            ) : (
                                                <span className="text-muted-foreground/40 text-[10px]">—</span>
                                            )}
                                        </td>

                                        {/* Available Quality */}
                                        <td className="p-2.5 font-mono text-[11px]">
                                            {item.remoteQuality ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-semibold text-foreground">{item.remoteQuality.label}</span>
                                                    </div>
                                                    {item.isDolbyAvailable && (
                                                        <Badge variant="outline" size="xs" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                                                            Dolby Atmos Mix
                                                        </Badge>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/60">—</span>
                                            )}
                                        </td>

                                        {/* Comparison Status */}
                                        <td className="p-2.5">
                                            {item.status === 'upgrade_available' ? (
                                                <Badge variant="success" size="sm" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1">
                                                    <Icon icon="magic" className="size-3" />
                                                    <span>Upgrade Available</span>
                                                </Badge>
                                            ) : item.status === 'dolby_available' ? (
                                                <Badge variant="outline" size="sm" className="bg-purple-500/15 text-purple-400 border-purple-500/30 gap-1">
                                                    <Icon icon="audio" className="size-3" />
                                                    <span>Dolby Atmos Available</span>
                                                </Badge>
                                            ) : item.status === 'same_quality' ? (
                                                <Badge variant="secondary" size="sm" className="gap-1 text-muted-foreground">
                                                    <Icon icon="check" className="size-3" />
                                                    <span>Same Quality</span>
                                                </Badge>
                                            ) : item.status === 'local_higher' ? (
                                                <Badge variant="outline" size="sm" className="gap-1 text-amber-500 border-amber-500/30">
                                                    <span>Local is Higher</span>
                                                </Badge>
                                            ) : item.status === 'no_match' ? (
                                                <Badge variant="outline" size="sm" className="text-muted-foreground/60">
                                                    No Match
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/60 text-[11px]">Ready to search</span>
                                            )}

                                            {isDownloaded && (
                                                <div className="mt-1">
                                                    <Badge
                                                        variant="outline"
                                                        size="xs"
                                                        className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 cursor-help flex items-center gap-1 font-semibold"
                                                        title={
                                                            item.cachedMatch?.downloadPath
                                                                ? `Saved to: ${item.cachedMatch.downloadPath}\nDownloaded: ${item.cachedMatch.downloadedAt ? new Date(item.cachedMatch.downloadedAt).toLocaleString() : 'Yes'}`
                                                                : 'Downloaded'
                                                        }
                                                    >
                                                        <Icon icon="check" className="size-2.5 shrink-0" />
                                                        <span>✓ Downloaded</span>
                                                    </Badge>
                                                </div>
                                            )}

                                            {downloadFailure && (
                                                <div className="mt-1">
                                                    <Badge
                                                        variant="outline"
                                                        size="xs"
                                                        className="bg-rose-500/15 text-rose-400 border-rose-500/30 cursor-help flex items-center gap-1 truncate max-w-[140px]"
                                                        title={downloadFailure}
                                                    >
                                                        <Icon icon="warning" className="size-2.5 shrink-0" />
                                                        <span className="truncate">Download Failed</span>
                                                    </Badge>
                                                </div>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="p-2.5 text-right font-mono">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Edit / Manage match (set ID, clear, select candidate) */}
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => setEditingMatchItem(item)}
                                                    title="Manage Match (Set ID, Alternative Candidates, or Remove Match)"
                                                    className="size-7 p-0 text-muted-foreground hover:text-foreground"
                                                >
                                                    <Icon icon="edit" className="size-3.5" />
                                                </Button>

                                                {/* Re-search single track */}
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => startSequentialSearch([item])}
                                                    disabled={isSearching}
                                                    title="Search this track individually"
                                                    className="size-7 p-0"
                                                >
                                                    <Icon icon="search" className="size-3 text-muted-foreground hover:text-foreground" />
                                                </Button>

                                                {/* Download / Re-download single track */}
                                                {item.remoteTrack && (
                                                    <Button
                                                        variant={isDownloaded ? 'secondary' : 'outline'}
                                                        size="xs"
                                                        onClick={() => startSequentialDownload([item])}
                                                        disabled={
                                                            isDownloading ||
                                                            (downloadMode === 'highest_lossless' && (!item.canDownloadLossless || item.remoteTrack.atmos)) ||
                                                            (downloadMode === 'dolby_atmos' && !item.isDolbyAvailable && !item.remoteTrack.atmos)
                                                        }
                                                        className={`h-7 px-2 text-[10px] gap-1 ${
                                                            isDownloaded
                                                                ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                                                                : downloadMode === 'dolby_atmos' && (item.isDolbyAvailable || item.remoteTrack.atmos)
                                                                ? 'border-purple-500/40 text-purple-400 hover:bg-purple-500/10'
                                                                : ''
                                                        }`}
                                                        title={
                                                            isDownloaded
                                                                ? `Re-download (already saved to ${item.cachedMatch?.downloadPath || 'disk'}). Click to remove old and re-download.`
                                                                : `Download (${downloadMode === 'highest_lossless' ? 'Lossless' : 'Dolby'}) as ${item.localTrack.isrc || item.localTrack.id}.ext`
                                                        }
                                                    >
                                                        <Icon icon={isDownloaded ? 'refresh' : 'download'} className="size-3" />
                                                        <span>{isDownloaded ? 'Re-download' : 'Download'}</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
