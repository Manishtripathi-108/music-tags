'use client';

import React, { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { FieldInput, FieldLabel } from '@/components/ui/Field';
import Icon from '@/components/ui/Icon';
import { type RemoteTrackSummary } from '@/domain/remote-audio/types';
import { useCompareStore } from '@/store/compareStore';

export function EditMatchModal() {
    const {
        editingMatchItem,
        setEditingMatchItem,
        clearTrackMatch,
        setCustomRemoteId,
        selectCandidateMatch,
        apiUrl,
    } = useCompareStore();

    const [customIdInput, setCustomIdInput] = useState('');
    const [isSubmittingId, setIsSubmittingId] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    if (!editingMatchItem) return null;

    const { localTrack, remoteTrack, cachedMatch, candidates = [] } = editingMatchItem;

    const handleClearMatch = async () => {
        if (!confirm(`Are you sure you want to remove the match for "${localTrack.title || localTrack.filename}"?`)) return;
        setIsClearing(true);
        try {
            await clearTrackMatch(localTrack.id);
            setEditingMatchItem(null);
        } finally {
            setIsClearing(false);
        }
    };

    const handleSetCustomId = async () => {
        if (!customIdInput.trim()) return;
        setIsSubmittingId(true);
        try {
            await setCustomRemoteId(localTrack.id, customIdInput.trim());
            setCustomIdInput('');
            setEditingMatchItem(null);
        } finally {
            setIsSubmittingId(false);
        }
    };

    const handleSelectCandidate = async (candidate: RemoteTrackSummary) => {
        await selectCandidateMatch(localTrack.id, candidate);
        setEditingMatchItem(null);
    };

    return (
        <Dialog open={!!editingMatchItem} onOpenChange={(details) => !details.open && setEditingMatchItem(null)}>
            <DialogContent className="border-border bg-card text-card-foreground max-w-xl shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                        <Icon icon="edit" className="text-primary size-4" />
                        <span>Manage Remote Match</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                        Override incorrect matches by setting a specific remote track ID, selecting from alternative candidates, or clearing the match.
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto">
                    {/* Local Track Info Box */}
                    <div className="p-3 rounded-md bg-muted/40 border border-border/60 text-xs space-y-1 font-mono">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Local Track</div>
                        <div className="font-semibold text-foreground text-sm">
                            {localTrack.title || localTrack.filename}
                        </div>
                        <div className="text-muted-foreground">
                            {localTrack.artist || 'Unknown Artist'} {localTrack.album ? `• ${localTrack.album}` : ''}
                        </div>
                        <div className="text-[11px] text-muted-foreground/80 flex items-center gap-2 pt-0.5">
                            <span>Format: {localTrack.codec?.toUpperCase() || localTrack.extension}</span>
                            {localTrack.bitDepth && <span>• {localTrack.bitDepth}-bit</span>}
                            {localTrack.sampleRateHz && <span>• {localTrack.sampleRateHz / 1000} kHz</span>}
                            {localTrack.isrc && <span className="text-primary">• ISRC: {localTrack.isrc}</span>}
                        </div>
                    </div>

                    {/* Current Match Section */}
                    <div className="p-3 rounded-md border border-border/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Icon icon="audio" className="size-3.5 text-primary" />
                                <span>Currently Assigned Match</span>
                            </span>
                            {remoteTrack && (
                                <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={handleClearMatch}
                                    disabled={isClearing}
                                    className="h-6 gap-1 text-[11px] text-destructive border-destructive/40 hover:bg-destructive/10"
                                >
                                    <Icon icon="fileRemove" className="size-3" />
                                    <span>{isClearing ? 'Removing...' : 'Remove Match'}</span>
                                </Button>
                            )}
                        </div>

                        {remoteTrack ? (
                            <div className="flex items-start gap-3 bg-muted/20 p-2.5 rounded border border-border/40">
                                {remoteTrack.artworkURL ? (
                                    <img src={remoteTrack.artworkURL} alt="" className="size-12 rounded object-cover border shrink-0" />
                                ) : (
                                    <div className="size-12 rounded bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                        <Icon icon="audio" className="size-5" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                                    <div className="font-semibold text-foreground truncate">{remoteTrack.title}</div>
                                    <div className="text-muted-foreground truncate">{remoteTrack.artist || '—'} {remoteTrack.album ? `• ${remoteTrack.album}` : ''}</div>
                                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                                        <Badge variant="outline" size="xs" className="font-bold">
                                            ID: {remoteTrack.id}
                                        </Badge>
                                        <Badge variant="success" size="xs" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                            {remoteTrack.audioQuality || 'Lossless'}
                                        </Badge>
                                        {remoteTrack.atmos && (
                                            <Badge variant="outline" size="xs" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                                                Dolby Atmos
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground italic py-1">
                                No remote track is currently linked to this audio file.
                            </div>
                        )}
                    </div>

                    {/* Manual Remote Track ID Input */}
                    <div className="p-3 rounded-md bg-muted/30 border border-border/80 space-y-2">
                        <FieldLabel className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Icon icon="edit" className="size-3.5 text-amber-500" />
                            <span>Add / Override Remote Track ID</span>
                        </FieldLabel>
                        <p className="text-[11px] text-muted-foreground">
                            If you know the exact catalogue ID for this song (e.g. from the API search or URL), enter it below:
                        </p>
                        <div className="flex items-center gap-2">
                            <FieldInput
                                type="text"
                                placeholder="Enter Remote ID (e.g. 367630427)"
                                value={customIdInput}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomIdInput(e.target.value)}
                                className="h-8 font-mono text-xs flex-1"
                            />
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSetCustomId}
                                disabled={isSubmittingId || !customIdInput.trim()}
                                className="h-8 gap-1.5 text-xs"
                            >
                                <Icon icon={isSubmittingId ? 'loading' : 'check'} className="size-3.5" />
                                <span>{isSubmittingId ? 'Resolving...' : 'Set ID'}</span>
                            </Button>
                        </div>
                    </div>

                    {/* Alternative Candidates Section */}
                    {candidates && candidates.length > 0 && (
                        <div className="space-y-2 pt-1">
                            <div className="text-xs font-bold text-foreground flex items-center justify-between">
                                <span>Alternative Matches from Search ({candidates.length})</span>
                                <span className="text-[10px] font-mono text-muted-foreground">Click to select</span>
                            </div>

                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {candidates.map((cand) => {
                                    const isCurrent = remoteTrack?.id === cand.id;
                                    return (
                                        <div
                                            key={cand.id}
                                            className={`flex items-center justify-between p-2 rounded border text-xs transition-colors ${
                                                isCurrent
                                                    ? 'bg-primary/10 border-primary/50'
                                                    : 'bg-card hover:bg-muted/40 border-border/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                                                {cand.artworkURL ? (
                                                    <img src={cand.artworkURL} alt="" className="size-9 rounded object-cover border shrink-0" />
                                                ) : (
                                                    <div className="size-9 rounded bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                                        <Icon icon="audio" className="size-4" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-foreground truncate">{cand.title}</div>
                                                    <div className="text-[11px] text-muted-foreground truncate">
                                                        {cand.artist || '—'} {cand.album ? `• ${cand.album}` : ''}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px]">
                                                        <span className="text-muted-foreground">ID: {cand.id}</span>
                                                        <span className="text-emerald-500 font-semibold">• {cand.audioQuality || 'Lossless'}</span>
                                                        {cand.atmos && <span className="text-purple-400">• Dolby Atmos</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                {isCurrent ? (
                                                    <Badge variant="success" size="xs">Selected</Badge>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={() => handleSelectCandidate(cand)}
                                                        className="h-7 text-xs"
                                                    >
                                                        Select
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}
