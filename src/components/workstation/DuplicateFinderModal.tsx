'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { FieldInput } from '@/components/ui/Field';
import Icon from '@/components/ui/Icon';
import { type DuplicateCluster, type DuplicateMatchMode } from '@/domain/duplicates/types';
import { formatBitrate, formatDuration } from '@/domain/media/formatters';
import { useAudioStore } from '@/store/audioStore';

export function DuplicateFinderModal() {
    const { isDuplicateModalOpen, setIsDuplicateModalOpen, duplicateClusters, isLoadingDuplicates, fetchDuplicates, resolveDuplicates, selectTrack } =
        useAudioStore();

    const [activeMode, setActiveMode] = useState<DuplicateMatchMode>('all');
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
    const [deleteLocalFiles, setDeleteLocalFiles] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isDuplicateModalOpen) {
            fetchDuplicates(activeMode)
                .then(() => {
                    setSelectedTrackIds(new Set());
                    setFeedbackMessage(null);
                })
                .catch(console.error);
        }
    }, [isDuplicateModalOpen, activeMode, fetchDuplicates]);

    const filteredClusters = useMemo(() => {
        let list = duplicateClusters;

        if (searchFilter.trim()) {
            const query = searchFilter.toLowerCase();
            list = list.filter(
                (c) =>
                    c.displayTitle.toLowerCase().includes(query) ||
                    c.displayArtist.toLowerCase().includes(query) ||
                    c.tracks.some((t) => t.track.filename.toLowerCase().includes(query))
            );
        }

        return list;
    }, [duplicateClusters, searchFilter]);

    const totalRedundantTracks = useMemo(() => {
        return duplicateClusters.reduce((acc, c) => acc + Math.max(0, c.tracks.length - 1), 0);
    }, [duplicateClusters]);

    const handleSelectAllRedundant = () => {
        const redundant = new Set<string>();
        for (const cluster of duplicateClusters) {
            for (const item of cluster.tracks) {
                if (!item.isRecommendedKeeper) {
                    redundant.add(item.track.id);
                }
            }
        }
        setSelectedTrackIds(redundant);
    };

    const handleToggleTrack = (trackId: string) => {
        const next = new Set(selectedTrackIds);
        if (next.has(trackId)) {
            next.delete(trackId);
        } else {
            next.add(trackId);
        }
        setSelectedTrackIds(next);
    };

    const handleQuickKeepBest = async (cluster: DuplicateCluster) => {
        const redundantIds = cluster.tracks.filter((t) => !t.isRecommendedKeeper).map((t) => t.track.id);
        if (redundantIds.length === 0) return;

        setIsResolving(true);
        try {
            const res = await resolveDuplicates(redundantIds, false);
            setFeedbackMessage(res.message);
        } catch (err) {
            console.error(err);
            setFeedbackMessage('Failed to resolve cluster.');
        } finally {
            setIsResolving(false);
        }
    };

    const handleBulkResolve = async () => {
        if (selectedTrackIds.size === 0) return;

        if (deleteLocalFiles) {
            const confirmed = window.confirm(
                `WARNING: You have chosen to PERMANENTLY DELETE ${selectedTrackIds.size} file(s) from your local hard drive. This action cannot be undone. Do you wish to proceed?`
            );
            if (!confirmed) return;
        }

        setIsResolving(true);
        try {
            const res = await resolveDuplicates(Array.from(selectedTrackIds), deleteLocalFiles);
            setFeedbackMessage(res.message);
            setSelectedTrackIds(new Set());
        } catch (err) {
            console.error(err);
            setFeedbackMessage('Failed to resolve duplicate tracks.');
        } finally {
            setIsResolving(false);
        }
    };

    const modeTabs: { id: DuplicateMatchMode; label: string; icon: string }[] = [
        { id: 'all', label: 'All Matchers', icon: 'copy' },
        { id: 'exact_tags', label: 'Exact Tags', icon: 'document' },
        { id: 'isrc', label: 'ISRC Match', icon: 'database' },
        { id: 'similar_tags', label: 'Fuzzy Metadata', icon: 'magic' },
        { id: 'phonetic', label: 'Phonetic Sound-Alike', icon: 'audio' },
        { id: 'hash', label: 'Exact Size & Hash', icon: 'archive' },
    ];

    return (
        <Dialog open={isDuplicateModalOpen} onOpenChange={(e) => setIsDuplicateModalOpen(typeof e === 'boolean' ? e : e.open)}>
            <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
                <DialogHeader className="bg-background border-b px-5 py-3.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-primary/10 text-primary rounded p-1.5">
                                <Icon icon="copy" className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-semibold">Duplicate Track Finder</DialogTitle>
                                <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                                    Detect identical and similar recordings using ISRC, audio hashes, fuzzy tags, and phonetic analysis.
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge variant="outline" size="sm" className="font-mono text-xs">
                                {duplicateClusters.length} Groups
                            </Badge>
                            <Badge variant={totalRedundantTracks > 0 ? 'primary' : 'muted'} size="sm" className="font-mono text-xs">
                                {totalRedundantTracks} Redundant
                            </Badge>
                        </div>
                    </div>

                    {/* Mode Selector Tabs & Search */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="bg-muted/30 flex items-center gap-1 overflow-x-auto rounded-lg border p-1">
                            {modeTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveMode(tab.id)}
                                    className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        activeMode === tab.id
                                            ? 'bg-background text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="relative w-56">
                            <Icon icon="search" className="text-muted-foreground absolute top-2 left-2 size-3.5" />
                            <FieldInput
                                placeholder="Filter duplicates..."
                                value={searchFilter}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFilter(e.target.value)}
                                className="h-7 pl-7 text-xs"
                            />
                        </div>
                    </div>
                </DialogHeader>

                <DialogBody className="bg-muted/10 flex-1 space-y-3 overflow-y-auto p-4 font-mono text-xs">
                    {feedbackMessage && (
                        <div className="border-primary/30 bg-primary/10 text-primary flex items-center justify-between rounded border p-2.5 text-xs">
                            <span>{feedbackMessage}</span>
                            <button onClick={() => setFeedbackMessage(null)} className="text-primary cursor-pointer text-[11px] hover:underline">
                                Dismiss
                            </button>
                        </div>
                    )}

                    {isLoadingDuplicates ? (
                        <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2">
                            <Icon icon="loading" className="text-primary size-6 animate-spin" />
                            <span className="text-xs">Analyzing audio library for duplicates...</span>
                        </div>
                    ) : filteredClusters.length === 0 ? (
                        <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 text-center">
                            <Icon icon="checkCircle" className="text-success size-8" />
                            <span className="text-foreground text-sm font-medium">No duplicates detected</span>
                            <span className="max-w-sm text-xs">
                                No duplicate files match the selected &quot;{activeMode}&quot; criteria across your library.
                            </span>
                        </div>
                    ) : (
                        filteredClusters.map((cluster) => (
                            <div key={cluster.id} className="bg-background overflow-hidden rounded-lg border shadow-xs transition-all">
                                {/* Cluster Header */}
                                <div className="bg-muted/40 flex items-center justify-between border-b px-3.5 py-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <Badge variant="outline" size="xs" className="font-mono font-bold">
                                            {cluster.tracks.length} COPIES
                                        </Badge>
                                        <span className="text-foreground truncate font-semibold">{cluster.displayTitle}</span>
                                        <span className="text-muted-foreground truncate">— {cluster.displayArtist}</span>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge
                                            variant={
                                                cluster.matchReason === 'isrc' || cluster.matchReason === 'file_hash'
                                                    ? 'success'
                                                    : cluster.matchReason === 'phonetic'
                                                      ? 'warning'
                                                      : 'secondary'
                                            }
                                            size="xs"
                                            className="font-mono">
                                            {cluster.matchReasonLabel || cluster.matchReason}
                                        </Badge>

                                        <Button
                                            variant="outline"
                                            size="xs"
                                            onClick={() => handleQuickKeepBest(cluster)}
                                            disabled={isResolving}
                                            className="h-6 gap-1 text-[10px]">
                                            <Icon icon="magic" className="text-primary size-3" />
                                            <span>Keep Best</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Track list in cluster */}
                                <div className="divide-border/50 divide-y">
                                    {cluster.tracks.map(({ track, isRecommendedKeeper, reasons }) => {
                                        const isSelected = selectedTrackIds.has(track.id);

                                        return (
                                            <div
                                                key={track.id}
                                                className={`flex items-center gap-3 p-3 transition-colors ${
                                                    isRecommendedKeeper
                                                        ? 'bg-success/5 hover:bg-success/10'
                                                        : isSelected
                                                          ? 'bg-destructive/10'
                                                          : 'hover:bg-muted/30'
                                                }`}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => handleToggleTrack(track.id)}
                                                    className="size-4"
                                                    title="Select this file to remove"
                                                />

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-foreground truncate text-[11px] font-semibold">{track.filename}</span>
                                                        {isRecommendedKeeper && (
                                                            <Badge variant="success" size="xs" className="font-mono text-[9px]">
                                                                RECOMMENDED KEEPER
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="text-muted-foreground truncate font-sans text-[10px]">
                                                        {track.filePath || track.directory}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                        <Badge variant={track.lossless ? 'success' : 'outline'} size="xs" className="font-mono">
                                                            {track.codec?.toUpperCase() || track.extension.toUpperCase()}
                                                        </Badge>

                                                        {track.bitDepth && (
                                                            <Badge
                                                                variant={track.bitDepth > 16 ? 'primary' : 'outline'}
                                                                size="xs"
                                                                className="font-mono">
                                                                {track.bitDepth}-BIT
                                                            </Badge>
                                                        )}

                                                        {track.bitrateKbps && (
                                                            <span className="text-muted-foreground font-mono">
                                                                {formatBitrate(track.bitrateKbps)}
                                                            </span>
                                                        )}

                                                        {track.durationSeconds && (
                                                            <span className="text-muted-foreground font-mono">
                                                                {formatDuration(track.durationSeconds)}
                                                            </span>
                                                        )}

                                                        {track.hasCoverArt && (
                                                            <span className="text-muted-foreground font-mono">
                                                                Cover:{' '}
                                                                {track.coverArtWidth ? `${track.coverArtWidth}×${track.coverArtHeight}` : 'Yes'}
                                                            </span>
                                                        )}

                                                        {track.lyricsType === 'synced' && (
                                                            <Badge variant="primary" size="xs" className="font-mono">
                                                                LRC
                                                            </Badge>
                                                        )}

                                                        {reasons.length > 0 && (
                                                            <span className="text-primary/80 font-sans text-[10px]">• {reasons.join(', ')}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => {
                                                        selectTrack(track.id);
                                                        setIsDuplicateModalOpen(false);
                                                    }}
                                                    className="text-muted-foreground hover:text-foreground h-6 gap-1 text-[10px]">
                                                    <Icon icon="arrowOpenRight" className="size-3" />
                                                    <span>View</span>
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </DialogBody>

                {/* Footer with bulk resolution actions */}
                <div className="bg-background flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 select-none">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllRedundant}
                            disabled={duplicateClusters.length === 0 || isResolving}
                            className="h-7 text-xs">
                            Select All Redundant ({totalRedundantTracks})
                        </Button>

                        <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs">
                            <Checkbox
                                checked={deleteLocalFiles}
                                onCheckedChange={(checked) => setDeleteLocalFiles(Boolean(checked))}
                                className="size-3.5"
                            />
                            <span>Delete local files from disk (permanent)</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsDuplicateModalOpen(false)} className="h-7 text-xs">
                            Close
                        </Button>

                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkResolve}
                            disabled={selectedTrackIds.size === 0 || isResolving}
                            className="h-7 gap-1.5 text-xs">
                            <Icon icon={isResolving ? 'loading' : 'trash'} className="size-3.5" />
                            <span>Remove Selected ({selectedTrackIds.size})</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default DuplicateFinderModal;
