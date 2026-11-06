'use client';

import React from 'react';

import Icon from '@/components/ui/Icon';
import { type Track } from '@/domain/media/track';

export interface AudioSpecsTabProps {
    metadata: Track | null;
}

export function formatDuration(seconds?: number | null): string {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatBitrate(kbps?: number | null): string {
    if (!kbps) return '-';
    return `${kbps} kbps`;
}

export function formatSampleRate(hz?: number | null): string {
    if (!hz) return '-';
    return `${(hz / 1000).toFixed(1)} kHz`;
}

export function AudioSpecsTab({ metadata }: AudioSpecsTabProps) {
    return (
        <div className="flex-1 space-y-2 overflow-auto font-mono text-[11px]">
            <div className="space-y-1.5 rounded border p-2.5">
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Duration</span>
                    <span className="text-muted-foreground">{formatDuration(metadata?.durationSeconds)}</span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Bitrate</span>
                    <span className="text-muted-foreground">{formatBitrate(metadata?.bitrateKbps)}</span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Sample Rate</span>
                    <span className="text-muted-foreground">{formatSampleRate(metadata?.sampleRateHz)}</span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Channels</span>
                    <span className="text-muted-foreground">
                        {metadata?.channels ? `${metadata.channels}ch (${metadata.channelLayout || 'standard'})` : '-'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Bit Depth</span>
                    <span className="text-muted-foreground">{metadata?.bitDepth ? `${metadata.bitDepth}-bit` : '-'}</span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Codec</span>
                    <span className="text-muted-foreground uppercase">{metadata?.codec || '-'}</span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Lyrics Status</span>
                    <span className="text-muted-foreground">
                        {metadata?.lyricsType === 'synced' ? 'Synced (LRC)' : metadata?.lyrics ? 'Unsynced Text' : 'None'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between py-0.5">
                    <span>Container</span>
                    <span className="text-muted-foreground uppercase">{metadata?.extension || '-'}</span>
                </div>
            </div>

            <div className="space-y-1.5 rounded border p-2.5">
                <div className="text-primary flex items-center gap-1.5 border-b pb-1 text-[10px] font-semibold">
                    <Icon icon="gallery" className="size-3" />
                    <span>Artwork & Cover Details</span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Status</span>
                    <span className={metadata?.hasCoverArt ? 'text-primary font-medium' : 'text-muted-foreground'}>
                        {metadata?.hasCoverArt ? 'Embedded Art' : 'None'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Resolution</span>
                    <span className="text-muted-foreground">
                        {metadata?.coverArtWidth && metadata?.coverArtHeight
                            ? `${metadata.coverArtWidth} × ${metadata.coverArtHeight} px`
                            : metadata?.hasCoverArt
                              ? 'Present'
                              : '-'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Format</span>
                    <span className="text-muted-foreground uppercase">
                        {metadata?.coverArtMime ? metadata.coverArtMime.replace('image/', '') : metadata?.hasCoverArt ? 'JPEG' : '-'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Type</span>
                    <span className="text-muted-foreground">{metadata?.coverArtType || (metadata?.hasCoverArt ? 'Front Cover' : '-')}</span>
                </div>
                {metadata?.coverArtDescription && (
                    <div className="text-foreground flex justify-between border-b py-0.5">
                        <span>Description</span>
                        <span className="text-muted-foreground max-w-40 truncate">{metadata.coverArtDescription}</span>
                    </div>
                )}
                <div className="text-foreground flex justify-between py-0.5">
                    <span>Quality</span>
                    <span className="text-muted-foreground">
                        {!metadata?.hasCoverArt
                            ? '-'
                            : !metadata.coverArtWidth || !metadata.coverArtHeight
                              ? 'Standard'
                              : metadata.coverArtWidth < 600 || metadata.coverArtHeight < 600
                                ? 'Low Resolution (< 600px)'
                                : metadata.coverArtWidth >= 1400
                                  ? 'High Definition (HD)'
                                  : 'Standard Resolution'}
                    </span>
                </div>
            </div>

            <div className="space-y-1.5 rounded border p-2.5">
                <div className="text-primary flex items-center gap-1.5 border-b pb-1 text-[10px] font-semibold">
                    <Icon icon="fileText" className="size-3" />
                    <span>Filesystem & Scan Diagnostics</span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Scan Status</span>
                    <span className={`font-semibold ${metadata?.scanStatus === 'ERROR' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {metadata?.scanStatus || 'COMPLETED'}
                    </span>
                </div>
                {metadata?.scanError && (
                    <div className="bg-destructive/10 border-destructive/20 my-1 rounded border p-2">
                        <span className="text-destructive mb-0.5 block text-[10px] font-semibold">Error Details</span>
                        <span className="text-destructive/90 block leading-tight wrap-break-word">{metadata.scanError}</span>
                    </div>
                )}
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>File Missing</span>
                    <span className={metadata?.isMissing ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                        {metadata?.isMissing ? 'Yes (Missing)' : 'No'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Corrupt</span>
                    <span className={metadata?.isCorrupt ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                        {metadata?.isCorrupt ? 'Yes (Corrupt)' : 'No'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Locked</span>
                    <span className={metadata?.isLocked ? 'text-warning font-semibold' : 'text-muted-foreground'}>
                        {metadata?.isLocked ? 'Yes (Locked)' : 'No'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Read-Only</span>
                    <span className={metadata?.isReadOnly ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                        {metadata?.isReadOnly ? 'Yes' : 'No'}
                    </span>
                </div>
                <div className="text-foreground flex justify-between border-b py-0.5">
                    <span>Symbolic Link</span>
                    <span className={metadata?.isSymlink ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                        {metadata?.isSymlink ? 'Yes' : 'No'}
                    </span>
                </div>
                {metadata?.lastScannedAt && (
                    <div className="text-foreground flex justify-between py-0.5">
                        <span>Last Scanned</span>
                        <span className="text-muted-foreground">{new Date(metadata.lastScannedAt).toLocaleTimeString()}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
