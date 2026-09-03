'use client';

import React from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { type Track } from '@/domain/media/track';

export interface InspectorHeaderProps {
    activeTrackId: string;
    metadata: Track | null;
    displayTitle?: string;
    displayArtist?: string;
    hasLyrics?: boolean;
    isLrc?: boolean;
}

export function InspectorHeader({
    activeTrackId,
    metadata,
    displayTitle,
    displayArtist,
    hasLyrics,
    isLrc,
}: InspectorHeaderProps) {
    return (
        <div className="bg-background flex items-center gap-3 border-b p-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border shadow-inner bg-muted/20">
                <Icon icon="audio" className="text-muted-foreground/40 size-6 absolute" />
                {activeTrackId && (
                    <Image
                        key={activeTrackId}
                        src={`/api/media/art/${activeTrackId}.jpg`}
                        alt="Cover Art"
                        fill
                        sizes="56px"
                        className="h-full w-full object-cover relative z-1"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-muted-foreground truncate text-xs font-semibold">
                    {displayTitle || metadata?.title || 'Untitled'}
                </div>
                <div className="text-muted-foreground truncate text-[11px]">
                    {displayArtist || metadata?.artist || 'Unknown Artist'}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" size="xs" className="text-muted-foreground font-mono">
                        {metadata?.codec ? metadata.codec.toUpperCase() : 'AUDIO'}
                    </Badge>
                    {metadata?.bitDepth && (
                        <Badge
                            variant={metadata.bitDepth > 16 ? 'primary' : 'outline'}
                            size="xs"
                            className="font-mono">
                            {metadata.bitDepth}-BIT
                        </Badge>
                    )}
                    {metadata?.lossless && (
                        <Badge variant="success" size="xs" className="font-mono">
                            LOSSLESS
                        </Badge>
                    )}
                    {metadata?.hasCoverArt && metadata.coverArtWidth && metadata.coverArtHeight && (
                        <Badge
                            variant={
                                metadata.coverArtWidth < 600 || metadata.coverArtHeight < 600
                                    ? 'destructive'
                                    : 'secondary'
                            }
                            size="xs"
                            className="font-mono"
                            title={`Cover Art: ${metadata.coverArtWidth}×${metadata.coverArtHeight} (${metadata.coverArtMime || 'image/jpeg'})`}>
                            <Icon icon="gallery" className="size-2.5 mr-0.5" />
                            {metadata.coverArtWidth}×{metadata.coverArtHeight}
                        </Badge>
                    )}
                    {hasLyrics && (
                        <Badge variant={isLrc ? 'primary' : 'secondary'} size="xs" className="font-mono">
                            {isLrc ? 'LRC' : 'TXT'}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
}
