'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Field, FieldInput, FieldLabel, FieldTextarea, FieldError, FieldRequiredIndicator } from '@/components/ui/Field';
import { Fieldset, FieldsetContent, FieldsetLegend } from '@/components/ui/Fieldset';
import { NumberInputField } from '@/components/ui/NumberInput';
import { formatBitrate, formatDuration, formatSampleRate } from '@/lib/utils';
import { useAudioStore } from '@/store/audioStore';
import { TagFormSchema, type TagFormValues, type TrackPatchApiResponse, REGEX_LRC_TIMESTAMP } from '@/types/audio';
import { normalizeLrc } from '@/core/lyrics/lrcParser';

export function AudioInspector() {
    const { activeTrackId, activeTrackDetail, fetchTracks, updateTrackInline, normalizeTrackLrc } = useAudioStore();
    const { metadata, rawTags, isLoading } = activeTrackDetail;

    const [isSaved, setIsSaved] = useState(false);
    const [rawSearch, setRawSearch] = useState('');

    // Dedicated Lyrics Tab State
    const [lyricsText, setLyricsText] = useState('');
    const [isSavingLyrics, setIsSavingLyrics] = useState(false);
    const [lyricsSavedSuccess, setLyricsSavedSuccess] = useState(false);
    const [isNormalizingLrc, setIsNormalizingLrc] = useState(false);
    const [normalizeStatus, setNormalizeStatus] = useState<{ success: boolean; message: string } | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        control,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<TagFormValues>({
        resolver: zodResolver(TagFormSchema),
        mode: 'onTouched',
        defaultValues: {
            title: '',
            artist: '',
            albumArtist: '',
            album: '',
            trackNumber: '',
            year: '',
            genre: '',
            bpm: '',
            initialKey: '',
            comment: '',
            composer: '',
            publisher: '',
            copyright: '',
            isrc: '',
            lyrics: '',
        },
    });

    const [watchedTitle, watchedArtist] = watch(['title', 'artist']);

    useEffect(() => {
        if (metadata) {
            reset({
                title: metadata.title || '',
                artist: metadata.artist || '',
                albumArtist: metadata.albumArtist || '',
                album: metadata.album || '',
                trackNumber: metadata.trackNumber != null ? String(metadata.trackNumber) : '',
                year: metadata.year != null ? String(metadata.year) : '',
                genre: metadata.genre || '',
                bpm: metadata.bpm != null ? String(metadata.bpm) : '',
                initialKey: metadata.initialKey || '',
                comment: metadata.comment || '',
                composer: metadata.composer || '',
                publisher: metadata.publisher || '',
                copyright: metadata.copyright || '',
                isrc: metadata.isrc || '',
                lyrics: metadata.lyrics || '',
            });
            setLyricsText(metadata.lyrics || '');
        }
    }, [metadata, reset]);

    const onSave = async (data: TagFormValues) => {
        if (!activeTrackId) return;

        setIsSaved(false);

        const payload = {
            title: data.title,
            artist: data.artist || '',
            albumArtist: data.albumArtist || '',
            album: data.album || '',
            trackNumber: data.trackNumber ? parseInt(data.trackNumber, 10) : null,
            year: data.year ? parseInt(data.year, 10) : null,
            genre: data.genre || '',
            bpm: data.bpm ? parseFloat(data.bpm) : null,
            initialKey: data.initialKey || '',
            comment: data.comment || '',
            composer: data.composer || '',
            publisher: data.publisher || '',
            copyright: data.copyright || '',
            isrc: data.isrc || '',
            lyrics: data.lyrics || '',
        };

        try {
            const { data: responseData } = await axios.patch<TrackPatchApiResponse>(
                `/api/files/${activeTrackId}/tags`,
                payload
            );

            const savedTrack = responseData.success && responseData.track ? responseData.track : { ...payload, id: activeTrackId };
            updateTrackInline(activeTrackId, savedTrack);

            reset({
                title: savedTrack.title || '',
                artist: savedTrack.artist || '',
                albumArtist: savedTrack.albumArtist || '',
                album: savedTrack.album || '',
                trackNumber: savedTrack.trackNumber != null ? String(savedTrack.trackNumber) : '',
                year: savedTrack.year != null ? String(savedTrack.year) : '',
                genre: savedTrack.genre || '',
                bpm: savedTrack.bpm != null ? String(savedTrack.bpm) : '',
                initialKey: savedTrack.initialKey || '',
                comment: savedTrack.comment || '',
                composer: savedTrack.composer || '',
                publisher: savedTrack.publisher || '',
                copyright: savedTrack.copyright || '',
                isrc: savedTrack.isrc || '',
                lyrics: savedTrack.lyrics || '',
            });

            setIsSaved(true);
            await fetchTracks();
        } catch (error) {
            console.error('Error updating track tags:', error);
        }
    };

    const handleSaveLyrics = async () => {
        if (!activeTrackId) return;

        setIsSavingLyrics(true);
        setLyricsSavedSuccess(false);

        try {
            const isLrc = REGEX_LRC_TIMESTAMP.test(lyricsText);
            const payload = {
                lyrics: lyricsText || null,
                lyricsUnsynced: isLrc ? null : lyricsText || null,
                lyricsSyncedJson: isLrc && lyricsText ? JSON.stringify(lyricsText) : null,
            };

            const { data } = await axios.patch<TrackPatchApiResponse>(
                `/api/files/${activeTrackId}/tags`,
                payload
            );

            const lyricsType: 'synced' | 'unsynced' | 'none' = isLrc
                ? 'synced'
                : lyricsText
                  ? 'unsynced'
                  : 'none';

            if (data.success && data.track) {
                updateTrackInline(activeTrackId, data.track);
            } else {
                updateTrackInline(activeTrackId, { ...payload, lyricsType });
            }

            setLyricsSavedSuccess(true);
            fetchTracks().catch(console.error);
        } catch (error) {
            console.error('Error saving lyrics:', error);
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

            const apiRes = await normalizeTrackLrc(activeTrackId, res.normalizedLrc);

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

    if (!activeTrackId || (!metadata && !isLoading)) {
        return (
            <aside className="bg-card text-muted-foreground flex w-90 flex-col items-center justify-center border border-l p-6 text-center select-none">
                <Icon icon="audio" className="mb-2 size-8 opacity-20" />
                <span className="text-xs font-medium">Select a track to inspect tags</span>
            </aside>
        );
    }

    const filteredRawTags = rawTags.filter(
        (t) =>
            t.tag.toLowerCase().includes(rawSearch.toLowerCase()) ||
            t.group.toLowerCase().includes(rawSearch.toLowerCase()) ||
            String(t.value).toLowerCase().includes(rawSearch.toLowerCase())
    );

    const isLrc = REGEX_LRC_TIMESTAMP.test(lyricsText);
    const hasLyrics = Boolean(lyricsText.trim());

    return (
        <aside className="bg-background flex h-full w-90 flex-col overflow-hidden border border-l text-xs select-none">
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
                        {watchedTitle || metadata?.title || 'Untitled'}
                    </div>
                    <div className="text-muted-foreground truncate text-[11px]">
                        {watchedArtist || metadata?.artist || 'Unknown Artist'}
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

            <Tabs defaultValue="tags" className="flex min-h-0 flex-1 flex-col">
                <div className="px-3 pt-2">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="tags" className="text-xs">
                            <Icon icon="document" className="size-3" />
                            Tags
                        </TabsTrigger>
                        <TabsTrigger value="lyrics" className="text-xs">
                            <Icon icon="lyrics" className="size-3" />
                            Lyrics
                        </TabsTrigger>
                        <TabsTrigger value="specs" className="text-xs">
                            <Icon icon="settings" className="size-3" />
                            Specs
                        </TabsTrigger>
                        <TabsTrigger value="raw" className="text-xs">
                            <Icon icon="raw" className="size-3" />
                            Raw
                        </TabsTrigger>
                        <TabsIndicator />
                    </TabsList>
                </div>

                <TabsContent value="tags" className="flex-1 space-y-3 overflow-auto p-3 font-mono">
                    <form onSubmit={handleSubmit(onSave)} className="space-y-3">
                        <Fieldset className="border p-2.5">
                            <FieldsetLegend className="text-primary text-[10px]">
                                <Icon icon="audio" className="size-3" />
                                Track Information
                            </FieldsetLegend>
                            <FieldsetContent className="gap-2">
                                <Field invalid={!!errors.title} required>
                                    <FieldLabel>
                                        Title <FieldRequiredIndicator />
                                    </FieldLabel>
                                    <FieldInput placeholder="Track title..." {...register('title')} />
                                    <FieldError>{errors.title?.message}</FieldError>
                                </Field>

                                <div className="grid grid-cols-2 gap-2">
                                    <Field invalid={!!errors.artist}>
                                        <FieldLabel>Artist</FieldLabel>
                                        <FieldInput placeholder="Artist name..." {...register('artist')} />
                                        <FieldError>{errors.artist?.message}</FieldError>
                                    </Field>
                                    <Field invalid={!!errors.albumArtist}>
                                        <FieldLabel>Album Artist</FieldLabel>
                                        <FieldInput placeholder="Album artist..." {...register('albumArtist')} />
                                        <FieldError>{errors.albumArtist?.message}</FieldError>
                                    </Field>
                                </div>

                                <Field invalid={!!errors.album}>
                                    <FieldLabel>Album</FieldLabel>
                                    <FieldInput placeholder="Album title..." {...register('album')} />
                                    <FieldError>{errors.album?.message}</FieldError>
                                </Field>

                                <div className="grid grid-cols-3 gap-2">
                                    <Field invalid={!!errors.trackNumber}>
                                        <FieldLabel>Track #</FieldLabel>
                                        <FieldInput placeholder="1" {...register('trackNumber')} />
                                        <FieldError>{errors.trackNumber?.message}</FieldError>
                                    </Field>
                                    <Field invalid={!!errors.year}>
                                        <FieldLabel>Year</FieldLabel>
                                        <FieldInput placeholder="2024" {...register('year')} />
                                        <FieldError>{errors.year?.message}</FieldError>
                                    </Field>
                                    <Field invalid={!!errors.genre}>
                                        <FieldLabel>Genre</FieldLabel>
                                        <FieldInput placeholder="Genre..." {...register('genre')} />
                                        <FieldError>{errors.genre?.message}</FieldError>
                                    </Field>
                                </div>
                            </FieldsetContent>
                        </Fieldset>

                        <Fieldset className="border p-2.5">
                            <FieldsetLegend className="text-primary text-[10px]">
                                <Icon icon="tune" className="size-3" />
                                Musical Properties
                            </FieldsetLegend>
                            <FieldsetContent className="gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <Controller
                                        control={control}
                                        name="bpm"
                                        render={({ field }) => (
                                            <NumberInputField
                                                label="BPM / Tempo"
                                                placeholder="128.0"
                                                min={20}
                                                max={400}
                                                step={0.5}
                                                value={field.value}
                                                onValueChange={(details) => field.onChange(details.value)}
                                                error={errors.bpm?.message}
                                            />
                                        )}
                                    />

                                    <Field invalid={!!errors.initialKey}>
                                        <FieldLabel>Initial Key</FieldLabel>
                                        <FieldInput placeholder="e.g. 8A, Am, C#m" {...register('initialKey')} />
                                        <FieldError>{errors.initialKey?.message}</FieldError>
                                    </Field>
                                </div>
                            </FieldsetContent>
                        </Fieldset>

                        <Fieldset className="border p-2.5">
                            <FieldsetLegend className="text-primary text-[10px]">
                                <Icon icon="star" className="size-3" />
                                Publishing & Rights
                            </FieldsetLegend>
                            <FieldsetContent className="gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <Field invalid={!!errors.composer}>
                                        <FieldLabel>Composer</FieldLabel>
                                        <FieldInput placeholder="Composer..." {...register('composer')} />
                                    </Field>
                                    <Field invalid={!!errors.publisher}>
                                        <FieldLabel>Publisher</FieldLabel>
                                        <FieldInput placeholder="Publisher..." {...register('publisher')} />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Field invalid={!!errors.copyright}>
                                        <FieldLabel>Copyright</FieldLabel>
                                        <FieldInput placeholder="© 2024..." {...register('copyright')} />
                                    </Field>
                                    <Field invalid={!!errors.isrc}>
                                        <FieldLabel>ISRC</FieldLabel>
                                        <FieldInput placeholder="US-XXX-24-00001" {...register('isrc')} />
                                    </Field>
                                </div>
                            </FieldsetContent>
                        </Fieldset>

                        <Fieldset className="border p-2.5">
                            <FieldsetLegend className="text-foreground text-[10px]">
                                <Icon icon="document" className="size-3" />
                                Notes
                            </FieldsetLegend>
                            <FieldsetContent className="gap-2">
                                <Field invalid={!!errors.comment}>
                                    <FieldLabel>Comment</FieldLabel>
                                    <FieldTextarea rows={2} placeholder="Add comments or notes..." {...register('comment')} />
                                    <FieldError>{errors.comment?.message}</FieldError>
                                </Field>
                            </FieldsetContent>
                        </Fieldset>

                        <Button type="submit" disabled={!isDirty || isSubmitting} variant="primary" className="mt-1 w-full">
                            <Icon icon={isSubmitting ? 'loading' : isSaved && !isDirty ? 'success' : 'save'} className="size-3.5" />
                            <span>{isSubmitting ? 'Writing Tags...' : isSaved && !isDirty ? 'Saved Successfully' : 'Write Tags'}</span>
                        </Button>
                    </form>
                </TabsContent>

                <TabsContent value="lyrics" className="flex flex-1 flex-col space-y-2 overflow-hidden p-3 font-mono">
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
                </TabsContent>

                <TabsContent value="specs" className="flex-1 space-y-2 overflow-auto p-3 font-mono text-[11px]">
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
                </TabsContent>

                <TabsContent value="raw" className="flex flex-1 flex-col space-y-2 overflow-hidden p-2 font-mono">
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
                </TabsContent>
            </Tabs>
        </aside>
    );
}

export default AudioInspector;
