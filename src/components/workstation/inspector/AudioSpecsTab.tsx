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
        <div className="flex-1 space-y-2 overflow-auto p-3 font-mono text-[11px]">
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
                <div className="text-primary font-semibold border-b pb-1 text-[10px] flex items-center gap-1.5">
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
                    <span className="text-muted-foreground">
                        {metadata?.coverArtType || (metadata?.hasCoverArt ? 'Front Cover' : '-')}
                    </span>
                </div>
                {metadata?.coverArtDescription && (
                    <div className="text-foreground flex justify-between border-b py-0.5">
                        <span>Description</span>
                        <span className="text-muted-foreground truncate max-w-40">{metadata.coverArtDescription}</span>
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
        </div>
    );
}
