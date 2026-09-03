'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { FieldInput } from '@/components/ui/Field';
import { type RawTagItem } from '@/domain/media/track';

export interface RawTagsTabProps {
    rawTags: RawTagItem[];
    isLoading: boolean;
}

export function RawTagsTab({ rawTags, isLoading }: RawTagsTabProps) {
    const [rawSearch, setRawSearch] = useState('');

    const filteredRawTags = rawTags.filter(
        (t) =>
            t.tag.toLowerCase().includes(rawSearch.toLowerCase()) ||
            t.group.toLowerCase().includes(rawSearch.toLowerCase()) ||
            String(t.value).toLowerCase().includes(rawSearch.toLowerCase())
    );

    return (
        <div className="flex flex-1 flex-col space-y-2 overflow-hidden p-2 font-mono">
            <div className="relative">
                <Icon icon="search" className="text-muted-foreground absolute top-2.5 left-2 size-3" />
                <FieldInput
                    placeholder="Filter raw tags..."
                    value={rawSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRawSearch(e.target.value)}
                    className="pl-6 text-xs"
                />
                {isLoading && (
                    <Icon icon="loading" className="text-primary absolute top-2.5 right-2.5 size-3 animate-spin" />
                )}
            </div>

            <div className="text-muted-foreground flex items-center justify-between px-1 text-[10px]">
                <span>
                    {filteredRawTags.length} tags {rawSearch ? `(of ${rawTags.length})` : ''}
                </span>
                <div className="flex items-center gap-1 text-[9px]">
                    <span className="rounded bg-primary/10 px-1 py-0.5 text-primary font-medium">Exif</span>
                    <span className="rounded bg-secondary/30 px-1 py-0.5 text-foreground font-medium">FFmpeg</span>
                </div>
            </div>

            <div className="flex-1 space-y-1 overflow-auto rounded border p-1 text-[10px]">
                {filteredRawTags.length === 0 && (
                    <div className="text-muted-foreground flex h-32 items-center justify-center">
                        {isLoading ? 'Extracting raw tags...' : 'No matching tags found'}
                    </div>
                )}
                {filteredRawTags.map((t, idx) => {
                    const isFfmpeg = t.group.toLowerCase().includes('ffmpeg');
                    return (
                        <div
                            key={idx}
                            className="hover:bg-muted/60 flex flex-col rounded border-b border-border/40 p-1.5 transition-colors">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-primary font-bold truncate">{t.tag}</span>
                                <Badge
                                    variant={isFfmpeg ? 'secondary' : 'outline'}
                                    size="xs"
                                    className="text-[9px] font-mono shrink-0">
                                    {t.group}
                                </Badge>
                            </div>
                            <div className="text-foreground mt-0.5 break-all select-text font-mono text-[10px]">
                                {String(t.value)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
