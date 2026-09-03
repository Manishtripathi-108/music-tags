'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { FieldInput } from '@/components/ui/Field';
import { useAudioStore } from '@/store/audioStore';
import { formatDuration, formatBitrate } from '@/lib/utils';
import { type DuplicateMatchMode, type DuplicateCluster } from '@/types/audio';

export function DuplicateFinderModal() {
    const {
        isDuplicateModalOpen,
        setIsDuplicateModalOpen,
        duplicateClusters,
        isLoadingDuplicates,
        fetchDuplicates,
        resolveDuplicates,
        selectTrack,
    } = useAudioStore();

    const [activeMode, setActiveMode] = useState<DuplicateMatchMode>('all');
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
    const [deleteLocalFiles, setDeleteLocalFiles] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isDuplicateModalOpen) {
            fetchDuplicates(activeMode).catch(console.error);
            setSelectedTrackIds(new Set());
            setFeedbackMessage(null);
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
            <DialogContent className="max-h-[90vh] max-w-4xl p-0 flex flex-col overflow-hidden">
                <DialogHeader className="border-b px-5 py-3.5 bg-background">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded bg-primary/10 p-1.5 text-primary">
                                <Icon icon="copy" className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-semibold">Duplicate Track Finder</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
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
                        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1">
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

                <DialogBody className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10 font-mono text-xs">
                    {feedbackMessage && (
                        <div className="rounded border border-primary/30 bg-primary/10 p-2.5 text-xs text-primary flex items-center justify-between">
                            <span>{feedbackMessage}</span>
                            <button
                                onClick={() => setFeedbackMessage(null)}
                                className="text-primary hover:underline text-[11px] cursor-pointer">
                                Dismiss
                            </button>
                        </div>
                    )}

                    {isLoadingDuplicates ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Icon icon="loading" className="size-6 animate-spin text-primary" />
                            <span className="text-xs">Analyzing audio library for duplicates...</span>
                        </div>
                    ) : filteredClusters.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                            <Icon icon="checkCircle" className="size-8 text-success" />
                            <span className="text-sm font-medium text-foreground">No duplicates detected</span>
                            <span className="text-xs max-w-sm">
                                No duplicate files match the selected &quot;{activeMode}&quot; criteria across your library.
                            </span>
                        </div>
                    ) : (
                        filteredClusters.map((cluster) => (
                            <div
                                key={cluster.id}
                                className="rounded-lg border bg-background shadow-xs overflow-hidden transition-all">
                                {/* Cluster Header */}
                                <div className="bg-muted/40 border-b px-3.5 py-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Badge variant="outline" size="xs" className="font-mono font-bold">
                                            {cluster.tracks.length} COPIES
                                        </Badge>
                                        <span className="font-semibold text-foreground truncate">{cluster.displayTitle}</span>
                                        <span className="text-muted-foreground truncate">— {cluster.displayArtist}</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
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
                                            <Icon icon="magic" className="size-3 text-primary" />
                                            <span>Keep Best</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Track list in cluster */}
                                <div className="divide-y divide-border/50">
                                    {cluster.tracks.map(({ track, isRecommendedKeeper, reasons }) => {
                                        const isSelected = selectedTrackIds.has(track.id);

                                        return (
                                            <div
                                                key={track.id}
                                                className={`p-3 flex items-center gap-3 transition-colors ${
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
                                                        <span className="font-semibold text-foreground truncate text-[11px]">
                                                            {track.filename}
                                                        </span>
                                                        {isRecommendedKeeper && (
                                                            <Badge variant="success" size="xs" className="font-mono text-[9px]">
                                                                RECOMMENDED KEEPER
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="text-[10px] text-muted-foreground truncate font-sans">
                                                        {track.filePath || track.directory}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                        <Badge
                                                            variant={track.lossless ? 'success' : 'outline'}
                                                            size="xs"
                                                            className="font-mono">
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
                                                                Cover: {track.coverArtWidth ? `${track.coverArtWidth}×${track.coverArtHeight}` : 'Yes'}
                                                            </span>
                                                        )}

                                                        {track.lyricsType === 'synced' && (
                                                            <Badge variant="primary" size="xs" className="font-mono">
                                                                LRC
                                                            </Badge>
                                                        )}

                                                        {reasons.length > 0 && (
                                                            <span className="text-primary/80 font-sans text-[10px]">
                                                                • {reasons.join(', ')}
                                                            </span>
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
                                                    className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground">
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
                <div className="border-t bg-background px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllRedundant}
                            disabled={duplicateClusters.length === 0 || isResolving}
                            className="h-7 text-xs">
                            Select All Redundant ({totalRedundantTracks})
                        </Button>

                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            <Checkbox
                                checked={deleteLocalFiles}
                                onCheckedChange={(checked) => setDeleteLocalFiles(Boolean(checked))}
                                className="size-3.5"
                            />
                            <span>Delete local files from disk (permanent)</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDuplicateModalOpen(false)}
                            className="h-7 text-xs">
                            Close
                        </Button>

                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkResolve}
                            disabled={selectedTrackIds.size === 0 || isResolving}
                            className="h-7 text-xs gap-1.5">
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
