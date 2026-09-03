'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { normalizeLrc } from '@/domain/lyrics/lrc-parser';
import { isLrcContent } from '@/domain/media/lyrics';
import { type Track } from '@/domain/media/track';

export interface LyricsTabProps {
    activeTrackId: string;
    metadata: Track | null;
    lyricsText: string;
    setLyricsText: (text: string) => void;
    onSaveLyrics: (text: string) => Promise<boolean>;
    onNormalizeTrackLrc: (trackId: string, lrc: string) => Promise<{ success: boolean; normalizedLrc?: string; message?: string }>;
}

export function LyricsTab({
    activeTrackId,
    metadata,
    lyricsText,
    setLyricsText,
    onSaveLyrics,
    onNormalizeTrackLrc,
}: LyricsTabProps) {
    const [isSavingLyrics, setIsSavingLyrics] = useState(false);
    const [lyricsSavedSuccess, setLyricsSavedSuccess] = useState(false);
    const [isNormalizingLrc, setIsNormalizingLrc] = useState(false);
    const [normalizeStatus, setNormalizeStatus] = useState<{ success: boolean; message: string } | null>(null);

    const isLrc = isLrcContent(lyricsText);
    const hasLyrics = Boolean(lyricsText.trim());

    const handleSaveLyrics = async () => {
        if (!activeTrackId) return;
        setIsSavingLyrics(true);
        try {
            const success = await onSaveLyrics(lyricsText);
            if (success) {
                setLyricsSavedSuccess(true);
            }
        } finally {
            setIsSavingLyrics(false);
        }
    };

    const handleNormalizeLrc = async () => {
        if (!activeTrackId || !metadata) return;

        setIsNormalizingLrc(true);
        setNormalizeStatus(null);

        try {
            const sourceText = lyricsText.trim() || metadata.lyrics || '';
            const res = normalizeLrc(metadata, sourceText);

            if (!res.success) {
                setNormalizeStatus({
                    success: false,
                    message: res.error || 'Cannot normalize: missing valid timestamped lines [mm:ss.xx]',
                });
                return;
            }

            const apiRes = await onNormalizeTrackLrc(activeTrackId, res.normalizedLrc);

            if (apiRes.success && apiRes.normalizedLrc) {
                setLyricsText(apiRes.normalizedLrc);
                setLyricsSavedSuccess(true);
                setNormalizeStatus({
                    success: true,
                    message: 'Normalized LRC saved to file and library',
                });
            } else {
                setNormalizeStatus({
                    success: false,
                    message: apiRes.message || 'Failed to normalize LRC file',
                });
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                (err instanceof Error ? err.message : 'Normalization failed');
            setNormalizeStatus({ success: false, message: msg });
        } finally {
            setIsNormalizingLrc(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col space-y-2 overflow-hidden p-3 font-mono">
            <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5">
                    <Icon icon="lyrics" className="text-primary size-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Lyrics Editor</span>
                </div>
                <Badge variant={isLrc ? 'success' : hasLyrics ? 'secondary' : 'outline'} size="xs">
                    {isLrc ? 'Synced (LRC)' : hasLyrics ? 'Unsynced' : 'None'}
                </Badge>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden rounded border bg-card/40 p-2">
                <textarea
                    value={lyricsText}
                    onChange={(e) => {
                        setLyricsText(e.target.value);
                        setLyricsSavedSuccess(false);
                    }}
                    placeholder="Enter song lyrics here... LRC timestamps like [00:12.34] will be detected as Synced Lyrics."
                    className="text-foreground placeholder:text-muted-foreground/60 h-full w-full resize-none bg-transparent font-mono text-xs leading-relaxed outline-hidden"
                    spellCheck={false}
                />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                            const template = `[00:00.00] ${metadata?.title || 'Title'} - ${metadata?.artist || 'Artist'}\n[00:15.00] Line 1 lyrics here\n[00:30.00] Line 2 lyrics here`;
                            setLyricsText(template);
                            setLyricsSavedSuccess(false);
                            setNormalizeStatus(null);
                        }}
                        className="text-[10px]">
                        <Icon icon="edit" className="size-3" />
                        <span>Template</span>
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={isNormalizingLrc || (!lyricsText.trim() && !metadata?.lyrics)}
                        onClick={handleNormalizeLrc}
                        className="text-[10px]">
                        <Icon icon={isNormalizingLrc ? 'loading' : 'magic'} className="size-3 text-primary" />
                        <span>{isNormalizingLrc ? 'Normalizing...' : 'Normalize LRC'}</span>
                    </Button>
                </div>

                <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isSavingLyrics || lyricsText === (metadata?.lyrics || '')}
                    onClick={handleSaveLyrics}
                    className="h-7 text-xs">
                    <Icon
                        icon={isSavingLyrics ? 'loading' : lyricsSavedSuccess ? 'success' : 'save'}
                        className="size-3.5"
                    />
                    <span>{isSavingLyrics ? 'Saving...' : lyricsSavedSuccess ? 'Saved' : 'Save Lyrics'}</span>
                </Button>
            </div>

            {normalizeStatus && (
                <div
                    className={`rounded border px-2 py-1 text-[10px] select-text ${
                        normalizeStatus.success
                            ? 'border-success/30 bg-success/10 text-success'
                            : 'border-destructive/30 bg-destructive/10 text-destructive'
                    }`}>
                    {normalizeStatus.message}
                </div>
            )}
        </div>
    );
}
